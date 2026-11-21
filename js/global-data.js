(function () {
    "use strict";

    const REST_COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
    const WORLD_BANK_BASE = "https://api.worldbank.org/v2/country/all/indicator/";
    const UN_WPP_BASE = "https://population.un.org/dataportalapi/uiapi/v1";
    const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
    const GEOJSON_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
    const CACHE_PREFIX = "econ-intel-global-v2:";
    const CACHE_TTL = 12 * 60 * 60 * 1000;
    const HISTORY_START = 1990;
    const WPP_REFERENCE_YEAR = 2025;
    const indicators = {
        population: "SP.POP.TOTL",
        male: "SP.POP.TOTL.MA.IN",
        female: "SP.POP.TOTL.FE.IN",
        density: "EN.POP.DNST",
        growth: "SP.POP.GROW",
        gdp: "NY.GDP.MKTP.CD",
        gdpPerCapita: "NY.GDP.PCAP.CD"
    };
    const state = {
        countries: [],
        byCode: Object.create(null),
        series: Object.create(null),
        leaders: Object.create(null),
        issues: [],
        sources: Object.create(null),
        verifiedAt: null,
        generation: 0,
        ministersLoading: false,
        ministersIssue: null
    };

    function readCache(key) {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || "null");
            return cached && Array.isArray(cached.value) || cached && typeof cached.value === "object"
                ? cached
                : null;
        } catch (error) {
            console.warn("Could not read the global data cache:", error);
            return null;
        }
    }

    function writeCache(key, value) {
        try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }));
        } catch (error) {
            console.warn("Could not save global data to the local cache:", error);
        }
    }

    function invalidateCache(key) {
        try {
            localStorage.removeItem(CACHE_PREFIX + key);
        } catch (error) {
            console.warn("Could not remove invalid global data from the local cache:", error);
        }
    }

    async function requestJson(url, options) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 60000);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            if (!response.ok) throw new Error(`Request failed (${response.status})`);
            return await response.json();
        } finally {
            window.clearTimeout(timeout);
        }
    }

    async function cachedJson(key, url, options) {
        const cached = readCache(key);
        const forceRefresh = Boolean(options && options.force);
        const requestOptions = { ...options };
        delete requestOptions.force;
        if (!forceRefresh && cached && Date.now() - cached.savedAt < CACHE_TTL) {
            state.sources[key] = { status: "cached", savedAt: cached.savedAt };
            return cached.value;
        }
        try {
            const value = await requestJson(url, requestOptions);
            writeCache(key, value);
            state.sources[key] = { status: "live", savedAt: Date.now() };
            return value;
        } catch (error) {
            if (cached) {
                state.sources[key] = { status: "stale", savedAt: cached.savedAt };
                state.issues.push({ source: key, message: error.message, usingCache: true });
                console.warn(`Using cached ${key} data after a request error:`, error);
                return cached.value;
            }
            state.sources[key] = { status: "unavailable", savedAt: null };
            throw error;
        }
    }

    function cleanText(value) {
        return typeof value === "string" && value.trim() ? value.trim() : null;
    }

    function countryContinent(record) {
        if (Array.isArray(record.continents) && record.continents[0]) return record.continents[0];
        const region = cleanText(record.region);
        const subregion = (record.subregion || "").toLocaleLowerCase();
        if (region === "Americas") return subregion.includes("south america") ? "South America" : "North America";
        if (region === "Africa" || region === "Europe" || region === "Asia" || region === "Oceania") return region;
        if (region === "Antarctic") return "Antarctica";
        return null;
    }

    function normalizeCountry(record) {
        const name = record && record.name || {};
        const currencies = record && record.currencies || {};
        const languages = record && record.languages || {};
        const alpha2 = cleanText(record.cca2).toLocaleLowerCase();
        const sourceFlagUrl = record.flags && (cleanText(record.flags.svg) || cleanText(record.flags.png));
        return {
            code: cleanText(record.cca3),
            alpha2: cleanText(record.cca2),
            name: cleanText(name.common) || cleanText(name.official) || "Unknown country",
            officialName: cleanText(name.official),
            independent: record.independent === true,
            sovereigntyKnown: typeof record.independent === "boolean",
            unMember: record.unMember === true,
            flagUrl: sourceFlagUrl || (alpha2 ? `https://flagcdn.com/w160/${alpha2}.png` : null),
            flagEmoji: record.flag || "",
            inceptionDate: null,
            capital: Array.isArray(record.capital) ? record.capital[0] || null : null,
            region: cleanText(record.region),
            subregion: cleanText(record.subregion),
            continent: countryContinent(record),
            restPopulation: Number.isFinite(record.population) ? record.population : null,
            area: Number.isFinite(record.area) ? record.area : null,
            currencies: Object.values(currencies).map(currency => currency && currency.name).filter(Boolean),
            currencyCodes: Object.keys(currencies),
            languages: Object.values(languages).filter(Boolean),
            population: null,
            male: null,
            female: null,
            density: null,
            medianAge: null,
            growth: null,
            gdp: null,
            gdpPerCapita: null,
            governmentType: null,
            governmentCategory: "Unclassified",
            headOfState: null,
            headOfGovernment: null,
            foreignMinister: null,
            officialWebsite: null,
            politicalSource: null
        };
    }

    async function loadCountries(forceRefresh) {
        const records = await cachedJson("rest-countries", REST_COUNTRIES_URL, { force: forceRefresh });
        if (!Array.isArray(records)) {
            invalidateCache("rest-countries");
            throw new Error("The REST Countries response had an unexpected format.");
        }
        state.countries = records.map(normalizeCountry).filter(country => country.code);
        state.byCode = Object.fromEntries(state.countries.map(country => [country.code, country]));
    }

    function economicDirectoryFallback() {
        const economicCountries = window.EconIntel.Data.state.countries;
        state.countries = Object.values(economicCountries).map(country => ({
            ...normalizeCountry({ cca3: country.code, name: { common: country.name }, independent: null }),
            region: country.region
        }));
        state.byCode = Object.fromEntries(state.countries.map(country => [country.code, country]));
    }

    async function loadIndicator(key, code, forceRefresh) {
        const start = key === "population" || key === "growth" || key === "male" || key === "female" ? HISTORY_START : 2000;
        const url = `${WORLD_BANK_BASE}${code}?format=json&date=${start}:${new Date().getFullYear()}&per_page=20000`;
        const response = await cachedJson(`wb-${code}`, url, { force: forceRefresh });
        const records = Array.isArray(response) && Array.isArray(response[1]) ? response[1] : [];
        if (Array.isArray(response) && response[1] !== null && !Array.isArray(response[1])) {
            invalidateCache(`wb-${code}`);
            throw new Error(`World Bank indicator ${code} had an unexpected format.`);
        }
        if (!Array.isArray(response)) {
            invalidateCache(`wb-${code}`);
            throw new Error(`World Bank indicator ${code} had an unexpected format.`);
        }
        const byCountry = Object.create(null);
        records.forEach(record => {
            const countryCode = cleanText(record.countryiso3code);
            const year = Number(record.date);
            const value = record.value === null ? null : Number(record.value);
            if (!countryCode || !Number.isInteger(year) || (value !== null && !Number.isFinite(value))) return;
            (byCountry[countryCode] = byCountry[countryCode] || []).push({ year, value });
        });
        Object.values(byCountry).forEach(points => points.sort((a, b) => a.year - b.year));
        state.series[key] = byCountry;
    }

    function latest(points) {
        if (!Array.isArray(points)) return null;
        for (let index = points.length - 1; index >= 0; index--) {
            if (points[index].value !== null && Number.isFinite(points[index].value)) return points[index];
        }
        return null;
    }

    function attachIndicatorData() {
        state.countries.forEach(country => {
            Object.keys(indicators).forEach(key => {
                const point = latest(state.series[key] && state.series[key][country.code]);
                if (point) country[key] = { ...point, source: "World Bank" };
            });
            if (!country.population && country.restPopulation !== null) {
                country.population = { year: null, value: country.restPopulation, source: "REST Countries" };
            }
        });
    }

    function wdValue(binding, key) {
        return binding && binding[key] ? binding[key].value : null;
    }

    function wdEntity(binding, key, labelKey, imageKey, startKey, partyKey) {
        const uri = wdValue(binding, key);
        if (!uri) return null;
        const id = uri.slice(uri.lastIndexOf("/") + 1);
        const image = wdValue(binding, imageKey);
        const start = wdValue(binding, startKey);
        return {
            name: wdValue(binding, labelKey) || null,
            wikidataId: id,
            url: `https://www.wikidata.org/wiki/${id}`,
            image: image || null,
            startDate: start ? start.slice(0, 10) : null,
            party: wdValue(binding, partyKey) || null
        };
    }

    function classifyGovernment(label) {
        if (!label) return "Unclassified";
        const value = label.toLocaleLowerCase("en");
        if (value.includes("semi-presidential republic")) return "Semi-Presidential Republic";
        if (value.includes("parliamentary republic")) return "Parliamentary Republic";
        if (value.includes("presidential republic")) return "Presidential Republic";
        if (value.includes("semi-constitutional monarchy") || value.includes("semi constitutional monarchy")) return "Semi-Constitutional Monarchy";
        if (value.includes("constitutional monarchy")) return "Constitutional Monarchy";
        if (value.includes("absolute monarchy")) return "Absolute Monarchy";
        return "Unclassified";
    }

    function createWikidataQuery(countries) {
        const codes = countries.filter(country => country.independent).map(country => country.code);
        if (!codes.length) return null;
        const values = codes.map(code => `"${code}"`).join(" ");
        return `SELECT DISTINCT ?iso3 ?country ?governmentType ?governmentTypeLabel ?headOfState ?headOfStateLabel ?headOfStateImage ?headOfStatePartyLabel ?headOfStateStart ?headOfGovernment ?headOfGovernmentLabel ?headOfGovernmentImage ?headOfGovernmentPartyLabel ?headOfGovernmentStart ?officialWebsite ?inception WHERE {
            VALUES ?iso3 { ${values} }
            ?country wdt:P298 ?iso3.
            OPTIONAL { ?country wdt:P571 ?inception. }
            OPTIONAL { ?country wdt:P122 ?governmentType. }
            OPTIONAL { ?country wdt:P35 ?headOfState. OPTIONAL { ?headOfState wdt:P18 ?headOfStateImage. } OPTIONAL { ?headOfState wdt:P102 ?headOfStateParty. } }
            OPTIONAL { ?country wdt:P6 ?headOfGovernment. OPTIONAL { ?headOfGovernment wdt:P18 ?headOfGovernmentImage. } OPTIONAL { ?headOfGovernment wdt:P102 ?headOfGovernmentParty. } }
            OPTIONAL { ?country p:P35 ?headOfStateStatement. ?headOfStateStatement ps:P35 ?headOfState; pq:P580 ?headOfStateStart. }
            OPTIONAL { ?country p:P6 ?headOfGovernmentStatement. ?headOfGovernmentStatement ps:P6 ?headOfGovernment; pq:P580 ?headOfGovernmentStart. }
            OPTIONAL { ?country wdt:P856 ?officialWebsite. }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }`;
    }

    async function loadPoliticalData(forceRefresh) {
        const sovereign = state.countries.filter(country => country.independent);
        if (!sovereign.length) return;
        const chunkSize = 40;
        for (let offset = 0; offset < sovereign.length; offset += chunkSize) {
            const chunk = sovereign.slice(offset, offset + chunkSize);
            const query = createWikidataQuery(chunk);
            if (!query) continue;
            const cacheKey = `wikidata-political-v2-${offset}-${chunkSize}`;
            const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
            try {
                const response = await cachedJson(cacheKey, url, { headers: { Accept: "application/sparql-results+json" }, force: forceRefresh });
                const rows = response && response.results && response.results.bindings;
                if (!Array.isArray(rows)) throw new Error("Wikidata returned an unexpected SPARQL response.");
                rows.forEach(binding => {
                    const code = wdValue(binding, "iso3");
                    const country = state.byCode[code];
                    if (!country) return;
                    country.governmentType = wdValue(binding, "governmentTypeLabel");
                    country.governmentCategory = classifyGovernment(country.governmentType);
                    country.headOfState = wdEntity(binding, "headOfState", "headOfStateLabel", "headOfStateImage", "headOfStateStart", "headOfStatePartyLabel");
                    country.headOfGovernment = wdEntity(binding, "headOfGovernment", "headOfGovernmentLabel", "headOfGovernmentImage", "headOfGovernmentStart", "headOfGovernmentPartyLabel");
                    country.officialWebsite = wdValue(binding, "officialWebsite");
                    country.inceptionDate = wdValue(binding, "inception");
                    country.politicalSource = wdValue(binding, "country");
                });
            } catch (error) {
                state.issues.push({ source: "Wikidata leaders", message: error.message });
                console.warn(`Could not load leader records for a country batch starting at ${offset}:`, error);
            }
        }
    }

    async function loadForeignMinisters(forceRefresh) {
        const sovereign = state.countries.filter(country => country.independent);
        if (!sovereign.length) return;
        const records = [];
        const chunkSize = 40;
        for (let offset = 0; offset < sovereign.length; offset += chunkSize) {
            const chunk = sovereign.slice(offset, offset + chunkSize);
            const codes = chunk.map(country => `"${country.code}"`).join(" ");
            const ministerQuery = `SELECT DISTINCT ?iso3 ?foreignMinister ?foreignMinisterLabel ?foreignMinisterImage ?foreignMinisterStart ?foreignMinisterPartyLabel WHERE {
                VALUES ?iso3 { ${codes} }
                ?country wdt:P298 ?iso3.
                ?foreignMinisterPosition wdt:P1001 ?country; rdfs:label ?foreignMinisterPositionLabel.
                ?foreignMinisterPosition p:P1308 ?foreignMinisterStatement.
                ?foreignMinisterStatement ps:P1308 ?foreignMinister.
                FILTER(LANG(?foreignMinisterPositionLabel) = "en")
                FILTER(REGEX(LCASE(STR(?foreignMinisterPositionLabel)), "foreign affairs minister|foreign minister|minister of foreign affairs"))
                FILTER NOT EXISTS { ?foreignMinisterStatement pq:P582 ?foreignMinisterEnd. }
                OPTIONAL { ?foreignMinisterStatement pq:P580 ?foreignMinisterStart. }
                OPTIONAL { ?foreignMinister wdt:P18 ?foreignMinisterImage. }
                OPTIONAL { ?foreignMinister wdt:P102 ?foreignMinisterParty. }
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }`;
            const cacheKey = `wikidata-ministers-${offset}-${chunkSize}`;
            const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(ministerQuery)}&format=json`;
            const response = await cachedJson(cacheKey, url, { headers: { Accept: "application/sparql-results+json" }, force: forceRefresh });
            const rows = response && response.results && response.results.bindings;
            if (!Array.isArray(rows)) throw new Error("Wikidata returned an unexpected foreign-minister response.");
            rows.forEach(binding => {
                const country = state.byCode[wdValue(binding, "iso3")];
                const person = wdEntity(binding, "foreignMinister", "foreignMinisterLabel", "foreignMinisterImage", "foreignMinisterStart", "foreignMinisterPartyLabel");
                if (country && person) records.push({ code: country.code, person });
            });
        }
        return records;
    }

    async function loadWppMedianAge(forceRefresh) {
        const locations = await cachedJson("wpp-locations", `${UN_WPP_BASE}/locations/tvAlphabetical?pageNumber=1&pageSize=500`, { force: forceRefresh });
        if (!Array.isArray(locations)) {
            invalidateCache("wpp-locations");
            throw new Error("The UN WPP location directory had an unexpected format.");
        }
        const idsByCode = Object.create(null);
        locations.forEach(location => {
            if (location && location.iso3 && Number.isInteger(Number(location.id))) idsByCode[location.iso3] = Number(location.id);
        });
        const pairs = state.countries.filter(country => idsByCode[country.code])
            .map(country => ({ code: country.code, id: idsByCode[country.code] }));
        if (!pairs.length) throw new Error("The UN WPP directory did not match sovereign country codes.");
        const ids = pairs.map(pair => pair.id).join(",");
        const url = `${UN_WPP_BASE}/data/indicators/67/locations/${ids}/selind/67/selloc/${ids}/selyears/${WPP_REFERENCE_YEAR}/time/${WPP_REFERENCE_YEAR}:${WPP_REFERENCE_YEAR}/route/line/subRoute/linetimeplot`;
        const records = await cachedJson("wpp-median-age-v2", url, { force: forceRefresh });
        if (!Array.isArray(records) || (records.length && !records.every(record => Number.isFinite(Number(record.locationId)) && Number.isFinite(Number(record.value))))) {
            invalidateCache("wpp-median-age");
            throw new Error("UN WPP median-age observations had an unexpected format.");
        }
        const codeById = Object.fromEntries(pairs.map(pair => [pair.id, pair.code]));
        records.forEach(record => {
            const country = state.byCode[codeById[Number(record.locationId)]];
            if (!country) return;
            country.medianAge = {
                year: Number(record.timeLabel) || WPP_REFERENCE_YEAR,
                value: Number(record.value),
                source: "UN World Population Prospects · 2024 revision",
                estimateType: record.estimateType || "Not specified",
                estimateMethod: record.estimateMethod || "Not specified"
            };
        });
    }

    async function load(forceRefresh) {
        const generation = ++state.generation;
        state.issues = [];
        state.sources = Object.create(null);
        state.ministersIssue = null;
        state.ministersLoading = false;
        state.verifiedAt = new Date().toISOString();
        try {
            await loadCountries(forceRefresh);
        } catch (error) {
            state.issues.push({ source: "REST Countries", message: error.message });
            console.warn("Could not load country directory:", error);
            economicDirectoryFallback();
        }

        const results = await Promise.allSettled([
            ...Object.entries(indicators).map(([key, code]) => loadIndicator(key, code, forceRefresh)),
            loadPoliticalData(forceRefresh),
            loadWppMedianAge(forceRefresh)
        ]);
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                const indicatorCount = Object.keys(indicators).length;
                const source = index < indicatorCount
                    ? `World Bank ${Object.values(indicators)[index]}`
                    : index === indicatorCount ? "Wikidata leaders and systems" : "UN World Population Prospects median age";
                state.issues.push({ source, message: result.reason.message });
                console.warn(`Could not load ${source} data:`, result.reason);
            }
        });
        attachIndicatorData();
        state.ministersLoading = true;
        loadForeignMinisters(forceRefresh).then(records => {
            if (generation !== state.generation) return;
            records.forEach(record => {
                if (!state.byCode[record.code].foreignMinister) state.byCode[record.code].foreignMinister = record.person;
            });
            state.ministersLoading = false;
            if (window.EconIntel.GlobalModules) window.EconIntel.GlobalModules.refreshPoliticalViews();
        }).catch(error => {
            if (generation !== state.generation) return;
            state.ministersLoading = false;
            state.ministersIssue = error.message;
            state.issues.push({ source: "Wikidata foreign ministers", message: error.message });
            console.warn("Could not load foreign affairs ministers:", error);
            if (window.EconIntel.GlobalModules) window.EconIntel.GlobalModules.refreshPoliticalViews();
        });
        return state;
    }

    async function loadMapGeoJSON() {
        const geojson = await cachedJson("natural-earth-map", GEOJSON_URL);
        if (!geojson || !Array.isArray(geojson.features)) {
            invalidateCache("natural-earth-map");
            throw new Error("Natural Earth country boundaries had an unexpected format.");
        }
        return geojson;
    }

    function series(key, code) {
        return state.series[key] && state.series[key][code] ? state.series[key][code] : [];
    }

    window.EconIntel.GlobalData = {
        state,
        indicators,
        load,
        loadMapGeoJSON,
        series,
        latest,
        classifyGovernment
    };
}());
