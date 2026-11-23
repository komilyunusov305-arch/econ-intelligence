(function () {
    "use strict";

    const config = window.EconIntel.Config;
    const data = window.EconIntel.Data;
    const charts = window.EconIntel.Charts;
    const util = window.EconIntel.Utils;
    const $ = id => document.getElementById(id);
    const comparison = { countries: config.defaultComparison.slice() };
    const macroKeys = ["gdp", "inflation", "unemployment", "exportsShare"];
    const tradeKeys = ["exportsValue", "importsValue", "exportsShare"];
    const financeKeys = ["governmentDebt", "currentAccount", "imfGdp", "imfInflation", "imfUnemployment", "externalDebt", "reserves", "domesticCredit", "broadMoney", "realInterest"];
    const globeReportKeys = Object.keys(config.indicators);
    let activeMapRegion = "";
    let selectedYear = config.endYear;
    let selectedMapCountry = config.defaultCountry;
    let selectedMapName = "";
    const mapSelectedCountries = [];
    let comparisonPickerRender = null;
    let dataReady = false;
    let overviewMapMounted = false;

    function sourceName(key) {
        const indicator = config.indicators[key];
        return indicator && indicator.source === "imf" ? "IMF" : "World Bank";
    }

    function indicatorOptions(keys) {
        return keys.map(key => [key, `${config.indicators[key].label} · ${sourceName(key)}`]);
    }

    function countryOptions(regionNames) {
        return Object.values(data.state.countries)
            .filter(country => !regionNames || regionNames.includes(country.region))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(country => [country.code, country.name]);
    }

    function setSelect(id, options, selected) {
        const select = $(id);
        const current = selected || select.value;
        select.innerHTML = options.map(([value, label]) =>
            `<option value="${util.escape(value)}">${util.escape(label)}</option>`
        ).join("");
        select.disabled = options.length === 0;
        if (options.some(([value]) => value === current)) select.value = current;
        return select.value;
    }

    function pointForYear(key, countryCode) {
        const points = data.series(key, countryCode);
        for (let index = points.length - 1; index >= 0; index--) {
            if (points[index].year <= selectedYear && points[index].value !== null
                && Number.isFinite(points[index].value)) return points[index];
        }
        return null;
    }

    function normalizeCountryName(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function globalCountry(countryCode, countryName) {
        const globalData = window.EconIntel.GlobalData;
        if (!globalData) return null;
        if (countryCode && globalData.state.byCode[countryCode]) return globalData.state.byCode[countryCode];
        const name = normalizeCountryName(countryName);
        return name
            ? Object.values(globalData.state.byCode).find(country => normalizeCountryName(country.name) === name) || null
            : null;
    }

    function fillYearSelect() {
        const latestGrowth = data.latest("gdp", config.defaultCountry);
        selectedYear = latestGrowth ? latestGrowth.year : config.endYear;
        const years = Array.from({ length: config.endYear - config.startYear + 1 }, (_, index) => config.endYear - index);
        setSelect("yearSelect", years.map(year => [String(year), String(year)]), String(selectedYear));
    }

    function formatValue(value, unit) {
        return unit === "USD" ? util.money(value) : `${util.number(value)}${unit || ""}`;
    }

    function metricCard(label, point, unit, provider, note) {
        const value = point ? formatValue(point.value, unit) : "–";
        const year = point ? point.year : "No observation";
        return `<article class="kpi-card">
            <div class="kpi-label">${util.escape(label)}</div>
            <div class="kpi-value">${util.escape(value)}</div>
            <div class="kpi-foot"><span>${util.escape(note || provider)}</span><span class="kpi-year">${year}</span></div>
        </article>`;
    }

    function overviewMetricCard(label, point, unit) {
        const value = !point
            ? "Unavailable"
            : unit === "people"
                ? Number(point.value).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 })
                : formatValue(point.value, unit);
        const note = point
            ? `World Bank · ${point.year}`
            : `World Bank · no observation for ${selectedYear}`;
        return `<article class="kpi-card">
            <div class="kpi-label">${util.escape(label)}</div>
            <div class="kpi-value${point ? "" : " unavailable-value"}">${util.escape(value)}</div>
            <div class="kpi-foot"><span>${util.escape(note)}</span></div>
        </article>`;
    }

    function renderMetrics(element, items) {
        element.innerHTML = items.map(item =>
            metricCard(item.label, item.point, item.unit, item.provider || sourceName(item.key), item.note)
        ).join("");
    }

    function fillCountrySelects() {
        const options = countryOptions();
        [
            ["macroCountry", config.defaultCountry],
            ["tradeCountry", config.defaultCountry],
            ["financeCountry", config.defaultCountry],
            ["forecastCountry", config.defaultCountry],
            ["mapCountry", config.defaultCountry],
            ["overviewCountrySelect", config.defaultCountry],
            ["analystCountry", config.defaultCountry]
        ].forEach(([id, selected]) => setSelect(id, options, selected));
        setSelect("macroIndicator", indicatorOptions(macroKeys), "gdp");
        setSelect("tradeIndicator", [
            ["exportsShare", "Exports of GDP · World Bank"],
            ["exportsValue", "Exports · current US$ · World Bank"],
            ["importsValue", "Imports · current US$ · World Bank"],
            ["tradeBalance", "Trade balance · derived from World Bank"]
        ], "exportsShare");
        setSelect("financeIndicator", indicatorOptions(financeKeys), "governmentDebt");
        setSelect("forecastIndicator", indicatorOptions(["gdp", "inflation"]), "gdp");
        setSelect("compareIndicator", indicatorOptions(macroKeys), "gdp");
        setSelect("mapCountry", options, config.defaultCountry);
        fillYearSelect();
    }

    function setupComparisonPicker() {
        const root = $("comparePicker");
        const selected = comparison.countries.filter(code => data.state.countries[code]);
        comparison.countries = selected.length ? selected : [];
        root.innerHTML = `<label class="sr-only" for="compareCountrySearch">Search countries to compare</label>
            <input id="compareCountrySearch" class="picker-search" type="search" placeholder="Search countries…" autocomplete="off">
            <div class="picker-suggestions" aria-live="polite"></div><div class="picker-selected"></div>`;
        const input = $("compareCountrySearch");
        const suggestions = root.querySelector(".picker-suggestions");
        const chips = root.querySelector(".picker-selected");

        function render() {
            chips.innerHTML = comparison.countries.map(code => {
                const country = data.state.countries[code];
                const name = country ? country.name : code;
                return `<button class="selected-chip" type="button" data-remove="${util.escape(code)}" aria-label="Remove ${util.escape(name)}">${util.escape(name)} <span aria-hidden="true">×</span></button>`;
            }).join("");
            const query = input.value.trim().toLocaleLowerCase();
            if (!query) {
                suggestions.innerHTML = "";
                return;
            }
            const matches = Object.values(data.state.countries)
                .filter(country => !comparison.countries.includes(country.code) && country.name.toLocaleLowerCase().includes(query))
                .slice(0, 8);
            suggestions.innerHTML = matches.length
                ? matches.map(country => `<button class="picker-button" type="button" data-add="${util.escape(country.code)}">${util.escape(country.name)} <span aria-hidden="true">+</span></button>`).join("")
                : "<span class='picker-empty'>No matching countries</span>";
        }

        comparisonPickerRender = render;
        input.addEventListener("input", render);
        root.addEventListener("click", event => {
            const button = event.target.closest("button");
            if (!button || !root.contains(button)) return;
            if (button.dataset.add && !comparison.countries.includes(button.dataset.add)) {
                comparison.countries.push(button.dataset.add);
                input.value = "";
            } else if (button.dataset.remove) {
                const removedCode = button.dataset.remove;
                comparison.countries = comparison.countries.filter(code => code !== removedCode);
                mapSelectedCountries.splice(0, mapSelectedCountries.length, ...mapSelectedCountries.filter(code => code !== removedCode));
                if (selectedMapCountry === removedCode) {
                    selectedMapCountry = mapSelectedCountries[mapSelectedCountries.length - 1] || config.defaultCountry;
                }
            } else {
                return;
            }
            render();
            renderComparison();
            renderReports();
            renderDashboard();
            if (window.EconIntel.Globe) window.EconIntel.Globe.setSelectedCountries(mapSelectedCountries);
        });
        render();
    }

    function addComparisonCountry(code, mapName) {
        const country = code && data.state.countries[code];
        const profile = code && globalCountry(code);
        if (!country) {
            selectedMapCountry = code || "";
            selectedMapName = mapName;
            $("mapRegionLabel").textContent = profile
                ? [profile.region, profile.subregion].filter(Boolean).join(" · ") || "Region unavailable"
                : "Country profile";
            if (window.EconIntel.Globe) window.EconIntel.Globe.setFocusedCountry(code || "");
            renderMapCountry(code || "", mapName);
            $("globeStatus").textContent = profile
                ? `${profile.name} selected · not available in the World Bank comparison directory.`
                : `${mapName} selected · source details unavailable.`;
            return;
        }
        selectedMapName = country.name;
        const alreadyAdded = comparison.countries.includes(code);
        const alreadySelectedOnMap = mapSelectedCountries.includes(code);
        if (!alreadyAdded) {
            comparison.countries.push(code);
            if (comparisonPickerRender) comparisonPickerRender();
            renderComparison();
            renderReports();
        }
        if (!mapSelectedCountries.includes(code)) mapSelectedCountries.push(code);
        selectedMapCountry = code;
        $("overviewCountrySelect").value = code;
        if (window.EconIntel.IntelligenceMap) window.EconIntel.IntelligenceMap.setSelectedCountry(code);
        $("globeStatus").textContent = alreadySelectedOnMap
            ? `${country.name} is already selected on the map.`
            : alreadyAdded
                ? `${country.name} added to the map selection.`
                : `${country.name} added to the map selection and comparison.`;
        if (window.EconIntel.Globe) window.EconIntel.Globe.setSelectedCountries(mapSelectedCountries);
        renderMapRegion(country.region);
        $("mapCountry").value = code;
        renderMapCountry();
        renderDashboard();
    }

    function renderDashboard() {
        const selectedCodes = mapSelectedCountries.length ? mapSelectedCountries : [config.defaultCountry];
        const country = mapSelectedCountries.includes(selectedMapCountry)
            ? selectedMapCountry
            : (mapSelectedCountries[mapSelectedCountries.length - 1] || config.defaultCountry);
        const countryName = data.state.countries[country]?.name || country;
        const overviewCodes = mapSelectedCountries.length ? mapSelectedCountries : [config.defaultCountry];
        $("performanceTitle").textContent = "GDP growth · selected countries";
        $("performanceDescription").textContent = mapSelectedCountries.length
            ? `Annual GDP growth for ${mapSelectedCountries.length} map-selected ${mapSelectedCountries.length === 1 ? "country" : "countries"} in ${selectedYear}.`
            : `Select countries on the map to compare them here. Showing ${countryName} until a map selection is made.`;
        $("mapSelectionSummary").textContent = mapSelectedCountries.length
            ? `Selected on map: ${mapSelectedCountries.map(code => data.state.countries[code]?.name || code).join(", ")}`
            : "No map selection yet";
        $("downloadMapSelectionCsv").disabled = mapSelectedCountries.length === 0;
        $("focusTitle").textContent = mapSelectedCountries.length
            ? `${mapSelectedCountries.length} selected ${mapSelectedCountries.length === 1 ? "country" : "countries"}`
            : "Country snapshot";
        $("focusCountryCode").hidden = true;
        const overviewMetrics = [
            [config.overviewIndicators.worldGdp.label, "worldGdp", "USD"],
            [config.overviewIndicators.worldPopulation.label, "worldPopulation", "people"],
            ["Global inflation", "inflation", "%"],
            ["Global exports · current US$", "exportsValue", "USD"],
            ["Global imports · current US$", "importsValue", "USD"]
        ];
        $("kpis").innerHTML = overviewMetrics.map(([label, key, unit]) =>
            overviewMetricCard(label, pointForYear(key, "WLD"), unit)
        ).join("");
        $("focusList").innerHTML = overviewCodes.map(code => {
            const item = data.state.countries[code];
            const name = item?.name || code;
            const rows = macroKeys.map(key => {
                const point = pointForYear(key, code);
                return `<div class="selected-country-metric">
                    <span>${util.escape(config.indicators[key].label)}</span>
                    <strong>${point ? util.escape(formatValue(point.value, config.indicators[key].unit)) : "–"}${point ? `<small>${point.year}</small>` : "<small>No observation</small>"}</strong>
                </div>`;
            }).join("");
            return `<article class="selected-country-card">
                <header><strong>${util.escape(name)}</strong><span>${util.escape(code)}</span></header>
                <div class="selected-country-metrics">${rows}</div>
            </article>`;
        }).join("");
        const selectedRows = selectedCodes.map(code => {
            const point = pointForYear("gdp", code);
            return point ? { label: data.state.countries[code]?.name || code, value: point.value, year: point.year } : null;
        }).filter(Boolean);
        charts.renderBars($("gdpbars"), selectedRows, "%");
        $("src1").textContent = `Source: World Bank Open Data · ${config.indicators.gdp.code}`;
        const signalKeys = ["gdp", "inflation", "unemployment"];
        signalKeys.forEach((key, index) => {
            const point = pointForYear(key, "WLD");
            const target = $(`topbar${["Gdp", "Inflation", "Unemployment"][index]}`);
            target.textContent = point ? formatValue(point.value, config.indicators[key].unit) : "Unavailable";
            target.title = point
                ? `World Bank global aggregate · ${point.year}`
                : `World Bank global aggregate unavailable for ${selectedYear}`;
        });
        renderTicker();
    }

    function renderTicker() {
        const track = $("economicTickerTrack");
        const metrics = ["gdp", "inflation", "unemployment"];
        const countryCodes = ["USA", "CHN", "DEU", "IND", "UZB", "BRA", "JPN"];
        const entries = countryCodes.flatMap(code => {
            const country = data.state.countries[code];
            if (!country) return [];
            return metrics.map(key => {
                const point = data.latest(key, code);
                if (!point) return null;
                return `<span class="ticker-item"><b>${util.escape(country.code)}</b> ${util.escape(config.indicators[key].label)} <strong>${util.escape(formatValue(point.value, config.indicators[key].unit))}</strong> <small>${point.year} · World Bank</small></span>`;
            }).filter(Boolean);
        });
        if (!entries.length) {
            track.textContent = "No World Bank observations are loaded · No simulated values are shown";
            return;
        }
        const content = entries.join("");
        track.innerHTML = `${content}<span class="ticker-duplicate" aria-hidden="true">${content}</span>`;
    }

    function renderMacro() {
        const country = $("macroCountry").value;
        const key = $("macroIndicator").value;
        renderMetrics($("macroKpis"), macroKeys.map(metric => ({
            key: metric, label: config.indicators[metric].label, point: pointForYear(metric, country), unit: config.indicators[metric].unit, note: `${country} · ${selectedYear}`
        })));
        $("macroSource").textContent = `Source: World Bank Open Data · ${config.indicators[key].code}`;
        $("macroChart").setAttribute("aria-label", `${config.indicators[key].label} for ${data.state.countries[country]?.name || country}`);
        $("macroChart").dataset.measure = config.indicators[key].label;
        charts.renderLine($("macroChart"), [{
            label: data.state.countries[country]?.name || country,
            points: data.series(key, country).map(point => ({ year: point.year, value: point.value }))
        }], {
            unit: config.indicators[key].unit,
            label: `${config.indicators[key].label} history`,
            selectedYear,
            empty: "No World Bank observations are available for this country and indicator."
        });
    }

    function tradeBalanceSeries(countryCode) {
        const importsByYear = new Map(data.series("importsValue", countryCode).filter(point => point.value !== null).map(point => [point.year, point.value]));
        return data.series("exportsValue", countryCode)
            .filter(point => point.value !== null && importsByYear.has(point.year))
            .map(point => ({ year: point.year, value: point.value - importsByYear.get(point.year) }));
    }

    function latestTradeBalance(countryCode) {
        const imports = new Map(data.series("importsValue", countryCode)
            .filter(point => point.year <= selectedYear && point.value !== null)
            .map(point => [point.year, point.value]));
        const exports = data.series("exportsValue", countryCode);
        for (let index = exports.length - 1; index >= 0; index--) {
            const point = exports[index];
            if (point.year <= selectedYear && point.value !== null && imports.has(point.year)) {
                return { year: point.year, value: point.value - imports.get(point.year) };
            }
        }
        return null;
    }

    function renderTrade() {
        const country = $("tradeCountry").value;
        const key = $("tradeIndicator").value;
        const balance = latestTradeBalance(country);
        const items = [
            { key: "exportsValue", label: "Exports", point: pointForYear("exportsValue", country), unit: "USD", note: `Current US$ · ${selectedYear}` },
            { key: "importsValue", label: "Imports", point: pointForYear("importsValue", country), unit: "USD", note: `Current US$ · ${selectedYear}` },
            { key: "exportsShare", label: "Exports of GDP", point: pointForYear("exportsShare", country), unit: "%", note: `World Bank · ${selectedYear}` },
            { label: "Trade balance", point: balance, unit: "USD", provider: "World Bank", note: `Derived · ${selectedYear}` }
        ];
        renderMetrics($("tradeKpis"), items);
        const countryName = data.state.countries[country]?.name || country;
        let points;
        let unit;
        let label;
        let source;
        if (key === "tradeBalance") {
            points = tradeBalanceSeries(country);
            unit = "USD";
            label = "Trade balance";
            source = "Derived from World Bank exports and imports · current US$";
        } else {
            points = data.series(key, country);
            unit = config.indicators[key].unit;
            label = config.indicators[key].label;
            source = `World Bank Open Data · ${config.indicators[key].code}`;
        }
        $("tradeChartTitle").textContent = `${label} · ${countryName}`;
        $("tradeSource").textContent = `Source: ${source}`;
        charts.renderLine($("tradeChart"), [{ label: countryName, points }], {
            unit, label: `${label} history for ${countryName}`,
            selectedYear,
            empty: "No trade observations are available for this country and measure."
        });
    }

    function renderFinance() {
        const country = $("financeCountry").value;
        const key = $("financeIndicator").value;
        renderMetrics($("financialKpis"), financeKeys.slice(0, 5).map(metric => ({
            key: metric, label: config.indicators[metric].label, point: pointForYear(metric, country), unit: config.indicators[metric].unit, note: `World Bank · ${selectedYear}`
        })));
        const countryName = data.state.countries[country]?.name || country;
        $("financeChartTitle").textContent = `${config.indicators[key].label} · ${countryName}`;
        $("financeSource").textContent = `Source: World Bank Open Data · ${config.indicators[key].code}. Availability varies by country and indicator.`;
        charts.renderLine($("financeChart"), [{
            label: countryName, points: data.series(key, country)
        }], {
            unit: config.indicators[key].unit,
            label: `${config.indicators[key].label} history for ${countryName}`,
            selectedYear,
            empty: "No World Bank observations are available for this country and indicator."
        });
        renderGlobalFinanceTable();
    }

    function renderGlobalFinanceTable() {
        const table = $("financeGlobalTable");
        if (!table) return;
        const keys = ["governmentDebt", "currentAccount", "imfGdp", "imfInflation", "imfUnemployment", "externalDebt", "reserves", "domesticCredit"];
        const countries = Object.values(data.state.countries)
            .filter(item => item.region && item.region !== "Aggregates")
            .sort((a, b) => a.name.localeCompare(b.name));
        let observationCount = 0;
        table.querySelector("tbody").innerHTML = countries.map(item => {
            const cells = keys.map(metric => {
                const point = data.latest(metric, item.code);
                if (point) observationCount++;
                const unit = config.indicators[metric].unit;
                return `<td class="num">${util.escape(point ? formatValue(point.value, unit) : "–")}<small>${point ? point.year : "No observation"}</small></td>`;
            }).join("");
            return `<tr><td>${util.escape(item.name)}<small>${util.escape(item.code)}</small></td>${cells}</tr>`;
        }).join("");
        $("financeCoverageCount").textContent = `${observationCount} observations · ${countries.length} countries`;
    }

    function renderComparison() {
        const table = $("compareTable");
        $("compareCsv").disabled = comparison.countries.length === 0;
        if (!comparison.countries.length) {
            table.innerHTML = "<caption class='sr-only'>Latest World Bank indicator observations for selected countries</caption><tbody><tr><td class='empty-state'>Add a country above to build a comparison.</td></tr></tbody>";
            charts.renderLine($("compareChart"), [], { empty: "Select at least one country to compare historical observations." });
            renderReports();
            return;
        }
        const keys = macroKeys;
        const head = `<thead><tr><th scope="col">Country</th>${keys.map(key => `<th scope="col">${util.escape(config.indicators[key].label)} (${util.escape(config.indicators[key].unit)})</th>`).join("")}</tr></thead>`;
        const body = comparison.countries.map(code => {
            const name = data.state.countries[code]?.name || code;
            const cells = keys.map(key => {
                const point = pointForYear(key, code);
                return `<td class="num">${point ? `${util.escape(formatValue(point.value, config.indicators[key].unit))}<small>${point.year}</small>` : "–"}</td>`;
            }).join("");
            return `<tr><td>${util.escape(name)}</td>${cells}</tr>`;
        }).join("");
        table.innerHTML = `<caption class="sr-only">Latest World Bank indicator observations for selected countries</caption>${head}<tbody>${body}</tbody>`;
        const indicator = $("compareIndicator").value;
        $("compareChartTitle").textContent = `${config.indicators[indicator].label} over time`;
        charts.renderLine($("compareChart"), comparison.countries.map((code, index) => ({
            label: data.state.countries[code]?.name || code,
            points: data.series(indicator, code),
            color: config.colors[index % config.colors.length]
        })), {
            unit: config.indicators[indicator].unit,
            label: `${config.indicators[indicator].label} country comparison`,
            selectedYear,
            empty: "No observations are available for the selected countries and indicator."
        });
        renderReports();
    }

    function renderForecast() {
        const country = $("forecastCountry").value;
        const indicator = $("forecastIndicator").value;
        const name = data.state.countries[country]?.name || country;
        const point = pointForYear(indicator, country);
        $("forecastKpis").innerHTML = `${metricCard(config.indicators[indicator].label, point, config.indicators[indicator].unit, sourceName(indicator), name)}
            <article class="kpi-card forecast-unavailable"><div class="kpi-label">FORECAST PROVIDER</div><div class="kpi-value">Not connected</div><div class="kpi-foot"><span>No projected values</span><span class="kpi-year">—</span></div></article>`;
        $("forecastChartTitle").textContent = `${config.indicators[indicator].label} · ${name} · observed history`;
        charts.renderLine($("forecastChart"), [{
            label: `${name} · observed`,
            points: data.series(indicator, country)
        }], {
            unit: config.indicators[indicator].unit,
            label: `Observed ${config.indicators[indicator].label} history for ${name}`,
            selectedYear,
            empty: "No source observations are available for this country and indicator."
        });
    }

    function renderMapRegion(regionName) {
        activeMapRegion = regionName;
        $("mapRegionLabel").textContent = regionName || "Select a country on the globe";
        const regions = config.regions[regionName];
        const selected = $("mapCountry").value;
        const options = countryOptions(regions);
        setSelect("mapCountry", options, selected);
        renderMapCountry();
    }

    function renderMapCountry(codeOverride, fallbackName) {
        const code = codeOverride === undefined ? $("mapCountry").value : codeOverride;
        const country = data.state.countries[code];
        const profile = globalCountry(code, fallbackName || selectedMapName);
        const displayCountry = country || profile;
        if (!displayCountry) {
            const name = fallbackName || selectedMapName;
            const unavailableRows = ["Capital", "Region", "Population", "Area", "Currency", "GDP", "GDP per capita"]
                .map(label => `<div class="map-profile-row"><span>${label}</span><b>Unavailable</b></div>`).join("");
            $("mapCountryDetails").innerHTML = `<div class="map-country-heading"><strong>${util.escape(name || "Country details")}</strong><span>—</span></div>
                <div class="map-profile-list">${unavailableRows}</div><p class="empty-state">No matching source country record is available.</p>`;
            $("mapCompareLink").hidden = true;
            if (!name) $("overviewCountryDetails").innerHTML = "<p class='empty-state'>No source country record is available for this selection.</p>";
            return;
        }
        if (!country) {
            const unavailable = value => value === null || value === undefined || value === "" ? "Unavailable" : value;
            const population = profile.population
                ? `${Number(profile.population.value).toLocaleString("en-US")}${profile.population.year ? ` · ${profile.population.year}` : ""}`
                : profile.restPopulation !== null
                    ? Number(profile.restPopulation).toLocaleString("en-US")
                    : null;
            const currencies = (profile.currencyCodes || []).map((currencyCode, index) =>
                [currencyCode, profile.currencies && profile.currencies[index]].filter(Boolean).join(" · ")
            ).join(", ");
            const profileRows = [
                ["Capital", unavailable(profile.capital)],
                ["Region", unavailable([profile.region, profile.subregion].filter(Boolean).join(" · "))],
                ["Population", unavailable(population)],
                ["Area", profile.area === null || profile.area === undefined ? "Unavailable" : `${Number(profile.area).toLocaleString("en-US")} km²`],
                ["Currency", unavailable(currencies)],
                ["GDP", profile.gdp ? `${util.money(profile.gdp.value)} · ${profile.gdp.year}` : "Unavailable"],
                ["GDP per capita", profile.gdpPerCapita ? `${util.money(profile.gdpPerCapita.value)} · ${profile.gdpPerCapita.year}` : "Unavailable"]
            ].map(([label, value]) => `<div class="map-profile-row"><span>${util.escape(label)}</span><b>${util.escape(value)}</b></div>`).join("");
            $("mapCountryDetails").innerHTML = `<div class="map-country-heading"><strong>${util.escape(displayCountry.name)}</strong><span>${util.escape(code.startsWith("name:") ? "—" : code)}</span></div>
                <div class="map-profile-list">${profileRows}</div><p class="empty-state">Economic comparison indicators are unavailable for this country.</p>`;
            $("mapCompareLink").hidden = true;
            if (window.EconIntel.Globe) window.EconIntel.Globe.setFocusedCountry(code);
            return;
        }
        $("mapCompareLink").hidden = false;
        $("overviewCountrySelect").value = code;
        $("overviewCountryName").textContent = country.name;
        $("overviewCountryRegion").textContent = country.region;
        $("overviewCountryCode").textContent = country.code;
        if (window.EconIntel.Globe) window.EconIntel.Globe.setFocusedCountry(code);
        if (window.EconIntel.IntelligenceMap) window.EconIntel.IntelligenceMap.setSelectedCountry(code);

        const unavailable = value => value === null || value === undefined || value === "" ? "Unavailable" : value;
        const population = profile && profile.population
            ? `${Number(profile.population.value).toLocaleString("en-US")}${profile.population.year ? ` · ${profile.population.year}` : ""}`
            : profile && profile.restPopulation !== null
                ? Number(profile.restPopulation).toLocaleString("en-US")
                : null;
        const currencies = profile && (profile.currencyCodes || []).map((currencyCode, index) =>
            [currencyCode, profile.currencies && profile.currencies[index]].filter(Boolean).join(" · ")
        ).join(", ");
        const profileRows = [
            ["Capital", unavailable(profile && profile.capital)],
            ["Region", unavailable(profile ? [profile.region, profile.subregion].filter(Boolean).join(" · ") : country.region)],
            ["Population", unavailable(population)],
            ["Area", !profile || profile.area === null || profile.area === undefined ? "Unavailable" : `${Number(profile.area).toLocaleString("en-US")} km²`],
            ["Currency", unavailable(currencies)],
            ["GDP", profile && profile.gdp ? `${util.money(profile.gdp.value)} · ${profile.gdp.year}` : "Unavailable"],
            ["GDP per capita", profile && profile.gdpPerCapita ? `${util.money(profile.gdpPerCapita.value)} · ${profile.gdpPerCapita.year}` : "Unavailable"]
        ].map(([label, value]) => `<div class="map-profile-row"><span>${util.escape(label)}</span><b>${util.escape(value)}</b></div>`).join("");
        const keys = ["gdp", "inflation", "unemployment", "exportsShare"];
        const rows = keys.map(key => {
            const point = pointForYear(key, code);
            return `<div class="map-data-row"><span>${util.escape(config.indicators[key].label)}</span><b>${point ? util.escape(formatValue(point.value, config.indicators[key].unit)) : "Unavailable"}</b><small>${point ? point.year : ""}</small></div>`;
        }).join("");
        $("mapCountryDetails").innerHTML = `<div class="map-country-heading"><strong>${util.escape(country.name)}</strong><span>${util.escape(country.code)}</span></div>
            <div class="map-profile-list">${profileRows}</div><p class="map-economy-heading">Economic indicators</p>${rows}`;
        $("overviewCountryDetails").innerHTML = rows;
        $("mapCompareLink").dataset.country = country.code;
        $("overviewCompareLink").dataset.country = country.code;
    }

    function globeExportData() {
        const code = selectedMapCountry || $("mapCountry").value || config.defaultCountry;
        const country = data.state.countries[code] || null;
        const profile = globalCountry(code, selectedMapName) || {};
        const name = country && country.name || profile.name || selectedMapName || code;
        const indicators = globeReportKeys.map(key => {
            const indicator = config.indicators[key];
            const selected = pointForYear(key, code);
            return {
                key,
                label: indicator.label,
                unit: indicator.unit,
                source: sourceName(key),
                sourceCode: indicator.code,
                selectedYear: selectedYear,
                selectedValue: selected ? selected.value : null,
                latest: data.latest(key, code),
                history: data.series(key, code).filter(point => point.value !== null && Number.isFinite(point.value))
            };
        });
        const currencies = (profile.currencyCodes || []).map((currencyCode, index) =>
            [currencyCode, profile.currencies && profile.currencies[index]].filter(Boolean).join(" · ")
        ).filter(Boolean);
        const population = profile.population && profile.population.value !== null
            ? profile.population.value
            : profile.restPopulation;
        const populationValue = population !== null && population !== undefined && Number.isFinite(Number(population))
            ? Number(population)
            : null;
        const areaValue = profile.area !== null && profile.area !== undefined && Number.isFinite(Number(profile.area))
            ? Number(profile.area)
            : null;
        const sourceUrl = code && !code.startsWith("name:")
            ? `https://api.worldbank.org/v2/country/${encodeURIComponent(code)}/indicator/`
            : "https://data.worldbank.org/";
        const hostname = window.location.hostname.toLocaleLowerCase();
        const localHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
        const liveUrl = !localHost && (window.location.protocol === "https:" || window.location.protocol === "http:")
            ? new URL("#world-map", window.location.href).href
            : null;
        return {
            country: {
                code,
                name,
                flagUrl: profile.flagUrl || null,
                flagEmoji: profile.flagEmoji || "",
                capital: profile.capital || null,
                region: [profile.region || country && country.region, profile.subregion].filter(Boolean).join(" · ") || null,
                population: populationValue,
                populationYear: profile.population && profile.population.year || null,
                area: areaValue,
                currencies,
                gdp: profile.gdp && profile.gdp.value !== null ? profile.gdp.value : null,
                gdpYear: profile.gdp && profile.gdp.year || null,
                gdpPerCapita: profile.gdpPerCapita && profile.gdpPerCapita.value !== null ? profile.gdpPerCapita.value : null,
                gdpPerCapitaYear: profile.gdpPerCapita && profile.gdpPerCapita.year || null,
                officialName: profile.officialName || null
            },
            indicators,
            selectedYear,
            viewMode: window.EconIntel.Globe ? window.EconIntel.Globe.getView() : "globe",
            generatedAt: new Date().toISOString(),
            liveUrl,
            sources: [
                ...indicators.filter((indicator, index, list) =>
                    list.findIndex(candidate => candidate.sourceCode === indicator.sourceCode) === index
                ).map(indicator => ({
                    label: `World Bank · ${indicator.label}`,
                    url: sourceUrl === "https://data.worldbank.org/"
                        ? sourceUrl
                        : `${sourceUrl}${encodeURIComponent(indicator.sourceCode)}?format=json`
                })),
                { label: "REST Countries dataset", url: "https://github.com/mledoze/countries" },
                { label: "Natural Earth boundaries", url: "https://www.naturalearthdata.com/" }
            ]
        };
    }

    function renderReports() {
        const countries = comparison.countries;
        const keys = Object.keys(config.indicators);
        const observations = countries.reduce((sum, code) => sum + keys.reduce((count, key) =>
            count + (pointForYear(key, code) ? 1 : 0), 0), 0);
        $("reportStats").innerHTML = `<article><span>Selected year</span><strong>${selectedYear}</strong></article>
            <article><span>Selected countries</span><strong>${countries.length}</strong></article>
            <article><span>Available values for year</span><strong>${observations.toLocaleString("en-US")}</strong></article>`;
        $("reportDataStatus").textContent = observations ? "SOURCE DATA LOADED" : "NO OBSERVATIONS LOADED";
        $("downloadReportCsv").disabled = !countries.length || !observations;
        $("downloadReportJson").disabled = !countries.length || !observations;
        $("compareCsv").disabled = !countries.length || !observations;
    }

    function reportRows() {
        return comparison.countries.map(code => {
            const values = {};
            Object.keys(config.indicators).forEach(key => {
                const point = pointForYear(key, code);
                values[key] = point ? { value: point.value, year: point.year } : null;
            });
            return { code, country: data.state.countries[code]?.name || code, values };
        });
    }

    function downloadFile(filename, content, mimeType) {
        const prefix = mimeType.indexOf("text/csv") === 0 ? "\ufeff" : "";
        const blob = new Blob([prefix, content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportDocument(format) {
        const rows = reportRows();
        const indicatorKeys = Object.keys(config.indicators);
        if (format === "pdf" && window.jspdf) {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(18);
            pdf.text("ECON Intelligence", 14, 16);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);
            pdf.text(`Selected year: ${selectedYear} | ${rows.length} countries | ${new Date().toLocaleString()}`, 14, 23);
            let y = 34;
            rows.forEach(row => {
                if (y > 185) { pdf.addPage(); y = 18; }
                pdf.setFont("helvetica", "bold");
                pdf.text(row.country, 14, y);
                pdf.setFont("helvetica", "normal");
                y += 6;
                indicatorKeys.forEach(key => {
                    const point = row.values[key];
                    const indicator = config.indicators[key];
                    const value = point
                        ? `${util.number(point.value)}${indicator.unit === "%" ? "%" : indicator.unit === "USD" ? " USD" : ""} (${point.year})`
                        : "— (No observation)";
                    pdf.text(`${indicator.label}: ${value}`, 18, y);
                    y += 5;
                    if (y > 190) { pdf.addPage(); y = 18; }
                });
                y += 4;
            });
            pdf.setFontSize(8);
            pdf.text("Source observations only. Missing values remain unavailable; no estimates or projections are synthesized.", 14, 198);
            pdf.save(`econ-intelligence-report-${selectedYear}.pdf`);
            return;
        }
        if (format === "pptx" && window.PptxGenJS) {
            const pptx = new window.PptxGenJS();
            pptx.layout = "LAYOUT_WIDE";
            pptx.author = "ECON Intelligence";
            pptx.title = `Economic report ${selectedYear}`;
            const cover = pptx.addSlide();
            cover.background = { color: "0B1017" };
            cover.addText("ECON INTELLIGENCE", { x: 0.8, y: 1.6, w: 11.7, h: 0.5, color: "55D6A5", bold: true, fontSize: 20 });
            cover.addText(`Economic report · ${selectedYear}`, { x: 0.8, y: 2.3, w: 11.7, h: 0.8, color: "FFFFFF", bold: true, fontSize: 34 });
            cover.addText(`${rows.length} selected countries`, { x: 0.8, y: 3.3, w: 5, h: 0.4, color: "9BA8B7", fontSize: 16 });
            rows.forEach(row => {
                const slide = pptx.addSlide();
                slide.background = { color: "0B1017" };
                slide.addText(row.country, { x: 0.6, y: 0.45, w: 12.1, h: 0.6, color: "FFFFFF", bold: true, fontSize: 26 });
                indicatorKeys.forEach((key, index) => {
                    const point = row.values[key];
                    const indicator = config.indicators[key];
                    const column = index % 2;
                    const line = Math.floor(index / 2);
                    const value = point
                        ? `${util.number(point.value)}${indicator.unit === "%" ? "%" : indicator.unit === "USD" ? " USD" : ""}`
                        : "—";
                    slide.addText(indicator.label, { x: 0.7 + column * 6.35, y: 1.45 + line * 1.05, w: 5.8, h: 0.3, color: "9BA8B7", fontSize: 11 });
                    slide.addText(`${value}${point ? `  ·  ${point.year}` : "  ·  No observation"}`, { x: 0.7 + column * 6.35, y: 1.78 + line * 1.05, w: 5.8, h: 0.45, color: "55D6A5", bold: true, fontSize: 18 });
                });
                slide.addText("Source observations only · No synthetic values", { x: 0.7, y: 7.05, w: 12, h: 0.22, color: "667487", fontSize: 8 });
            });
            pptx.writeFile({ fileName: `econ-intelligence-report-${selectedYear}.pptx` });
            return;
        }
        if (format === "doc") {
            const tableRows = rows.map(row => {
                const cells = indicatorKeys.map(key => {
                    const point = row.values[key];
                    const indicator = config.indicators[key];
                    return `<td>${point ? `${util.number(point.value)}${indicator.unit === "%" ? "%" : indicator.unit === "USD" ? " USD" : ""}` : "—"}<small>${point ? point.year : "No observation"}</small></td>`;
                }).join("");
                return `<tr><th>${util.escape(row.country)}<small>${util.escape(row.code)}</small></th>${cells}</tr>`;
            }).join("");
            const html = `<!doctype html><html><head><meta charset="utf-8"><title>ECON Intelligence · Word report</title>
            <style>
                @page { size: A4 landscape; margin: 14mm; }
                body { font-family: Arial, sans-serif; color: #17212b; }
                h1 { font-size: 24px; margin-bottom: 4px; }
                .subtitle { color: #5a6673; margin-bottom: 18px; }
                table { width: 100%; border-collapse: collapse; font-size: 9px; }
                th, td { border: 1px solid #cbd4dc; padding: 7px; vertical-align: top; text-align: left; }
                thead th { background: #edf3f7; }
                tbody th { width: 150px; }
                td small, th small { display: block; color: #657382; margin-top: 3px; }
                .note { margin-top: 16px; color: #657382; font-size: 9px; }
            </style></head><body>
            <h1>ECON Intelligence · Word-compatible HTML report</h1>
            <p class="subtitle">Selected year: ${selectedYear} · Exported: ${new Date().toLocaleString()}</p>
            <table><thead><tr><th>Country</th>${indicatorKeys.map(key => `<th>${util.escape(config.indicators[key].label)}<small>${util.escape(config.indicators[key].unit)}</small></th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table>
            <p class="note">Source observations only. Missing values remain unavailable; no estimates or projections are synthesized.</p>
            </body></html>`;
            downloadFile(`econ-intelligence-report-${selectedYear}.html`, html, "text/html;charset=utf-8");
            return;
        }
    }

    function askExportFormat() {
        if (!comparison.countries.length) return;
        const dialog = $("exportFormatDialog");
        if (!dialog) return;
        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        }
    }

    function exportCsv() {
        if (!comparison.countries.length) return;
        const keys = Object.keys(config.indicators);
        const headers = ["Country", "Year", ...keys.map(key => `${config.indicators[key].label} (${config.indicators[key].unit})`)];
        const rows = [headers, ...reportRows().map(row => [
            row.country,
            selectedYear,
            ...keys.map(key => {
                const point = row.values[key];
                return point ? point.value.toFixed(2) : "";
            })
        ])];
        const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
        downloadFile("econ-intelligence-report.csv", csv, "text/csv;charset=utf-8");
    }

    function exportMapSelectionCsv() {
        if (!mapSelectedCountries.length) return;
        const headers = ["Country code", "Country", "Year", ...macroKeys.map(key =>
            `${config.indicators[key].label} (${config.indicators[key].unit})`
        )];
        const rows = [headers, ...mapSelectedCountries.map(code => [
            code,
            data.state.countries[code]?.name || code,
            selectedYear,
            ...macroKeys.map(key => {
                const point = pointForYear(key, code);
                return point ? point.value.toFixed(2) : "";
            })
        ])];
        const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
        downloadFile(`map-selected-countries-${selectedYear}.csv`, csv, "text/csv;charset=utf-8");
    }

    function exportJson() {
        if (!comparison.countries.length) return;
        const countryData = comparison.countries.map(code => {
            const country = data.state.countries[code];
            const indicators = {};
            Object.entries(config.indicators).forEach(([key, indicator]) => {
                indicators[key] = {
                    label: indicator.label,
                    unit: indicator.unit,
                    source: sourceName(key),
                    selectedYear: pointForYear(key, code),
                    observations: data.series(key, code)
                };
            });
            return { code, country: country ? country.name : code, year: selectedYear, indicators };
        });
        const report = {
            title: "ECON Intelligence data export",
            exportedAt: new Date().toISOString(),
            selectedYear,
            note: "Source observations only; no synthetic values are generated. Source-reported estimates are not generated by this app.",
            countries: countryData
        };
        downloadFile("econ-intelligence-report.json", JSON.stringify(report, null, 2), "application/json;charset=utf-8");
    }

    function bindNavigation() {
        document.addEventListener("click", event => {
            const link = event.target.closest("[data-view]");
            if (!link) return;
            const viewId = link.dataset.view;
            if (!$(viewId)) return;
            event.preventDefault();
            if (["mapCompareLink", "overviewCompareLink"].includes(link.id) && link.dataset.country) {
                addComparisonCountry(link.dataset.country, data.state.countries[link.dataset.country]?.name || link.dataset.country);
            }
            activateView(viewId);
            history.replaceState(null, "", `#${viewId}`);
        });
        window.addEventListener("hashchange", () => {
            const viewId = window.location.hash.slice(1);
            if ($(viewId)) activateView(viewId);
        });
    }

    function activateView(viewId) {
        const target = $(viewId);
        if (!target || !target.classList.contains("view")) return;
        if (["world-leaders", "government-systems", "population", "country-database", "world-map"].includes(viewId)
            && window.EconIntel.GlobalModules) {
            window.EconIntel.GlobalModules.init().then(() => {
                if (viewId !== "world-map" || $("world-map").hidden) return;
                if (window.EconIntel.Globe) {
                    window.EconIntel.Globe.refreshCountries();
                    if (selectedMapCountry.startsWith("name:")) {
                        const resolved = window.EconIntel.Globe.resolveCountryCode(selectedMapName);
                        if (resolved && !resolved.startsWith("name:")) selectedMapCountry = resolved;
                    }
                    window.EconIntel.Globe.setFocusedCountry(selectedMapCountry);
                }
                const profile = globalCountry(selectedMapCountry, selectedMapName);
                if (!data.state.countries[selectedMapCountry] && profile) {
                    $("mapRegionLabel").textContent = [profile.region, profile.subregion].filter(Boolean).join(" · ") || "Region unavailable";
                }
                renderMapCountry(selectedMapCountry, selectedMapName);
            });
        }
        if (viewId === "organizations" && window.EconIntel.Organizations) {
            window.EconIntel.Organizations.init();
        }
        document.querySelectorAll(".view").forEach(view => {
            const active = view === target;
            view.classList.toggle("active", active);
            view.hidden = !active;
        });
        document.querySelectorAll(".nav-item[data-view]").forEach(link => {
            const active = link.dataset.view === viewId;
            link.classList.toggle("active", active);
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
        $("currentSection").textContent = target.querySelector("h1").textContent;
        if (viewId === "dashboard" && window.EconIntel.IntelligenceMap) {
            mountOverviewMap();
            window.setTimeout(() => window.EconIntel.IntelligenceMap.invalidateSize(), 0);
        }
    }

    function bindControls() {
        ["macroCountry", "macroIndicator"].forEach(id => $(id).addEventListener("change", renderMacro));
        ["tradeCountry", "tradeIndicator"].forEach(id => $(id).addEventListener("change", renderTrade));
        ["financeCountry", "financeIndicator"].forEach(id => $(id).addEventListener("change", renderFinance));
        ["forecastCountry", "forecastIndicator"].forEach(id => $(id).addEventListener("change", renderForecast));
        $("compareIndicator").addEventListener("change", renderComparison);
        $("mapCountry").addEventListener("change", () => {
            selectedMapCountry = $("mapCountry").value || config.defaultCountry;
            selectedMapName = data.state.countries[selectedMapCountry]?.name || "";
            $("overviewCountrySelect").value = selectedMapCountry;
            renderMapCountry();
            renderDashboard();
        });
        $("overviewCountrySelect").addEventListener("change", () => {
            const code = $("overviewCountrySelect").value;
            const country = data.state.countries[code];
            if (!country) return;
            addComparisonCountry(code, country.name);
            renderMapRegion(country.region);
        });
        $("yearSelect").addEventListener("change", () => {
            selectedYear = Number($("yearSelect").value);
            renderAll();
        });

        document.querySelectorAll("[data-news-filter]").forEach(button => button.addEventListener("click", () => {
            const filter = button.dataset.newsFilter;
            document.querySelectorAll("[data-news-filter]").forEach(item => item.classList.toggle("active", item === button));
            let count = 0;
            document.querySelectorAll("[data-news-source]").forEach(card => {
                const visible = filter === "all" || card.dataset.newsSource === filter;
                card.hidden = !visible;
                if (visible) count++;
            });
            $("newsFilterStatus").textContent = filter === "all" ? `Showing all ${count} source links.` : `Showing ${count} ${button.textContent.toLowerCase()} sources.`;
        }));

        let analystConfigured = false;
        const analystResponse = $("analystResponse");
        const analystProviderStatus = $("analystProviderStatus");
        const showAnalystResponse = (title, text) => {
            analystResponse.innerHTML = "<strong></strong><span></span>";
            analystResponse.querySelector("strong").textContent = title;
            analystResponse.querySelector("span").textContent = text;
        };
        const checkAnalystAvailability = async () => {
            analystProviderStatus.textContent = "Checking AI service…";
            try {
                const controller = typeof AbortController === "function" ? new AbortController() : null;
                let timeout;
                let result;
                try {
                    const request = fetch("/.netlify/functions/economic-analyst", {
                        method: "GET",
                        headers: { Accept: "application/json" },
                        ...(controller ? { signal: controller.signal } : {})
                    }).then(async response => {
                        const contentType = response.headers.get("Content-Type") || "";
                        const body = response.ok && contentType.includes("application/json")
                            ? await response.json()
                            : {};
                        return { response, body };
                    });
                    const timeoutRequest = new Promise((resolve, reject) => {
                        timeout = window.setTimeout(() => {
                            if (controller) controller.abort();
                            reject(new Error("AI service check timed out."));
                        }, 8000);
                    });
                    result = await Promise.race([request, timeoutRequest]);
                } finally {
                    if (timeout) window.clearTimeout(timeout);
                }
                if (!result.response.ok) throw new Error(`AI function returned HTTP ${result.response.status}.`);
                analystConfigured = result.response.ok && result.body.configured === true;
                analystProviderStatus.textContent = analystConfigured
                    ? `Server configured · ${result.body.model}`
                    : "AI provider not configured";
                if (!analystConfigured) {
                    showAnalystResponse("AI provider not configured", "Add OPENAI_API_KEY to this Netlify site's server-side environment variables and deploy the site again.");
                }
            } catch (error) {
                analystConfigured = false;
                analystProviderStatus.textContent = "AI service unavailable";
                showAnalystResponse("AI service unavailable", "The Netlify function could not be reached. Deploy this site with Netlify Functions enabled; no prompt was sent.");
                console.warn("Could not check AI provider configuration:", error);
            }
        };
        $("analystForm").addEventListener("submit", async event => {
            event.preventDefault();
            const prompt = $("analystPrompt").value.trim();
            if (!prompt) {
                showAnalystResponse("Enter a question first", "Your prompt was not sent.");
                $("analystPrompt").focus();
                return;
            }
            if (!analystConfigured) {
                showAnalystResponse("AI provider unavailable", "No prompt was sent. Configure OPENAI_API_KEY in Netlify and ensure the Netlify function is deployed.");
                return;
            }
            const countryCode = $("analystCountry").value;
            const country = data.state.countries[countryCode];
            const seenIndicators = new Set();
            const observations = Object.entries(config.indicators).flatMap(([key, indicator]) => {
                if (seenIndicators.has(indicator.code)) return [];
                seenIndicators.add(indicator.code);
                return data.series(key, countryCode)
                    .filter(point => point.year <= selectedYear && point.value !== null)
                    .slice(-10)
                    .map(point => ({
                        indicator: indicator.label,
                        code: indicator.code,
                        value: point.value,
                        unit: indicator.unit,
                        year: point.year,
                        source: sourceName(key)
                    }));
            });
            const submitButton = $("analystForm").querySelector('[type="submit"]');
            submitButton.disabled = true;
            analystResponse.setAttribute("aria-busy", "true");
            showAnalystResponse("Analyzing source observations…", "The question and available country observations are being sent to the configured AI provider.");
            try {
                const controller = typeof AbortController === "function" ? new AbortController() : null;
                let timeout;
                let result;
                try {
                    const request = fetch("/.netlify/functions/economic-analyst", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Accept: "application/json" },
                        body: JSON.stringify({
                            question: prompt,
                            country: country ? country.name : countryCode,
                            observations
                        }),
                        ...(controller ? { signal: controller.signal } : {})
                    }).then(async response => {
                        const contentType = response.headers.get("Content-Type") || "";
                        const body = contentType.includes("application/json")
                            ? await response.json()
                            : {};
                        return { response, body };
                    });
                    const timeoutRequest = new Promise((resolve, reject) => {
                        timeout = window.setTimeout(() => {
                            if (controller) controller.abort();
                            reject(new Error("AI request timed out."));
                        }, 30000);
                    });
                    result = await Promise.race([request, timeoutRequest]);
                } finally {
                    if (timeout) window.clearTimeout(timeout);
                }
                if (!result.response.ok) throw new Error(result.body.error || `AI request failed (${result.response.status}).`);
                showAnalystResponse("Source-grounded analysis", result.body.answer);
            } catch (error) {
                showAnalystResponse("Analysis unavailable", `${error.message} Your source data remains available; no answer was generated.`);
                console.warn("AI analyst request failed:", error);
            } finally {
                submitButton.disabled = false;
                analystResponse.removeAttribute("aria-busy");
            }
        });
        $("analystForm").addEventListener("reset", () => {
            window.setTimeout(() => {
                showAnalystResponse(
                    analystConfigured ? "Ready" : "Not connected",
                    analystConfigured ? "Ask a question grounded in the selected country's loaded source observations." : "Configure OPENAI_API_KEY in the Netlify site's server-side environment variables."
                );
            }, 0);
        });
        checkAnalystAvailability();

        $("compareCsv").addEventListener("click", exportCsv);
        $("downloadMapSelectionCsv").addEventListener("click", exportMapSelectionCsv);
        $("downloadReportCsv").addEventListener("click", exportCsv);
        $("downloadReportJson").addEventListener("click", exportJson);
        $("printReport").addEventListener("click", askExportFormat);
        const exportDialog = $("exportFormatDialog");
        if (exportDialog) {
            exportDialog.addEventListener("close", () => {
                const format = exportDialog.returnValue;
                if (["pdf", "pptx", "doc"].includes(format)) exportDocument(format);
            });
        }
    }

    function renderAll() {
        renderDashboard();
        renderMacro();
        renderTrade();
        renderFinance();
        renderComparison();
        renderForecast();
        renderMapRegion(activeMapRegion);
        renderReports();
    }

    function updateStatus() {
        const issues = data.state.issues;
        const countryCount = Object.keys(data.state.countries).length;
        $("overviewUpdatedAt").textContent = data.state.lastUpdated
            ? `Sources checked ${new Date(data.state.lastUpdated).toLocaleString()}`
            : "Source update time unavailable";
        if (!countryCount) {
            setStatus("Data unavailable — check your connection and refresh", "error");
            $("asOfDate").textContent = `${config.startYear}–${config.endYear} · NO DATA`;
        } else if (issues.length) {
            setStatus(`Partial data · ${issues.length} source request${issues.length === 1 ? "" : "s"} unavailable`, "partial");
            $("asOfDate").textContent = `SOURCE WINDOW ${config.startYear}–${config.endYear}`;
        } else {
            setStatus("Sources connected", "ready");
            $("asOfDate").textContent = `SOURCE WINDOW ${config.startYear}–${config.endYear}`;
        }
        const sourceDetails = Object.entries(data.state.sources).map(([key, source]) => {
            const name = source.source || key;
            const updated = source.lastUpdated ? ` · dataset updated ${source.lastUpdated}` : "";
            const observations = Number.isFinite(source.observations) ? ` · ${source.observations} observations` : "";
            const error = source.error ? ` · ${source.error}` : "";
            return `${name}: ${source.status}${updated}${observations}${error}`;
        });
        const issueDetails = issues.map(issue => `${issue.source}: ${issue.message}`);
        $("overviewUpdatedAt").title = [
            `Retrieval checked ${new Date(data.state.lastUpdated).toLocaleString()}`,
            ...sourceDetails,
            ...issueDetails
        ].join("\n");
        $("status").title = issueDetails.length ? issueDetails.join("\n") : "All requested data sources returned successfully.";
    }

    function setStatus(message, state) {
        const status = $("status");
        status.classList.toggle("error", state === "error");
        status.classList.toggle("partial", state === "partial");
        status.setAttribute("aria-label", message);
        status.title = message;
        if (status.lastChild) status.lastChild.textContent = ` ${message}`;
    }

    function mountOverviewMap() {
        const dashboard = $("dashboard");
        if (!dataReady || overviewMapMounted || !dashboard || dashboard.hidden
            || !window.EconIntel.IntelligenceMap) return;
        overviewMapMounted = window.EconIntel.IntelligenceMap.mount({
            mapId: "overviewMap",
            statusId: "overviewMapStatus",
            countries: data.state.countries,
            initialCode: selectedMapCountry,
            onSelect: addComparisonCountry
        });
    }

    async function boot() {
        try {
            bindNavigation();
            bindControls();
            const requestedView = window.location.hash.slice(1);
            activateView($(requestedView) && $(requestedView).classList.contains("view") ? requestedView : "dashboard");
            setStatus("Connecting to data sources…", "loading");

            await data.load();
            dataReady = true;
            fillCountrySelects();
            setupComparisonPicker();
            if (window.EconIntel.Globe) {
                window.EconIntel.Globe.mount({
                    svgId: "countryGlobe",
                    tooltipId: "globeTooltip",
                    wrapId: "globeWrap",
                    countries: data.state.countries,
                    selectedCodes: mapSelectedCountries,
                    onSelect: addComparisonCountry,
                    onStatus: message => { $("globeStatus").textContent = message; }
                });
            } else {
                $("globeStatus").textContent = "Interactive globe unavailable · Use the country selector instead";
            }
            if (window.EconIntel.GlobeExport) {
                window.EconIntel.GlobeExport.mount({
                    getReport: globeExportData,
                    getVisualization: () => window.EconIntel.Globe.exportSvg()
                });
            }
            renderAll();
            mountOverviewMap();
            updateStatus();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("Dashboard initialization failed:", error);
            setStatus(`Dashboard initialization failed · ${message}`, "error");
            $("asOfDate").textContent = `${config.startYear}–${config.endYear} · INITIALIZATION ERROR`;
        }
    }

    boot();
}());
