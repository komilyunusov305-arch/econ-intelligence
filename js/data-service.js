(function () {
    "use strict";

    const config = window.EconIntel.Config;
    const REST_COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
    const state = {
        countries: Object.create(null),
        series: Object.create(null),
        issues: [],
        sources: Object.create(null),
        loaded: false,
        countryDirectorySource: null,
        lastUpdated: null
    };
    const inFlightRequests = new Map();
    const requestQueue = [];
    const MAX_ACTIVE_REQUESTS = 4;
    let activeRequests = 0;

    function acquireRequestSlot() {
        if (activeRequests < MAX_ACTIVE_REQUESTS) {
            activeRequests += 1;
            return Promise.resolve();
        }
        return new Promise(resolve => requestQueue.push(resolve));
    }

    function releaseRequestSlot() {
        activeRequests -= 1;
        const next = requestQueue.shift();
        if (next) {
            activeRequests += 1;
            next();
        }
    }

    function worldBankRecords(response, source) {
        if (!Array.isArray(response) || !response[0] || typeof response[0] !== "object") {
            throw new Error(`${source} returned an invalid World Bank response.`);
        }
        const rawMessages = response[0].message;
        const messages = Array.isArray(rawMessages) ? rawMessages : rawMessages ? [rawMessages] : [];
        if (messages.length) {
            const details = messages.map(message => typeof message === "string"
                ? message
                : message.value || message.key || "Unknown API error").join("; ");
            throw new Error(`${source}: ${details}`);
        }
        if (response[1] !== null && !Array.isArray(response[1])) {
            throw new Error(`${source} returned an unexpected World Bank data format.`);
        }
        if (response[1] === null && Number(response[0].total) > 0) {
            throw new Error(`${source} returned no records despite reporting available observations.`);
        }
        return { records: response[1] || [], metadata: response[0] };
    }

    async function requestJson(url) {
        const pending = inFlightRequests.get(url);
        if (pending) return pending;

        const request = (async () => {
            let lastError;
            for (let attempt = 0; attempt < 3; attempt++) {
                await acquireRequestSlot();
                try {
                    const controller = typeof AbortController === "function" ? new AbortController() : null;
                    let timeout;
                    try {
                        const fetchRequest = (async () => {
                            const response = await fetch(url, controller ? { signal: controller.signal } : {});
                            if (!response.ok) {
                                const error = new Error(`Request failed (${response.status})`);
                                error.status = response.status;
                                error.retryAfter = response.headers.get("Retry-After");
                                throw error;
                            }
                            return response.json();
                        })();
                        const timeoutRequest = new Promise((resolve, reject) => {
                            timeout = window.setTimeout(() => {
                                if (controller) controller.abort();
                                reject(new Error("Request timed out after 20000 ms."));
                            }, 20000);
                        });
                        return await Promise.race([fetchRequest, timeoutRequest]);
                    } finally {
                        if (timeout) window.clearTimeout(timeout);
                    }
                } catch (error) {
                    lastError = error;
                    const status = error.status;
                    const retryable = !status || status === 429 || status >= 500;
                    if (!retryable || attempt === 2) throw error;
                } finally {
                    releaseRequestSlot();
                }
                const retryAfter = Number(lastError.retryAfter);
                const delay = Number.isFinite(retryAfter) && retryAfter > 0
                    ? Math.min(retryAfter * 1000, 5000)
                    : 500 * (attempt + 1);
                await new Promise(resolve => window.setTimeout(resolve, delay));
            }
            throw lastError;
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
            const { records, metadata } = worldBankRecords(response, "World Bank country directory");
            if (!records.length) throw new Error("The World Bank country directory contained no records.");

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
            state.sources.countryDirectory = {
                source: "World Bank Open Data",
                status: "available",
                lastUpdated: metadata.lastupdated || null,
                observations: records.length
            };
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
                state.sources.countryDirectory = {
                    source: "REST Countries",
                    status: "available",
                    lastUpdated: null,
                    observations: Object.keys(state.countries).length
                };
                state.issues.push({
                    source: "World Bank country directory",
                    message: `Unavailable (${worldBankError.message}); REST Countries fallback is active.`
                });
            } catch (fallbackError) {
                state.sources.countryDirectory = {
                    source: "World Bank / REST Countries",
                    status: "unavailable",
                    error: fallbackError.message
                };
                throw new Error(`World Bank directory unavailable (${worldBankError.message}); REST Countries fallback unavailable (${fallbackError.message}).`);
            }
        }
    }

    async function loadWorldBank(key, indicator) {
        const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator.code}?format=json&date=${config.startYear}:${config.endYear}&per_page=20000`;
        const response = await requestJson(url);
        const { records, metadata } = worldBankRecords(response, `World Bank ${indicator.code}`);

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
        state.sources[key] = {
            source: "World Bank Open Data",
            status: records.some(record => record.value !== null) ? "available" : "no observations",
            lastUpdated: metadata.lastupdated || null,
            observations: records.filter(record => record.value !== null).length
        };
    }

    async function loadWorldAggregate(key, indicator) {
        const url = `https://api.worldbank.org/v2/country/WLD/indicator/${indicator.code}?format=json&date=${config.startYear}:${config.endYear}&per_page=100`;
        const response = await requestJson(url);
        const { records, metadata } = worldBankRecords(response, `World Bank ${indicator.label}`);
        const points = (records || []).map(record => ({
            year: Number(record.date),
            value: record.value === null ? null : Number(record.value)
        })).filter(point => Number.isFinite(point.year) && (point.value === null || Number.isFinite(point.value)))
            .sort((a, b) => a.year - b.year);
        state.series[key] = { WLD: points };
        state.sources[key] = {
            source: "World Bank Open Data",
            status: points.some(point => point.value !== null) ? "available" : "no observations",
            lastUpdated: metadata.lastupdated || null,
            observations: points.filter(point => point.value !== null).length
        };
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
        state.sources[key] = {
            source: "IMF DataMapper",
            status: Object.values(countries).some(points => points.length) ? "available" : "no observations",
            lastUpdated: null,
            observations: Object.values(countries).reduce((count, points) => count + points.length, 0)
        };
    }

    async function load() {
        state.issues = [];
        state.sources = Object.create(null);
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
                key,
                source: `${indicator.source === "imf" ? "IMF" : "World Bank"} ${indicator.code}`,
                load: () => indicator.source === "imf" ? loadImf(key, indicator) : loadWorldBank(key, indicator)
            })),
            ...Object.entries(config.overviewIndicators).map(([key, indicator]) => ({
                key,
                source: `World Bank ${indicator.label}`,
                load: () => loadWorldAggregate(key, indicator)
            }))
        ];
        const results = await Promise.allSettled(requests.map(request => request.load()));
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                state.issues.push({ source: requests[index].source, message: result.reason.message });
                state.sources[requests[index].key] = {
                    source: requests[index].source,
                    status: "unavailable",
                    error: result.reason.message
                };
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
