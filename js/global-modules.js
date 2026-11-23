(function () {
    "use strict";

    const data = window.EconIntel.GlobalData;
    const charts = window.EconIntel.Charts;
    const $ = id => document.getElementById(id);
    const state = {
        loaded: false,
        initializing: false,
        initialized: false,
        populationSort: "population",
        populationSortDirection: -1,
        countrySort: "name",
        countrySortDirection: 1,
        controlsBound: false,
        populationTimer: null,
        geoPromise: null,
        profileCode: null
    };
    const systemTypes = [
        "Presidential Republic", "Parliamentary Republic", "Semi-Presidential Republic",
        "Constitutional Monarchy", "Semi-Constitutional Monarchy", "Absolute Monarchy"
    ];
    const categoryColors = ["#55d6a5", "#70a9ff", "#f0b768", "#b48cff", "#55c8d7", "#f17e83", "#647284"];
    const mapAliases = {
        "United States of America": "USA", "Russia": "RUS", "South Korea": "KOR",
        "North Korea": "PRK", "Democratic Republic of the Congo": "COD",
        "Republic of the Congo": "COG", "Ivory Coast": "CIV", "Swaziland": "SWZ",
        "East Timor": "TLS", "Timor Leste": "TLS", "Turkey": "TUR", "Türkiye": "TUR",
        "Syria": "SYR", "Iran": "IRN", "Vietnam": "VNM", "Laos": "LAO",
        "Brunei": "BRN", "Bahamas": "BHS", "Gambia": "GMB", "Egypt": "EGY",
        "Venezuela": "VEN", "Bolivia": "BOL", "Micronesia": "FSM", "Moldova": "MDA",
        "Palestine": "PSE"
    };

    function escape(value) {
        return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
    }

    function safeExternalUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
        } catch (error) {
            return null;
        }
    }

    function countryFlag(country) {
        const url = safeExternalUrl(country.flagUrl);
        const fallbackUrl = country.alpha2 ? `https://flagcdn.com/w160/${escape(country.alpha2.toLocaleLowerCase())}.png` : null;
        if (url) {
            const retry = fallbackUrl && fallbackUrl !== url
                ? ` onerror="this.onerror=null;this.src='${fallbackUrl}'"`
                : ` onerror="this.onerror=null;this.hidden=true;this.nextElementSibling.hidden=false"`;
            return `<span class="country-flag-frame"><img class="country-flag" src="${escape(url)}" alt="${escape(country.name)} flag" loading="lazy" referrerpolicy="no-referrer"${retry}><span class="country-flag-placeholder" aria-hidden="true" hidden>${escape(country.flagEmoji || country.alpha2 || "—")}</span></span>`;
        }
        return `<span class="country-flag-frame"><span class="country-flag-placeholder" aria-hidden="true">${escape(country.flagEmoji || country.alpha2 || "—")}</span></span>`;
    }

    function formatNumber(value, digits) {
        return value === null || value === undefined || !Number.isFinite(Number(value))
            ? "—"
            : Number(value).toLocaleString("en-US", { maximumFractionDigits: digits === undefined ? 0 : digits });
    }

    function formatCompact(value) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
        const absolute = Math.abs(value);
        if (absolute >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
        if (absolute >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
        if (absolute >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
        return formatNumber(value);
    }

    function formatPercent(value) {
        return value === null || value === undefined || !Number.isFinite(Number(value))
            ? "—"
            : `${Number(value).toFixed(2)}%`;
    }

    function formatInceptionDate(value) {
        const match = /^([+-]?)(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(String(value));
        if (!match) return String(value);
        const year = Number(match[2]);
        const month = Number(match[3]);
        const day = Number(match[4]);
        if (!month || !day) return `${year}`;
        const date = new Date(Date.UTC(year, month - 1, day));
        return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
    }

    function latestWorld(key) {
        return data.latest(data.series(key, "WLD"));
    }

    function valueOf(country, key) {
        return country[key] && Number.isFinite(country[key].value) ? country[key].value : null;
    }

    function yearOf(country, key) {
        return country[key] && country[key].year ? country[key].year : null;
    }

    function sexPercentage(country, key) {
        const total = country.population;
        const sex = country[key];
        if (!total || !sex || !Number.isFinite(total.value) || !Number.isFinite(sex.value) || !total.year || total.year !== sex.year) return null;
        return sex.value / total.value * 100;
    }

    function countryName(code) {
        const country = data.state.byCode[code];
        return country ? country.name : code;
    }

    function countryDatabaseLinks(code) {
        return `<a class="country-name-link" href="#country-database" data-view="country-database" data-profile-code="${escape(code)}">${escape(countryName(code))}</a>`;
    }

    function updateVerified(elementId, sourceLabel) {
        const element = $(elementId);
        if (!element) return;
        const checked = data.state.verifiedAt ? new Date(data.state.verifiedAt).toLocaleString() : "not checked";
        const issues = data.state.issues.length ? ` · ${data.state.issues.length} source issue${data.state.issues.length === 1 ? "" : "s"}` : "";
        element.innerHTML = `<i></i> Checked ${escape(checked)} · ${escape(sourceLabel)}${escape(issues)}`;
        const sourceDetails = Object.entries(data.state.sources).map(([key, source]) => {
            const name = source.source || key;
            const updated = source.lastUpdated
                ? ` · dataset updated ${source.lastUpdated}`
                : source.savedAt ? ` · retrieved ${new Date(source.savedAt).toLocaleString()}` : "";
            const error = source.error ? ` · ${source.error}` : "";
            return `${name}: ${source.status || "checked"}${updated}${error}`;
        });
        const issueDetails = data.state.issues.map(issue => `${issue.source}: ${issue.message}`);
        element.title = [
            "Data retrieval/check timestamp; this does not certify every record against an official government publication.",
            ...sourceDetails,
            ...issueDetails
        ].join("\n");
    }

    function populateContinents(id, records) {
        const select = $(id);
        if (!select) return;
        const current = select.value;
        const continents = Array.from(new Set(records.map(country => country.continent).filter(Boolean))).sort();
        select.innerHTML = `<option value="">All continents</option>${continents.map(continent =>
            `<option value="${escape(continent)}">${escape(continent)}</option>`
        ).join("")}`;
        if (continents.includes(current)) select.value = current;
    }

    function filterCountries(records, searchId, continentId) {
        const query = $(searchId).value.trim().toLocaleLowerCase();
        const continent = $(continentId).value;
        return records.filter(country => {
            if (continent && country.continent !== continent) return false;
            if (!query) return true;
            const text = [
                country.name, country.officialName, country.capital, country.continent, country.region,
                ...country.languages, ...country.currencies, ...country.currencyCodes
            ].filter(Boolean).join(" ").toLocaleLowerCase();
            return text.includes(query);
        });
    }

    function renderLeaderCard(country, role, person) {
        const position = role === "headOfState"
            ? "President"
            : role === "headOfGovernment"
                ? "Head of Government"
                : "Foreign Affairs Minister";
        const portraitUrl = safeExternalUrl(person.image);
        const portrait = portraitUrl
            ? `<img class="leader-portrait" src="${escape(portraitUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : `<span class="leader-portrait leader-portrait-empty" aria-hidden="true">—</span>`;
        const source = person.url
            ? `<a href="${escape(person.url)}" target="_blank" rel="noopener noreferrer">Wikidata record ↗</a>`
            : `<span>Wikidata source record</span>`;
        const officialUrl = safeExternalUrl(country.officialWebsite);
        const governmentSource = officialUrl
            ? `<a href="${escape(officialUrl)}" target="_blank" rel="noopener noreferrer">Official website listed in Wikidata ↗</a>`
            : `<span>Government source not recorded</span>`;
        return `<article class="leader-card">
            ${portrait}
            <div class="leader-card-main">
                <div class="leader-country-line">${countryFlag(country)}<strong>${countryDatabaseLinks(country.code)}</strong></div>
                <h3>${escape(person.name || "Name unavailable in source")}</h3>
                <p class="leader-position">${escape(position)}</p>
                <dl class="leader-facts">
                    <div><dt>Term start</dt><dd>${escape(person.startDate || "Not recorded")}</dd></div>
                    <div><dt>Political party</dt><dd>${escape(person.party || "Not recorded")}</dd></div>
                </dl>
                <div class="leader-sources">${source}${governmentSource}</div>
            </div>
        </article>`;
    }

    function renderUnavailableLeaders(container, role, countries) {
        const noun = role === "headOfState" ? "head-of-state" : role === "headOfGovernment" ? "head-of-government" : "foreign-minister";
        const query = $("leadersSearch").value.trim().toLocaleLowerCase();
        const known = countries.filter(country => country[role]
            && (!query || `${country.name} ${country.officialName || ""} ${country[role].name || ""}`.toLocaleLowerCase().includes(query)));
        const missing = countries.filter(country => !country[role]);
        const continent = $("leadersContinent").value;
        const filteredMissing = missing.filter(country =>
            (!continent || country.continent === continent)
            && (!query || `${country.name} ${country.officialName || ""}`.toLocaleLowerCase().includes(query))
        );
        const prioritized = (items) => [...items].sort((a, b) => {
            const uzbekistanPriority = (country) =>
                country.code === "UZB" || /^uzbek/i.test(country.name || "") ? 0 : 1;
            const priorityDifference = uzbekistanPriority(a) - uzbekistanPriority(b);
            return priorityDifference || a.name.localeCompare(b.name);
        });
        const records = prioritized(known).map(country => renderLeaderCard(country, role, country[role])).join("");
        const disclosure = filteredMissing.length
            ? `<details class="unrecorded-list"><summary>No matching ${noun} record for ${filteredMissing.length} countries</summary><p>Not recorded by this Wikidata query; this does not confirm that an office is absent or vacant.</p><div>${prioritized(filteredMissing).map(country =>
                `<span class="unrecorded-country">${countryFlag(country)}${escape(country.name)}${country.governmentCategory.includes("Monarchy") && role === "headOfState" ? " · monarch not recorded" : ""}</span>`
            ).join("")}</div></details>`
            : "";
        container.innerHTML = (records || `<p class="empty-state">No matching officeholder records for this filter.</p>`) + disclosure;
        return known.length;
    }

    function renderLeaders() {
        const sovereign = data.state.countries.filter(country => country.independent);
        const query = $("leadersSearch").value.trim().toLocaleLowerCase();
        const continent = $("leadersContinent").value;
        const position = $("leadersPosition").value;
        const matched = sovereign.filter(country => {
            if (continent && country.continent !== continent) return false;
            const people = [country.headOfState, country.headOfGovernment, country.foreignMinister].filter(Boolean);
            return !query || `${country.name} ${country.officialName || ""} ${people.map(person => person.name || "").join(" ")}`
                .toLocaleLowerCase().includes(query);
        });
        const roles = [
            ["headOfState", "headsOfState", "headOfStateCount"],
            ["headOfGovernment", "headsOfGovernment", "headOfGovernmentCount"],
            ["foreignMinister", "foreignMinisters", "foreignMinisterCount"]
        ];
        roles.forEach(([role, containerId, countId]) => {
            const container = $(containerId);
            const records = matched.filter(country => country[role]);
            const count = position && position !== role ? 0 : renderUnavailableLeaders(container, role, matched);
            if (position && position !== role) {
                container.innerHTML = `<p class="empty-state">Filtered to another position.</p>`;
            }
            $(countId).textContent = `${position && position !== role ? 0 : count} sourced records`;
        });
        $("leadersStatus").textContent = `${matched.length} of ${sovereign.length} sovereign states match. Officeholders, dates, and official sources depend on source coverage.${data.state.ministersLoading ? " Foreign-minister records are still loading from Wikidata." : ""}`;
    }

    function systemCounts(records) {
        const counts = Object.fromEntries(systemTypes.map(type => [type, 0]));
        let unclassified = 0;
        records.forEach(country => {
            if (Object.prototype.hasOwnProperty.call(counts, country.governmentCategory)) counts[country.governmentCategory]++;
            else unclassified++;
        });
        return { counts, unclassified, classified: records.length - unclassified };
    }

    function systemDonut(counts) {
        const republics = counts["Presidential Republic"] + counts["Parliamentary Republic"] + counts["Semi-Presidential Republic"];
        const monarchies = counts["Constitutional Monarchy"] + counts["Semi-Constitutional Monarchy"] + counts["Absolute Monarchy"];
        const total = republics + monarchies;
        if (!total) return `<p class="empty-state">No sourced systems are available for this chart.</p>`;
        let offset = 0;
        const circumference = 2 * Math.PI * 64;
        const segments = [
            { label: "Republics", value: republics, color: "#55d6a5" },
            { label: "Monarchies", value: monarchies, color: "#70a9ff" }
        ].map(segment => {
            const length = circumference * segment.value / total;
            const dash = `${length} ${circumference - length}`;
            const circle = `<circle class="donut-segment" data-system-major="${segment.label}" cx="95" cy="95" r="64" fill="none" stroke="${segment.color}" stroke-width="21" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 95 95)" tabindex="0" role="button" aria-label="Filter ${segment.label}: ${segment.value} countries">`;
            offset += length;
            return `${circle}<title>${segment.label}: ${segment.value}</title></circle>`;
        }).join("");
        return `<div class="system-chart-layout"><svg viewBox="0 0 190 190" role="group" aria-label="Republic and monarchy classification">${segments}<text class="donut-total" x="95" y="91" text-anchor="middle">${total}</text><text class="donut-caption" x="95" y="110" text-anchor="middle">classified</text></svg><div class="system-legend"><button class="system-legend-button" type="button" data-system-major="Republics"><i style="--swatch:#55d6a5"></i><span>Republics</span><strong>${republics} <small>${(republics / total * 100).toFixed(1)}%</small></strong></button><button class="system-legend-button" type="button" data-system-major="Monarchies"><i style="--swatch:#70a9ff"></i><span>Monarchies</span><strong>${monarchies} <small>${(monarchies / total * 100).toFixed(1)}%</small></strong></button></div></div>`;
    }

    function renderSystemStats() {
        const countries = data.state.countries.filter(country => country.independent);
        const result = systemCounts(countries);
        const republics = result.counts["Presidential Republic"] + result.counts["Parliamentary Republic"] + result.counts["Semi-Presidential Republic"];
        const monarchies = result.counts["Constitutional Monarchy"] + result.counts["Semi-Constitutional Monarchy"] + result.counts["Absolute Monarchy"];
        const total = result.classified || 1;
        $("systemStats").innerHTML = [
            ["REPUBLICS", republics, `${(republics / total * 100).toFixed(1)}% of classified`],
            ["MONARCHIES", monarchies, `${(monarchies / total * 100).toFixed(1)}% of classified`],
            ["UNCLASSIFIED", result.unclassified, `of ${countries.length} sovereign states`]
        ].map(([label, count, note]) => `<article class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${formatNumber(count)}</div><div class="kpi-foot"><span>${note}</span><span class="kpi-year">${result.classified} classified</span></div></article>`).join("");
        $("systemChart").innerHTML = systemDonut(result.counts);
        $("systemsFilter").innerHTML = `<option value="">All classifications</option><option value="Republics">All republics</option><option value="Monarchies">All monarchies</option>${systemTypes.map(type =>
            `<option value="${escape(type)}">${escape(type)}</option>`
        ).join("")}<option value="Unclassified">Unclassified / mixed</option>`;
    }

    function majorSystem(category) {
        if (category.includes("Republic")) return "Republics";
        if (category.includes("Monarchy")) return "Monarchies";
        return "Unclassified";
    }

    function systemCard(country) {
        const headState = country.headOfState ? country.headOfState.name : "Not recorded";
        const headGovernment = country.headOfGovernment ? country.headOfGovernment.name : "Not recorded";
        const type = country.governmentType || "Not recorded in Wikidata";
        return `<a class="country-system-card" href="#country-database" data-view="country-database" data-profile-code="${escape(country.code)}">
            <div class="country-card-title">${countryFlag(country)}<strong>${escape(country.name)}</strong></div>
            <p class="system-type">${escape(country.governmentCategory)}${country.governmentCategory === "Unclassified" ? "" : ` · ${escape(type)}`}</p>
            <dl><div><dt>President</dt><dd>${escape(headState)}${country.governmentCategory.includes("Monarchy") && country.headOfState ? " · Monarch" : ""}</dd></div><div><dt>Head of Government</dt><dd>${escape(headGovernment)}</dd></div></dl>
        </a>`;
    }

    function renderSystemCountries() {
        const all = data.state.countries.filter(country => country.independent);
        const query = $("systemsSearch").value.trim().toLocaleLowerCase();
        const continent = $("systemsContinent").value;
        const classification = $("systemsFilter").value;
        const records = all.filter(country =>
            (!continent || country.continent === continent)
            && (!classification
                || country.governmentCategory === classification
                || (classification === "Republics" && country.governmentCategory.includes("Republic"))
                || (classification === "Monarchies" && country.governmentCategory.includes("Monarchy")))
            && (!query || `${country.name} ${country.officialName || ""} ${country.governmentType || ""}`.toLocaleLowerCase().includes(query))
        );
        $("systemsCountries").innerHTML = records.length
            ? records.map(systemCard).join("")
            : `<p class="empty-state">No countries match these filters.</p>`;
    }

    function metricCard(label, value, note) {
        return `<article class="kpi-card"><div class="kpi-label">${escape(label)}</div><div class="kpi-value">${escape(value)}</div><div class="kpi-foot"><span>${escape(note)}</span></div></article>`;
    }

    function renderDonut(element, segments, center, description) {
        const total = segments.reduce((sum, segment) => sum + (Number.isFinite(segment.value) ? segment.value : 0), 0);
        if (!total) {
            element.innerHTML = `<p class="empty-state">${escape(description || "No observations are available for this chart.")}</p>`;
            return;
        }
        let offset = 0;
        const circumference = 2 * Math.PI * 68;
        const arcs = segments.filter(segment => segment.value > 0).map(segment => {
            const length = circumference * segment.value / total;
            const svg = `<circle cx="100" cy="100" r="68" fill="none" stroke="${segment.color}" stroke-width="22" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"><title>${escape(segment.label)}: ${formatNumber(segment.value)} (${(segment.value / total * 100).toFixed(1)}%)</title></circle>`;
            offset += length;
            return svg;
        }).join("");
        element.innerHTML = `<div class="donut-layout"><svg viewBox="0 0 200 200" role="img" aria-label="${escape(description)}">${arcs}<text class="donut-total" x="100" y="96" text-anchor="middle">${escape(center)}</text><text class="donut-caption" x="100" y="116" text-anchor="middle">people</text></svg><div class="donut-legend">${segments.map(segment =>
            `<div><i style="--swatch:${segment.color}"></i><span>${escape(segment.label)}</span><strong>${formatCompact(segment.value)} <small>${(segment.value / total * 100).toFixed(1)}%</small></strong></div>`
        ).join("")}</div></div>`;
    }

    function renderHorizontalBars(element, rows, valueKey, nameKey, options) {
        const values = rows.map(row => Number(row[valueKey])).filter(Number.isFinite);
        const maximum = Math.max(...values, 1);
        element.innerHTML = rows.length ? rows.map(row => {
            const value = Number(row[valueKey]);
            const width = Number.isFinite(value) ? Math.max(value / maximum * 100, 1) : 0;
            const label = row[nameKey];
            const code = row.code;
            return `<div class="demographic-bar-row"><span class="demographic-bar-name">${code ? countryDatabaseLinks(code) : escape(label)}</span><span class="demographic-track"><span style="width:${width}%"></span></span><strong>${formatCompact(value)}</strong></div>`;
        }).join("") : `<p class="empty-state">${escape(options && options.empty || "No observations are available.")}</p>`;
    }

    function globalGrowth() {
        return data.series("growth", "WLD").filter(point => point.value !== null);
    }

    function populationBaseline() {
        return {
            total: latestWorld("population"),
            male: latestWorld("male"),
            female: latestWorld("female"),
            growth: latestWorld("growth")
        };
    }

    function renderPopulation() {
        const baseline = populationBaseline();
        const total = baseline.total && baseline.total.value;
        const male = baseline.male && baseline.male.value;
        const female = baseline.female && baseline.female.value;
        const growth = baseline.growth && baseline.growth.value;
        const year = baseline.total && baseline.total.year;
        const medianAgeSample = data.state.countries.find(country => country.medianAge);
        const medianAgeYear = medianAgeSample ? medianAgeSample.medianAge.year : "unavailable";
        const sameWorldYear = baseline.total && baseline.male && baseline.female
            && baseline.total.year === baseline.male.year && baseline.total.year === baseline.female.year;
        const malePct = sameWorldYear && total ? male / total * 100 : null;
        const femalePct = sameWorldYear && total ? female / total * 100 : null;
        const daily = Number.isFinite(total) && Number.isFinite(growth) ? total * growth / 100 / 365.2425 : null;
        $("populationStats").innerHTML = [
            metricCard("ESTIMATED WORLD POPULATION", formatNumber(total), `World Bank · ${year || "year unavailable"}`),
            metricCard("MALE POPULATION", formatNumber(male), `${formatPercent(malePct)} · World Bank · ${baseline.male ? baseline.male.year : "year unavailable"}`),
            metricCard("FEMALE POPULATION", formatNumber(female), `${formatPercent(femalePct)} · World Bank · ${baseline.female ? baseline.female.year : "year unavailable"}`),
            metricCard("ANNUAL GROWTH / DAILY CHANGE", `${formatPercent(growth)} / ${daily === null ? "—" : `+${formatNumber(daily)}`}`, `Daily change is derived from annual rate · ${baseline.growth ? baseline.growth.year : "year unavailable"}`)
        ].join("");
        renderDonut($("genderChart"), [
            { label: "Male", value: male, color: "#70a9ff" },
            { label: "Female", value: female, color: "#f17e83" }
        ], total ? formatCompact(total) : "—", "World population by sex");
        const continents = Array.from(new Set(data.state.countries.map(country => country.continent).filter(Boolean)))
            .map(continent => ({
                name: continent,
                population: data.state.countries.filter(country => country.independent && country.continent === continent)
                    .reduce((sum, country) => sum + (valueOf(country, "population") || 0), 0)
            }))
            .filter(row => row.population > 0)
            .sort((a, b) => b.population - a.population);
        renderHorizontalBars($("continentChart"), continents, "population", "name");
        $("continentChart").setAttribute("aria-label", "Sum of latest available country population observations by continent; observation years can differ.");
        const top = data.state.countries.filter(country => country.independent && valueOf(country, "population") !== null)
            .sort((a, b) => valueOf(b, "population") - valueOf(a, "population"))
            .slice(0, 20)
            .map(country => ({ code: country.code, name: country.name, population: valueOf(country, "population") }));
        renderHorizontalBars($("topPopulation"), top, "population", "name");
        charts.renderLine($("populationGrowthChart"), [{
            label: "World annual population growth",
            points: globalGrowth()
        }], {
            unit: "%",
            label: "Annual world population growth rate",
            empty: "World Bank growth-rate observations are unavailable."
        });
        const maleYear = baseline.male && baseline.male.year;
        const femaleYear = baseline.female && baseline.female.year;
        $("populationSource").innerHTML = `Sources: World Bank Open Data · <code>SP.POP.TOTL</code>, <code>SP.POP.TOTL.MA.IN</code>, <code>SP.POP.TOTL.FE.IN</code>, <code>EN.POP.DNST</code>, <code>SP.POP.GROW</code>. Median age: <a href="https://population.un.org/wpp/" target="_blank" rel="noopener noreferrer">UN World Population Prospects 2024 revision</a>, data year ${medianAgeYear}. Population and sex observation years are shown per country. Latest global years: total ${year || "—"}, male ${maleYear || "—"}, female ${femaleYear || "—"}.`;
        $("populationCounterNote").textContent = total && growth !== null
            ? `Estimate extrapolated from World Bank population (${year}) at the reported ${formatPercent(growth)} annual growth rate. Daily change ≈ ${formatNumber(daily)}; this is not a real-time census.`
            : "No complete world population baseline and growth rate are available; an estimated counter cannot be calculated.";
        updatePopulationCounter();
        renderPopulationTable();
        renderPopulationComparison();
    }

    function updatePopulationCounter() {
        if (state.populationTimer) window.clearInterval(state.populationTimer);
        const baseline = populationBaseline();
        if (!baseline.total || baseline.growth === null || baseline.growth.value === null) {
            $("livePopulation").textContent = "Estimate unavailable";
            return;
        }
        const start = Date.UTC(baseline.total.year, 6, 1);
        const base = baseline.total.value;
        const growth = baseline.growth.value / 100;
        const update = () => {
            const elapsedYears = Math.max(0, (Date.now() - start) / (365.2425 * 24 * 60 * 60 * 1000));
            const estimate = base * Math.pow(1 + growth, elapsedYears);
            $("livePopulation").textContent = formatNumber(estimate);
        };
        update();
        state.populationTimer = window.setInterval(update, 1000);
    }

    function renderPopulationComparison() {
        const codeA = $("populationCompareA").value;
        const codeB = $("populationCompareB").value;
        const records = [codeA, codeB].filter(Boolean);
        charts.renderLine($("populationCompareChart"), records.map((code, index) => ({
            label: countryName(code),
            points: data.series("population", code).filter(point => point.value !== null),
            color: categoryColors[index]
        })), {
            label: "Country population comparison",
            empty: "No population history is available for this selection."
        });
    }

    function sortedPopulationCountries() {
        return data.state.countries.filter(country => country.independent)
            .sort((a, b) => {
                if (state.populationSort === "name") return state.populationSortDirection * a.name.localeCompare(b.name);
                const left = valueOf(a, state.populationSort);
                const right = valueOf(b, state.populationSort);
                if (left === null || right === null) return left === right ? a.name.localeCompare(b.name) : left === null ? 1 : -1;
                return state.populationSortDirection * (left - right);
            });
    }

    function renderPopulationTable() {
        const query = $("populationSearch").value.trim().toLocaleLowerCase();
        const continent = $("populationContinent").value;
        const rows = sortedPopulationCountries().filter(country =>
            (!continent || country.continent === continent)
            && (!query || `${country.name} ${country.officialName || ""}`.toLocaleLowerCase().includes(query))
        );
        $("populationTable").querySelector("tbody").innerHTML = rows.length ? rows.map(country => {
            const population = country.population;
            return `<tr><td>${countryFlag(country)} ${countryDatabaseLinks(country.code)}</td>
                <td class="num">${formatNumber(population && population.value)}<small>${population && population.year ? population.year : population ? "year unavailable" : "unavailable"}</small></td>
                <td class="num">${formatNumber(valueOf(country, "male"))}<small>${yearOf(country, "male") || ""}</small></td>
                <td class="num">${formatPercent(sexPercentage(country, "male"))}</td>
                <td class="num">${formatNumber(valueOf(country, "female"))}<small>${yearOf(country, "female") || ""}</small></td>
                <td class="num">${formatPercent(sexPercentage(country, "female"))}</td>
                <td class="num">${formatNumber(valueOf(country, "density"), 1)}<small>${yearOf(country, "density") || ""}</small></td>
                <td class="num">${formatNumber(valueOf(country, "medianAge"), 1)}<small>${yearOf(country, "medianAge") || ""} · UN WPP</small></td>
                <td class="num">${formatPercent(valueOf(country, "growth"))}<small>${yearOf(country, "growth") || ""}</small></td></tr>`;
        }).join("") : `<tr><td class="empty-state" colspan="9">No countries match the current filters.</td></tr>`;
    }

    function setCountryProfile(code) {
        const country = data.state.byCode[code];
        if (!country) return;
        state.profileCode = code;
        $("countryProfilePanel").hidden = false;
        $("countryProfileTitle").textContent = country.name;
        const facts = [
            ["Official name", country.officialName],
            ["Common name", country.name],
            ["Capital", country.capital],
            ["Continent", country.continent],
            ["Geographic region", [country.region, country.subregion].filter(Boolean).join(" · ")],
            ["State inception / establishment", country.inceptionDate ? formatInceptionDate(country.inceptionDate) : "Exact date unavailable from Wikidata"],
            ["Political system", country.governmentType],
            ["Constitutional classification", country.governmentCategory],
            ["Currency", [...country.currencyCodes, ...country.currencies].join(" · ")],
            ["Official languages", country.languages.join(", ")],
            ["Area (km²)", country.area],
            ["Population", country.population ? `${formatNumber(country.population.value)} (${country.population.year || "year unavailable"}; ${country.population.source})` : null],
            ["Male population", country.male ? `${formatNumber(country.male.value)} (${country.male.year}; ${country.male.source})` : null],
            ["Female population", country.female ? `${formatNumber(country.female.value)} (${country.female.year}; ${country.female.source})` : null],
            ["Male percentage", sexPercentage(country, "male") === null ? null : `${formatPercent(sexPercentage(country, "male"))} (population and male observations from ${country.population.year})`],
            ["Female percentage", sexPercentage(country, "female") === null ? null : `${formatPercent(sexPercentage(country, "female"))} (population and female observations from ${country.population.year})`],
            ["Population density", country.density ? `${formatNumber(country.density.value, 1)} / km² (${country.density.year})` : null],
            ["Median age", country.medianAge ? `${formatNumber(country.medianAge.value, 1)} years (${country.medianAge.year}; ${country.medianAge.source}; ${country.medianAge.estimateType})` : null],
            ["Annual population growth", country.growth ? `${formatPercent(country.growth.value)} (${country.growth.year})` : null],
            ["GDP", country.gdp ? `$${formatNumber(country.gdp.value)} (${country.gdp.year}; World Bank)` : null],
            ["GDP per capita", country.gdpPerCapita ? `$${formatNumber(country.gdpPerCapita.value, 0)} (${country.gdpPerCapita.year}; World Bank)` : null],
            ["President", country.headOfState && country.headOfState.name],
            ["Head of Government", country.headOfGovernment && country.headOfGovernment.name],
            ["Foreign Affairs Minister", country.foreignMinister && country.foreignMinister.name],
            ["Official government source", null]
        ];
        $("countryProfile").innerHTML = `<div class="profile-heading">${countryFlag(country)}<div><p>${escape(country.officialName || country.name)}</p><span>${escape(country.independent ? "Sovereign state" : country.sovereigntyKnown ? "Territory or dependency" : "Sovereignty status unavailable")}</span></div></div>
            <dl class="profile-facts">${facts.map(([label, value]) => {
                let display = value === null || value === undefined || value === "" ? "Not available from connected sources" : String(value);
                if (label === "Official government source") {
                    const officialUrl = safeExternalUrl(country.officialWebsite);
                    display = officialUrl
                        ? `<a href="${escape(officialUrl)}" target="_blank" rel="noopener noreferrer">Official website listed by Wikidata ↗</a>`
                        : "Not recorded; no government URL inferred";
                }
                return `<div><dt>${escape(label)}</dt><dd>${label === "Official government source" ? display : escape(display)}</dd></div>`;
            }).join("")}</dl>
            <p class="source-note">Country attributes: <a href="https://github.com/mledoze/countries" target="_blank" rel="noopener noreferrer">REST Countries dataset</a>. Population and economic observations: <a href="https://data.worldbank.org/" target="_blank" rel="noopener noreferrer">World Bank Open Data</a>. Political officeholders and government type: <a href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">Wikidata</a>. Median age: <a href="https://population.un.org/wpp/" target="_blank" rel="noopener noreferrer">UN WPP</a>. Missing sources are not inferred.</p>`;
    }

    function renderCountryDirectory() {
        const type = $("countryType").value;
        const pool = data.state.countries.filter(country =>
            type === "all" || (type === "sovereign" && country.independent) || (type === "territory" && country.sovereigntyKnown && !country.independent)
        );
        const records = filterCountries(pool, "countrySearch", "countryContinent")
            .sort((a, b) => state.countrySortDirection * (state.countrySort === "name" ? a.name.localeCompare(b.name) : 0));
        $("countryDirectoryTitle").textContent = type === "sovereign" ? "Sovereign states" : type === "territory" ? "Territories & dependencies" : "All country records";
        $("countryDirectoryCount").textContent = `${records.length} records`;
        $("countryDirectory").innerHTML = records.length ? records.map(country => {
            const population = country.population ? `${formatNumber(country.population.value)}${country.population.year ? ` · ${country.population.year}` : ""}` : "Unavailable";
            const leadership = country.headOfState && country.headOfState.name || "President not recorded";
            const government = country.headOfGovernment && country.headOfGovernment.name || "Head of Government not recorded";
            return `<button class="country-directory-card" type="button" data-profile-code="${escape(country.code)}">
                <div class="country-card-title">${countryFlag(country)}<strong>${escape(country.name)}</strong><span>${escape(country.code)}</span></div>
                <p>${escape(country.capital || "Capital unavailable")} · ${escape(country.continent || "Region unavailable")}</p>
                <dl><div><dt>Population</dt><dd>${escape(population)}</dd></div><div><dt>Established</dt><dd>${escape(country.inceptionDate ? formatInceptionDate(country.inceptionDate) : "Date unavailable")}</dd></div><div><dt>System</dt><dd>${escape(country.governmentCategory)}</dd></div><div><dt>President</dt><dd>${escape(leadership)}</dd></div><div><dt>Head of Government</dt><dd>${escape(government)}</dd></div></dl>
                <span class="country-card-open">Open country profile →</span>
            </button>`;
        }).join("") : `<p class="empty-state">No country records match these filters.</p>`;
    }

    function renderPopulationMap() {
        if (state.geoPromise) return state.geoPromise;
        state.geoPromise = data.loadMapGeoJSON().then(geojson => {
            if (!window.d3 || !window.d3.geoEqualEarth) throw new Error("The D3 geographic projection library is unavailable.");
            const svg = $("populationMap");
            const width = 960;
            const height = 500;
            const projection = window.d3.geoEqualEarth().fitSize([width, height], geojson);
            const path = window.d3.geoPath(projection);
            const nameIndex = new Map(data.state.countries.map(country => [country.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), country.code]));
            const values = data.state.countries.map(country => valueOf(country, "population")).filter(value => value > 0);
            const maxLog = Math.max(...values.map(value => Math.log10(value)), 1);
            const paths = geojson.features.map(feature => {
                const props = feature.properties || {};
                const name = props.ADMIN || props.NAME_EN || props.NAME || "Unknown";
                const candidates = [props.ISO_A3_EH, props.ISO_A3, props.ADM0_A3, props.WB_A3];
                let code = candidates.find(candidate => candidate && data.state.byCode[candidate]) || mapAliases[name];
                if (!code) code = nameIndex.get(name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
                const country = code && data.state.byCode[code];
                const population = country && valueOf(country, "population");
                const shade = population > 0 ? Math.max(0.13, Math.log10(population) / maxLog) : 0.1;
                const color = population > 0 ? `hsl(158 45% ${Math.round(20 + shade * 27)}%)` : "var(--map-missing)";
                return `<path class="population-map-country${code ? "" : " population-map-unavailable"}" d="${path(feature) || ""}" fill="${color}" data-code="${escape(code || "")}" data-name="${escape(name)}" tabindex="${code ? "0" : "-1"}" role="${code ? "button" : "img"}" aria-label="${escape(country ? `${country.name}, population ${formatNumber(population)}` : `${name}, population unavailable`)}"><title>${escape(country ? `${country.name}: ${formatNumber(population)}${yearOf(country, "population") ? ` (${yearOf(country, "population")})` : ""}` : `${name}: no population observation`)}</title></path>`;
            }).join("");
            svg.innerHTML = `<g>${paths}</g>`;
            svg.addEventListener("click", event => {
                const feature = event.target.closest("[data-code]");
                if (feature && feature.dataset.code) {
                    setCountryProfile(feature.dataset.code);
                    document.querySelector('.nav-item[data-view="country-database"]').click();
                }
            });
            svg.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                const feature = event.target.closest("[data-code]");
                if (feature && feature.dataset.code) {
                    event.preventDefault();
                    setCountryProfile(feature.dataset.code);
                    document.querySelector('.nav-item[data-view="country-database"]').click();
                }
            });
            $("populationMapStatus").textContent = "Map boundaries: Natural Earth public domain · Fill intensity: latest World Bank population per country. Click a country for its profile.";
        }).catch(error => {
            console.error("Could not load the population map:", error);
            $("populationMap").innerHTML = `<text x="480" y="240" text-anchor="middle" class="map-loading">Population map unavailable</text><text x="480" y="268" text-anchor="middle" class="map-loading-hint">${escape(error.message)}</text>`;
            $("populationMapStatus").textContent = "Map unavailable; country population statistics remain available in the table.";
        });
        return state.geoPromise;
    }

    function populateComparisonSelectors() {
        const countries = data.state.countries.filter(country => country.independent)
            .sort((a, b) => a.name.localeCompare(b.name));
        ["populationCompareA", "populationCompareB"].forEach((id, index) => {
            const select = $(id);
            const previous = select.value;
            select.innerHTML = countries.map(country => `<option value="${escape(country.code)}">${escape(country.name)}</option>`).join("");
            const preferred = previous || (index === 0 ? "CHN" : "IND");
            if (countries.some(country => country.code === preferred)) select.value = preferred;
        });
    }

    function bindControls() {
        if (state.controlsBound) return;
        state.controlsBound = true;
        $("leadersSearch").addEventListener("input", renderLeaders);
        $("leadersContinent").addEventListener("change", renderLeaders);
        $("leadersPosition").addEventListener("change", renderLeaders);
        $("systemsSearch").addEventListener("input", renderSystemCountries);
        $("systemsContinent").addEventListener("change", renderSystemCountries);
        $("systemsFilter").addEventListener("change", renderSystemCountries);
        $("systemChart").addEventListener("click", event => {
            const button = event.target.closest("[data-system-major]");
            if (!button) return;
            $("systemsFilter").value = button.dataset.systemMajor;
            renderSystemCountries();
        });
        $("populationSearch").addEventListener("input", renderPopulationTable);
        $("populationContinent").addEventListener("change", renderPopulationTable);
        $("populationCompareA").addEventListener("change", renderPopulationComparison);
        $("populationCompareB").addEventListener("change", renderPopulationComparison);
        $("populationTable").querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => {
            const key = button.dataset.sort;
            state.populationSortDirection = key === state.populationSort ? -state.populationSortDirection : 1;
            state.populationSort = key;
            renderPopulationTable();
        }));
        $("countrySearch").addEventListener("input", renderCountryDirectory);
        $("countryContinent").addEventListener("change", renderCountryDirectory);
        $("countryType").addEventListener("change", renderCountryDirectory);
        $("countryProfilePanel").querySelector("#closeCountryProfile").addEventListener("click", () => {
            $("countryProfilePanel").hidden = true;
            state.profileCode = null;
        });
        document.addEventListener("click", event => {
            const profileLink = event.target.closest("[data-profile-code]");
            if (profileLink && profileLink.dataset.profileCode) {
                setCountryProfile(profileLink.dataset.profileCode);
                if (profileLink.dataset.view) {
                    $("countryProfilePanel").scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }
        });
        document.querySelectorAll(".sort-button").forEach(button => button.addEventListener("click", () => {
            if (button.dataset.sort === "name") {
                state.countrySortDirection *= -1;
                renderCountryDirectory();
            }
        }));
        $("refreshGlobalData").addEventListener("click", async event => {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = "Refreshing source data…";
            try {
                await data.load(true);
                state.geoPromise = null;
                prepareViews();
                button.textContent = "Refresh source data ↻";
            } catch (error) {
                console.error("Could not refresh global source data:", error);
                button.textContent = `Refresh failed · ${error.message}`;
            } finally {
                button.disabled = false;
            }
        });
    }

    function prepareViews() {
        populateContinents("leadersContinent", data.state.countries.filter(country => country.independent));
        populateContinents("systemsContinent", data.state.countries.filter(country => country.independent));
        populateContinents("populationContinent", data.state.countries.filter(country => country.independent));
        populateContinents("countryContinent", data.state.countries);
        populateComparisonSelectors();
        renderLeaders();
        renderSystemStats();
        renderSystemCountries();
        renderPopulation();
        renderCountryDirectory();
        updateVerified("leadersVerifiedAt", "Wikidata");
        updateVerified("systemsVerifiedAt", "Wikidata");
        updateVerified("populationVerifiedAt", "World Bank");
        updateVerified("databaseVerifiedAt", "REST Countries, World Bank, Wikidata");
        $("leadersPosition").value = "";
        $("leadersSearch").dispatchEvent(new Event("input"));
        $("countryDatabaseSource").innerHTML = `Sources: <a href="https://github.com/mledoze/countries" target="_blank" rel="noopener noreferrer">REST Countries public dataset</a> (${data.state.countries.length} records) · <a href="https://data.worldbank.org/" target="_blank" rel="noopener noreferrer">World Bank Open Data</a> · <a href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">Wikidata</a>. Data checked ${new Date(data.state.verifiedAt).toLocaleString()}. Country population year may differ by country; fields without source observations remain unavailable.`;
        bindControls();
        renderPopulationMap();
    }

    function refreshPoliticalViews() {
        if (!state.loaded) return;
        renderLeaders();
        updateVerified("leadersVerifiedAt", "Wikidata");
        if (data.state.ministersIssue) {
            $("leadersStatus").textContent += ` Foreign-minister query unavailable: ${data.state.ministersIssue}`;
        }
    }

    let initializationPromise = null;

    function init() {
        if (state.initialized) return Promise.resolve();
        if (initializationPromise) return initializationPromise;
        state.initializing = true;
        ["leadersStatus", "systemsCountries", "countryDirectory"].forEach(id => {
            const element = $(id);
            if (element) element.setAttribute("aria-busy", "true");
        });
        initializationPromise = (async () => {
            try {
                await data.load();
                state.loaded = true;
                state.initialized = true;
                prepareViews();
            } catch (error) {
                console.error("Global intelligence modules could not initialize:", error);
                ["leadersStatus", "systemsCountries", "countryDirectory", "populationSource"].forEach(id => {
                    if ($(id)) $(id).textContent = `Global data unavailable: ${error.message}`;
                });
            } finally {
                state.initializing = false;
                ["leadersStatus", "systemsCountries", "countryDirectory"].forEach(id => {
                    if ($(id)) $(id).removeAttribute("aria-busy");
                });
                if (!state.initialized) initializationPromise = null;
            }
        })();
        return initializationPromise;
    }

    window.EconIntel.GlobalModules = { init, refreshPoliticalViews };
}());
