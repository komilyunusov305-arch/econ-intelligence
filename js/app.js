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
    let activeMapRegion = "";
    let selectedYear = config.endYear;
    let selectedMapCountry = config.defaultCountry;
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
        return data.valueForYear(key, countryCode, selectedYear);
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
        if (!country) {
            $("globeStatus").textContent = `${mapName} is not available in the World Bank country directory.`;
            return;
        }
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
            overviewMetricCard(label, data.valueForYear(key, "WLD", selectedYear), unit)
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
            const point = data.valueForYear(key, "WLD", selectedYear);
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
        const exports = pointForYear("exportsValue", countryCode);
        const imports = pointForYear("importsValue", countryCode);
        return exports && imports ? { year: selectedYear, value: exports.value - imports.value } : null;
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

    function renderMapCountry() {
        const code = $("mapCountry").value;
        const country = data.state.countries[code];
        if (!country) {
            $("mapCountryDetails").innerHTML = "<p class='empty-state'>No country is available in this region from the country directory.</p>";
            $("overviewCountryDetails").innerHTML = "<p class='empty-state'>No source country record is available for this selection.</p>";
            return;
        }
        $("overviewCountrySelect").value = code;
        $("overviewCountryName").textContent = country.name;
        $("overviewCountryRegion").textContent = country.region;
        $("overviewCountryCode").textContent = country.code;
        if (window.EconIntel.Globe) window.EconIntel.Globe.setFocusedCountry(code);
        if (window.EconIntel.IntelligenceMap) window.EconIntel.IntelligenceMap.setSelectedCountry(code);
        const keys = ["gdp", "inflation", "unemployment", "exportsShare"];
        const rows = keys.map(key => {
                const point = pointForYear(key, code);
                return `<div class="map-data-row"><span>${util.escape(config.indicators[key].label)}</span><b>${point ? util.escape(formatValue(point.value, config.indicators[key].unit)) : "–"}</b><small>${point ? point.year : ""}</small></div>`;
            }).join("");
        $("mapCountryDetails").innerHTML = `<div class="map-country-heading"><strong>${util.escape(country.name)}</strong><span>${util.escape(country.code)}</span></div>
            <p class="map-region-text">${util.escape(country.region)}</p>${rows}`;
        $("overviewCountryDetails").innerHTML = rows;
        $("mapCompareLink").dataset.country = country.code;
        $("overviewCompareLink").dataset.country = country.code;
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
            <h1>ECON Intelligence · Word report</h1>
            <p class="subtitle">Selected year: ${selectedYear} · Exported: ${new Date().toLocaleString()}</p>
            <table><thead><tr><th>Country</th>${indicatorKeys.map(key => `<th>${util.escape(config.indicators[key].label)}<small>${util.escape(config.indicators[key].unit)}</small></th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table>
            <p class="note">Source observations only. Missing values remain unavailable; no estimates or projections are synthesized. World Bank and IMF methodologies may differ.</p>
            </body></html>`;
            downloadFile(`econ-intelligence-report-${selectedYear}.doc`, html, "application/msword;charset=utf-8");
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
            note: "Source observations only; no synthetic values are generated. IMF data may include source-published estimates or projections.",
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
        if (["world-leaders", "government-systems", "population", "country-database"].includes(viewId)
            && window.EconIntel.GlobalModules) {
            window.EconIntel.GlobalModules.init();
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

        $("analystForm").addEventListener("submit", event => {
            event.preventDefault();
            const prompt = $("analystPrompt").value.trim();
            const response = $("analystResponse");
            if (!prompt) {
                response.innerHTML = "<strong>Enter a question first</strong><span>Your prompt will not be sent; this workspace currently has no AI provider configured.</span>";
                $("analystPrompt").focus();
                return;
            }
            response.innerHTML = "<strong>AI provider not configured</strong><span>No request was sent and no AI-generated analysis was created. Connect an approved endpoint to enable this feature.</span>";
        });
        $("analystForm").addEventListener("reset", () => {
            window.setTimeout(() => {
                $("analystResponse").innerHTML = "<strong>Not connected</strong><span>Configure an approved AI endpoint and privacy policy before enabling generated analysis.</span>";
            }, 0);
        });

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
        renderAll();
        mountOverviewMap();
        updateStatus();
    }

    boot();
}());
