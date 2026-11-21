(function () {
    "use strict";

    const config = window.EconIntel.Config;
    const REST_COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
    const state = {
        countries: Object.create(null),
        series: Object.create(null),
        issues: [],
        loaded: false,
        countryDirectorySource: null,
        lastUpdated: null
    };
    const inFlightRequests = new Map();

    async function requestJson(url) {
        const pending = inFlightRequests.get(url);
        if (pending) return pending;

        const request = (async () => {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 20000);
            try {
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) throw new Error(`Request failed (${response.status})`);
                return await response.json();
            } finally {
                window.clearTimeout(timeout);
            }
        })();
        inFlightRequests.set(url, request);
        try {
            return await request;
        } finally {
            if (inFlightRequests.get(url) === request) inFlightRequests.delete(url);
        }
    }

    function coordinate(value) {
        if (value === null || value === undefined || String(value).trim() === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    async function loadCountries() {
        try {
            const response = await requestJson("https://api.worldbank.org/v2/country?format=json&per_page=400");
            const records = Array.isArray(response) ? response[1] : null;
            if (!Array.isArray(records)) throw new Error("The World Bank country list had an unexpected format.");

            records
                .filter(country => country.region && country.region.value !== "Aggregates")
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(country => {
                    state.countries[country.id] = {
                        code: country.id,
                        name: country.name,
                        region: country.region.value,
                        latitude: coordinate(country.latitude),
                        longitude: coordinate(country.longitude)
                    };
                });
            state.countryDirectorySource = "World Bank";
        } catch (worldBankError) {
            try {
                const records = await requestJson(REST_COUNTRIES_URL);
                if (!Array.isArray(records)) throw new Error("The REST Countries directory had an unexpected format.");
                records.forEach(country => {
                    if (!country.cca3 || !country.name || !country.name.common) return;
                    const coords = Array.isArray(country.latlng) ? country.latlng : [];
                    state.countries[country.cca3] = {
                        code: country.cca3,
                        name: country.name.common,
                        region: country.region || "Region unavailable",
                        latitude: coordinate(coords[0]),
                        longitude: coordinate(coords[1])
                    };
                });
                if (!Object.keys(state.countries).length) throw new Error("The REST Countries directory contained no usable records.");
                state.countryDirectorySource = "REST Countries";
                state.issues.push({
                    source: "World Bank country directory",
                    message: `Unavailable (${worldBankError.message}); REST Countries fallback is active.`
                });
            } catch (fallbackError) {
                throw new Error(`World Bank directory unavailable (${worldBankError.message}); REST Countries fallback unavailable (${fallbackError.message}).`);
            }
        }
    }

    async function loadWorldBank(key, indicator) {
        const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator.code}?format=json&date=${config.startYear}:${config.endYear}&per_page=20000`;
        const response = await requestJson(url);
        const records = Array.isArray(response) ? response[1] : null;
        if (records !== null && !Array.isArray(records)) throw new Error("The World Bank indicator response had an unexpected format.");

        const countries = Object.create(null);
        (records || []).forEach(record => {
            const code = record.countryiso3code;
            const value = record.value === null ? null : Number(record.value);
            const observationYear = Number(record.date);
            if ((code !== "WLD" && !state.countries[code]) || !Number.isFinite(observationYear)
                || (value !== null && !Number.isFinite(value))) return;
            (countries[code] = countries[code] || []).push({ year: observationYear, value });
        });
        Object.values(countries).forEach(points => points.sort((a, b) => a.year - b.year));
        state.series[key] = countries;
    }

    async function loadWorldAggregate(key, indicator) {
        const url = `https://api.worldbank.org/v2/country/WLD/indicator/${indicator.code}?format=json&date=${config.startYear}:${config.endYear}&per_page=100`;
        const response = await requestJson(url);
        const records = Array.isArray(response) ? response[1] : null;
        if (records !== null && !Array.isArray(records)) {
            throw new Error("The World Bank global indicator response had an unexpected format.");
        }
        const points = (records || []).map(record => ({
            year: Number(record.date),
            value: record.value === null ? null : Number(record.value)
        })).filter(point => Number.isFinite(point.year) && (point.value === null || Number.isFinite(point.value)))
            .sort((a, b) => a.year - b.year);
        state.series[key] = { WLD: points };
    }

    async function loadImf(key, indicator) {
        const response = await requestJson(`https://www.imf.org/external/datamapper/api/v1/${indicator.code}`);
        const values = response && response.values && response.values[indicator.code];
        if (!values || typeof values !== "object") throw new Error("The IMF response had an unexpected format.");

        const countries = Object.create(null);
        Object.entries(values).forEach(([code, observations]) => {
            if (!state.countries[code] || !observations || typeof observations !== "object") return;
            countries[code] = Object.entries(observations)
                .map(([year, value]) => ({ year: Number(year), value: value === null ? null : Number(value) }))
                .filter(point => point.year >= config.startYear && point.year <= config.endYear
                    && Number.isFinite(point.year) && (point.value === null || Number.isFinite(point.value)))
                .sort((a, b) => a.year - b.year);
        });
        state.series[key] = countries;
    }

    async function load() {
        state.issues = [];
        state.loaded = false;
        state.lastUpdated = null;
        try {
            await loadCountries();
        } catch (error) {
            state.issues.push({ source: "Country directory", message: error.message });
            state.loaded = true;
            state.lastUpdated = new Date().toISOString();
            return state;
        }

        const requests = [
            ...Object.entries(config.indicators).map(([key, indicator]) => ({
                source: `${indicator.source === "imf" ? "IMF" : "World Bank"} ${indicator.code}`,
                load: () => indicator.source === "imf" ? loadImf(key, indicator) : loadWorldBank(key, indicator)
            })),
            ...Object.entries(config.overviewIndicators).map(([key, indicator]) => ({
                source: `World Bank ${indicator.label}`,
                load: () => loadWorldAggregate(key, indicator)
            }))
        ];
        const results = await Promise.allSettled(requests.map(request => request.load()));
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                state.issues.push({ source: requests[index].source, message: result.reason.message });
                console.warn(`Could not load ${requests[index].source}:`, result.reason);
            }
        });
        state.loaded = true;
        state.lastUpdated = new Date().toISOString();
        return state;
    }

    function latest(key, code) {
        const points = state.series[key] && state.series[key][code];
        if (!points) return null;
        for (let index = points.length - 1; index >= 0; index--) {
            if (points[index].value !== null && Number.isFinite(points[index].value)) return points[index];
        }
        return null;
    }

    function series(key, code) {
        return state.series[key] && state.series[key][code] ? state.series[key][code] : [];
    }

    function valueForYear(key, code, year) {
        return series(key, code).find(point => point.year === year && point.value !== null) || null;
    }

    function observationCount() {
        return Object.values(state.series).reduce((sum, countries) =>
            sum + Object.values(countries).reduce((countrySum, points) =>
                countrySum + points.filter(point => point.value !== null).length, 0), 0);
    }

    window.EconIntel.Data = {
        state,
        load,
        latest,
        series,
        valueForYear,
        observationCount
    };
}());
