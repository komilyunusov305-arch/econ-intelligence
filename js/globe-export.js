(function () {
    "use strict";

    const $ = id => document.getElementById(id);
    const colors = {
        ink: "15212B",
        muted: "5D6A75",
        green: "178460",
        navy: "0B1017"
    };
    let api;
    let busy = false;
    let mounted = false;

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function escapeXml(value) {
        return escapeHtml(value);
    }

    function formatNumber(value, digits) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Unavailable";
        return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits === undefined ? 2 : digits }).format(Number(value));
    }

    function formatIndicator(value, unit) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Unavailable";
        const number = formatNumber(value);
        return unit === "%" ? `${number}%` : unit === "USD" ? `$${number}` : `${number}${unit ? ` ${unit}` : ""}`;
    }

    function safeFilename(value) {
        return String(value || "country-report").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "country-report";
    }

    function selectedOptions() {
        const sections = Array.from(document.querySelectorAll('input[name="globeExportSection"]:checked')).map(input => input.value);
        const charts = Array.from(document.querySelectorAll('input[name="globeExportChart"]:checked')).map(input => input.value);
        return { sections, charts };
    }

    function selectedReport() {
        const report = api.getReport();
        if (!report || !report.country || !report.country.name) throw new Error("Select a country before generating a report.");
        const options = selectedOptions();
        report.viewMode = api.getView ? api.getView() : report.viewMode || "globe";
        report.options = options;
        if (options.sections.includes("visualization")) {
            report.visualization = api.getVisualization();
            if (!report.visualization) throw new Error("The current map visualization is not ready.");
        }
        report.charts = (report.indicators || []).filter(indicator =>
            options.sections.includes("charts") && options.charts.includes(indicator.key)
            && Array.isArray(indicator.history) && indicator.history.length
        );
        return report;
    }

    function profileRows(report) {
        const country = report.country;
        return [
            ["Capital", country.capital],
            ["Population", country.population === null ? null : `${formatNumber(country.population, 0)}${country.populationYear ? ` (${country.populationYear})` : ""}`],
            ["Currency", (country.currencies || []).join(", ") || null],
            ["GDP", country.gdp === null ? null : `${formatIndicator(country.gdp, "USD")}${country.gdpYear ? ` (${country.gdpYear})` : ""}`],
            ["GDP per capita", country.gdpPerCapita === null ? null : `${formatIndicator(country.gdpPerCapita, "USD")}${country.gdpPerCapitaYear ? ` (${country.gdpPerCapitaYear})` : ""}`]
        ];
    }

    function geographyRows(report) {
        const country = report.country;
        return [
            ["Country code", country.code || "Unavailable"],
            ["Region", country.region],
            ["Area", country.area === null ? null : `${formatNumber(country.area, 0)} km²`],
            ["Official name", country.officialName]
        ];
    }

    function addDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    }

    function status(message, isError) {
        const output = $("globeExportStatus");
        output.textContent = message;
        output.classList.toggle("is-error", Boolean(isError));
        output.classList.toggle("is-success", !isError && Boolean(message));
    }

    async function flagPng(report) {
        if (!report.country.flagUrl) return null;
        try {
            const controller = typeof AbortController === "function" ? new AbortController() : null;
            let timeout;
            const fetchRequest = (async () => {
                const options = { mode: "cors" };
                if (controller) options.signal = controller.signal;
                const response = await fetch(report.country.flagUrl, options);
                if (!response.ok) throw new Error(`Flag request failed (${response.status}).`);
                return response.blob();
            })();
            const timeoutRequest = new Promise((resolve, reject) => {
                timeout = window.setTimeout(() => {
                    if (controller) controller.abort();
                    reject(new Error("Flag request timed out after 15000 ms."));
                }, 15000);
            });
            let blob;
            try {
                blob = await Promise.race([fetchRequest, timeoutRequest]);
            } finally {
                if (timeout) window.clearTimeout(timeout);
            }
            const objectUrl = URL.createObjectURL(blob);
            try {
                const image = new Image();
                image.src = objectUrl;
                await new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = () => reject(new Error("Could not decode the country flag image."));
                });
                const canvas = document.createElement("canvas");
                canvas.width = 320;
                canvas.height = 200;
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Canvas rendering is not available in this browser.");
                context.fillStyle = "#FFFFFF";
                context.fillRect(0, 0, canvas.width, canvas.height);
                const ratio = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
                const width = image.naturalWidth * ratio;
                const height = image.naturalHeight * ratio;
                context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
                return canvas.toDataURL("image/png");
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        } catch (error) {
            console.warn("Country flag could not be embedded in the report:", error);
            return null;
        }
    }

    async function svgToPng(svgText, width, height) {
        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        try {
            const image = new Image();
            image.decoding = "async";
            image.src = objectUrl;
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(new Error("The visualization could not be rendered for this document."));
            });
            const canvas = document.createElement("canvas");
            canvas.width = width || 1440;
            canvas.height = height || 1440;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas rendering is not available in this browser.");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/png");
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    function chartSvg(indicator) {
        const points = indicator.history.filter(point => Number.isFinite(Number(point.value)));
        const width = 960;
        const height = 500;
        const left = 92;
        const right = 42;
        const top = 72;
        const bottom = 82;
        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;
        if (!points.length) return "";
        const values = points.map(point => Number(point.value));
        const min = Math.min.apply(null, values);
        const max = Math.max.apply(null, values);
        const range = max - min || Math.max(1, Math.abs(max) * .1);
        const low = min - range * .08;
        const high = max + range * .08;
        const x = index => left + (points.length < 2 ? plotWidth / 2 : index * plotWidth / (points.length - 1));
        const y = value => top + (high - value) * plotHeight / (high - low);
        const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(Number(point.value)).toFixed(2)}`).join(" ");
        const grid = Array.from({ length: 5 }, (_, index) => {
            const value = high - index * (high - low) / 4;
            const yy = top + index * plotHeight / 4;
            return `<g><line x1="${left}" y1="${yy}" x2="${width - right}" y2="${yy}" stroke="#dce4e8" stroke-width="1"/><text x="${left - 12}" y="${yy + 5}" text-anchor="end" fill="#586874" font-size="18">${escapeXml(formatIndicator(value, indicator.unit))}</text></g>`;
        }).join("");
        const markers = points.map((point, index) =>
            `<circle cx="${x(index)}" cy="${y(Number(point.value))}" r="5" fill="#178460" stroke="#fff" stroke-width="2" data-year="${point.year}" data-value="${point.value}"><title>${escapeXml(point.year)}: ${escapeXml(formatIndicator(point.value, indicator.unit))}</title></circle>`
        ).join("");
        const labelStep = Math.max(1, Math.ceil(points.length / 8));
        const years = points.map((point, index) => index % labelStep === 0 || index === points.length - 1
            ? `<text x="${x(index)}" y="${height - bottom + 30}" text-anchor="middle" fill="#586874" font-size="18">${escapeXml(point.year)}</text>` : "").join("");
        return `<svg class="report-chart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(indicator.label)} history">
            <rect width="100%" height="100%" fill="#fff"/><text x="${left}" y="42" fill="#15212b" font-size="27" font-weight="700">${escapeXml(indicator.label)}</text>
            <g class="chart-stage">${grid}<path d="${line}" fill="none" stroke="#178460" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${markers}${years}
            <text x="${left + plotWidth / 2}" y="${height - 18}" text-anchor="middle" fill="#586874" font-size="18">Year · World Bank</text></g></svg>`;
    }

    function metricTableRows(report) {
        return report.indicators.map(indicator => {
            const selected = indicator.selectedYear === report.selectedYear ? indicator.selectedValue : null;
            const latest = indicator.latest;
            return [indicator.label,
                selected === null ? "Unavailable" : formatIndicator(selected, indicator.unit),
                latest && latest.value !== null ? `${formatIndicator(latest.value, indicator.unit)} (${latest.year})` : "Unavailable",
                indicator.source || "Unavailable"];
        });
    }

    function htmlTable(rows, header) {
        return `<table><thead><tr>${header.map(cell => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map(row =>
            `<tr>${row.map(cell => `<td>${escapeHtml(cell === null || cell === undefined || cell === "" ? "Unavailable" : cell)}</td>`).join("")}</tr>`
        ).join("")}</tbody></table>`;
    }

    function buildHtml(report) {
        const sections = report.options.sections;
        const nav = [];
        const content = [];
        const flag = report.country.flagUrl
            ? `<span class="flag-wrap"><img src="${escapeHtml(report.country.flagUrl)}" alt="" referrerpolicy="no-referrer"><span>${escapeHtml(report.country.flagEmoji || report.country.code || "")}</span></span>`
            : `<span class="flag-text">${escapeHtml(report.country.flagEmoji || report.country.code || "")}</span>`;
        const section = (id, title, body) => {
            nav.push(`<a href="#${id}">${escapeHtml(title)}</a>`);
            content.push(`<section id="${id}" class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>`);
        };
        if (sections.includes("profile")) section("profile", "Country profile", htmlTable(profileRows(report), ["Profile item", "Value"]));
        if (sections.includes("geography")) section("geography", "Geographic information", htmlTable(geographyRows(report), ["Geographic item", "Value"]));
        if (sections.includes("economy")) section("economy", "Economic indicators", htmlTable(metricTableRows(report), ["Indicator", `Selected ${report.selectedYear}`, "Latest observed", "Source"]));
        if (sections.includes("visualization")) {
            section("visualization", `${report.viewMode === "map" ? "2D map" : "3D globe"} snapshot`,
                `<p class="note">This is a non-live snapshot of the selected ${report.viewMode === "map" ? "2D map" : "3D globe"} view. ${report.liveUrl ? "The complete interactive platform is linked below." : "No public platform URL is configured for this local instance."}</p>
                <div class="map-tools"><button type="button" data-map-zoom="in">+</button><button type="button" data-map-zoom="out">−</button><button type="button" data-map-zoom="reset">Reset</button><span id="map-selection" aria-live="polite">Select a country outline for its name.</span></div>
                <div class="map-viewport" tabindex="0" aria-label="Snapshot map. Use the buttons, wheel, or drag to zoom and pan."><div class="map-stage">${report.visualization}</div></div>`);
        }
        if (sections.includes("charts") && report.charts.length) {
            section("charts", "Charts and statistics", report.charts.map((indicator, index) =>
                `<article class="chart-card"><h3>${escapeHtml(indicator.label)}</h3><div class="chart-tools"><button type="button" data-chart-zoom="in" data-chart="${index}">+</button><button type="button" data-chart-zoom="out" data-chart="${index}">−</button><button type="button" data-chart-zoom="reset" data-chart="${index}">Reset</button><span>${escapeHtml(indicator.source || "World Bank")} observations · ${escapeHtml(indicator.unit)}</span></div><div class="chart-viewport" tabindex="0">${chartSvg(indicator)}</div><p class="note">Source: ${escapeHtml(indicator.source || "World Bank")} · Values are reported observations; no estimates are generated by this report.</p></article>`
            ).join(""));
        }
        const sourceList = report.sources.map(source =>
            `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>`
        ).join("");
        nav.push('<a href="#sources">Sources &amp; platform</a>');
        const platformLink = report.liveUrl
            ? `<p><a class="platform-link" href="${escapeHtml(report.liveUrl)}" target="_blank" rel="noopener noreferrer">Open ECON Intelligence interactive platform</a></p>`
            : '<p class="note">No public platform URL is configured for this local instance. Return to the app for the live globe.</p>';
        content.push(`<section id="sources" class="report-section"><h2>Sources &amp; platform</h2><ul>${sourceList}</ul>${platformLink}<p class="note">This downloaded report contains a map snapshot. It does not reproduce the live 3D globe interaction.</p></section>`);
        const generated = new Date(report.generatedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.country.name)} · ECON Intelligence</title>
            <style>
            :root{color-scheme:light;--green:#178460;--ink:#15212b;--muted:#586874;--line:#dce4e8}
            *{box-sizing:border-box}body{margin:0;background:#f2f6f7;color:var(--ink);font:15px/1.6 Arial,sans-serif}
            header{padding:32px max(20px,calc((100vw - 1180px)/2));background:#0b1017;color:#fff;border-bottom:4px solid #55d6a5}
            .brand{color:#55d6a5;font-size:12px;letter-spacing:.18em;font-weight:700}header h1{margin:16px 0 4px;font-size:clamp(28px,5vw,44px)}header p{margin:4px 0;color:#d4dde5}
            .country-title{display:flex;align-items:center;gap:12px}.flag-wrap{position:relative;display:inline-flex}.flag-wrap img{width:44px;height:30px;object-fit:cover;border:1px solid #647482}.flag-wrap span{position:absolute;inset:0;display:grid;place-items:center;font-size:22px}.flag-text{font-size:28px}
            .layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:22px;max-width:1220px;margin:24px auto;padding:0 20px}
            nav{position:sticky;top:16px;align-self:start;display:grid;gap:7px;padding:14px;background:#fff;border:1px solid var(--line);border-radius:10px}
            nav a{padding:8px 10px;border-radius:6px;color:var(--ink);text-decoration:none;font-size:13px}nav a:hover{background:#eaf4ef;color:var(--green)}
            main{min-width:0}.report-section{margin:0 0 18px;padding:22px;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 3px 14px #15212b0a}
            h2{margin:0 0 15px;font-size:20px}h3{margin:0 0 10px;font-size:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px 12px;border:1px solid var(--line);text-align:left;vertical-align:top}th{background:#eaf4ef;color:#214b3b}
            .note{color:var(--muted);font-size:12px}.report-section ul{padding-left:20px}.report-section li{margin:6px 0}a{color:#126b4d}
            .map-tools,.chart-tools{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:8px 0}.map-tools button,.chart-tools button{min-width:36px;min-height:34px;border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink);cursor:pointer}.map-tools span,.chart-tools span{color:var(--muted);font-size:12px}
            .map-viewport,.chart-viewport{overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:7px;touch-action:none}.map-viewport{height:min(75vh,720px);min-height:320px}.map-stage,.chart-stage{transform-origin:center center;will-change:transform}.map-stage{width:100%;height:100%;display:grid;place-items:center;cursor:grab}.map-stage:active{cursor:grabbing}.map-stage svg{width:100%;height:100%;max-height:100%;object-fit:contain}
            .chart-viewport{touch-action:none;cursor:grab}.chart-viewport:active{cursor:grabbing}.chart-viewport svg{display:block;width:100%;height:auto}.chart-card{margin:18px 0}.platform-link{font-weight:700}
            footer{padding:22px;text-align:center;color:var(--muted);font-size:12px}
            @media(max-width:760px){.layout{grid-template-columns:1fr;padding:0 12px;margin:12px auto;gap:12px}nav{position:static;display:flex;overflow:auto;white-space:nowrap}nav a{flex:none}.report-section{padding:15px;overflow-wrap:anywhere}table{font-size:12px}th,td{padding:7px}.map-viewport{height:min(65vh,600px);min-height:280px}header{padding:22px 16px}}
            </style></head><body>
            <header><span class="brand">ECON INTELLIGENCE · COUNTRY REPORT</span><div class="country-title">${flag}<h1>${escapeHtml(report.country.name)}</h1></div>
            <p>${escapeHtml(report.country.code || "Country code unavailable")} · Generated ${escapeHtml(generated)} · Selected year ${escapeHtml(report.selectedYear)}</p></header>
            <div class="layout"><nav aria-label="Report sections">${nav.join("")}</nav><main>${content.join("")}</main></div>
            <footer>ECON INTELLIGENCE · Source-attributed observations · ${escapeHtml(generated)}</footer>
            <script>
            (function(){
              function attachViewport(viewport, stage, isMap) {
                var scale=1, tx=0, ty=0, pointer=null;
                function draw(){stage.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';}
                viewport.addEventListener('wheel',function(e){e.preventDefault();scale=Math.max(1,Math.min(8,scale*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
                viewport.addEventListener('pointerdown',function(e){pointer={id:e.pointerId,x:e.clientX,y:e.clientY,tx:tx,ty:ty};viewport.setPointerCapture(e.pointerId);});
                viewport.addEventListener('pointermove',function(e){if(!pointer||pointer.id!==e.pointerId)return;tx=pointer.tx+e.clientX-pointer.x;ty=pointer.ty+e.clientY-pointer.y;draw();});
                viewport.addEventListener('pointerup',function(){pointer=null;});
                viewport.addEventListener('pointercancel',function(){pointer=null;});
                return {zoom:function(factor){scale=Math.max(1,Math.min(8,scale*factor));draw();},reset:function(){scale=1;tx=0;ty=0;draw();}};
              }
              var map=document.querySelector('.map-viewport');
              if(map){var mapControl=attachViewport(map,map.querySelector('.map-stage'),true);
                document.querySelectorAll('[data-map-zoom]').forEach(function(button){button.addEventListener('click',function(){var action=button.getAttribute('data-map-zoom');if(action==='reset')mapControl.reset();else mapControl.zoom(action==='in'?1.3:1/1.3);});});
                map.addEventListener('click',function(event){var country=event.target.closest('.globe-country,.globe-country-hit-target');if(country)document.getElementById('map-selection').textContent=country.getAttribute('data-name')+' · profile in this snapshot: '+(country.getAttribute('data-code')||'unavailable');});
              }
              document.querySelectorAll('.chart-viewport').forEach(function(viewport,index){var control=attachViewport(viewport,viewport.querySelector('.chart-stage'),false);
                document.querySelectorAll('[data-chart="'+index+'"]').forEach(function(button){button.addEventListener('click',function(){var action=button.getAttribute('data-chart-zoom');if(action==='reset')control.reset();else control.zoom(action==='in'?1.3:1/1.3);});});
              });
            })();
            </script></body></html>`;
    }

    async function generateHtml(report, filename) {
        addDownload(new Blob([buildHtml(report)], { type: "text/html;charset=utf-8" }), filename);
    }

    async function generatePdf(report, filename) {
        const JsPdf = window.jspdf && window.jspdf.jsPDF;
        if (!JsPdf) throw new Error("PDF export is unavailable because jsPDF did not load.");
        const pdf = new JsPdf({ unit: "pt", format: "a4", orientation: "portrait" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 48;
        const contentWidth = pageWidth - margin * 2;
        const pages = [];
        const toc = [];
        let y;
        const newPage = () => { pdf.addPage(); y = 55; };
        const ensure = height => { if (y + height > pageHeight - 55) newPage(); };
        const paragraph = (text, fontSize, color) => {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(fontSize || 10);
            pdf.setTextColor(`#${color || colors.ink}`);
            const lines = pdf.splitTextToSize(String(text), contentWidth);
            ensure(lines.length * 14 + 8);
            pdf.text(lines, margin, y);
            y += lines.length * 14 + 8;
        };
        const table = rows => {
            const rowHeight = 24;
            rows.forEach((row, index) => {
                ensure(rowHeight);
                if (index % 2 === 0) {
                    pdf.setFillColor(index === 0 ? 234 : 248, index === 0 ? 244 : 250, index === 0 ? 239 : 251);
                    pdf.rect(margin, y - 15, contentWidth, rowHeight, "F");
                }
                pdf.setFont("helvetica", index === 0 ? "bold" : "normal");
                pdf.setFontSize(9);
                pdf.setTextColor(`#${index === 0 ? colors.ink : colors.muted}`);
                const labelWidth = contentWidth * .38;
                const valueWidth = contentWidth - labelWidth - 14;
                const label = pdf.splitTextToSize(String(row[0]), labelWidth - 8)[0] || "";
                const value = pdf.splitTextToSize(String(row[1] === null || row[1] === undefined || row[1] === "" ? "Unavailable" : row[1]), valueWidth - 8);
                pdf.text(label, margin + 7, y);
                pdf.text(value.slice(0, 2), margin + labelWidth, y);
                pdf.setDrawColor(215, 224, 229);
                pdf.line(margin, y + 8, margin + contentWidth, y + 8);
                y += rowHeight;
            });
            y += 8;
        };
        const mapImage = report.options.sections.includes("visualization") ? await svgToPng(report.visualization, 1440, 1440) : null;
        const charts = await Promise.all(report.charts.map(indicator => svgToPng(chartSvg(indicator), 960, 500)));
        const flag = await flagPng(report);

        pdf.setFillColor(11, 16, 23);
        pdf.rect(0, 0, pageWidth, 190, "F");
        pdf.setFillColor(85, 214, 165);
        pdf.rect(0, 0, pageWidth, 6, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor("#55D6A5");
        pdf.text("ECON INTELLIGENCE", margin, 48);
        if (flag) pdf.addImage(flag, "PNG", margin, 67, 48, 32);
        pdf.setFontSize(25);
        pdf.setTextColor("#FFFFFF");
        pdf.text(report.country.name, margin + (flag ? 58 : 0), 92, { maxWidth: contentWidth - 58 });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor("#CBD5DE");
        pdf.text(`COUNTRY INTELLIGENCE REPORT  ·  ${report.country.code || "CODE UNAVAILABLE"}`, margin, 126);
        pdf.text(`Generated ${new Date(report.generatedAt).toLocaleString("en-US")}  ·  Selected year ${report.selectedYear}`, margin, 148);
        pdf.text("Static visualization snapshot · Live 3D interaction remains on the platform", margin, 169);
        y = 226;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.setTextColor(`#${colors.ink}`);
        pdf.text("Report contents", margin, y);
        y += 24;
        const tocEntries = [];
        if (report.options.sections.includes("profile")) tocEntries.push("Country profile");
        if (report.options.sections.includes("geography")) tocEntries.push("Geographic information");
        if (report.options.sections.includes("economy")) tocEntries.push("Economic indicators");
        if (mapImage) tocEntries.push(`${report.viewMode === "map" ? "2D map" : "3D globe"} snapshot`);
        if (charts.length) tocEntries.push("Charts and statistics");
        tocEntries.push("Sources & platform");
        tocEntries.forEach(title => {
            toc.push({ title, x: margin, y, w: contentWidth, h: 18 });
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            pdf.setTextColor(`#${colors.green}`);
            pdf.text(title, margin + 8, y + 12);
            y += 22;
        });
        paragraph("This report presents source observations. Missing values are shown as unavailable; no estimates or projections are synthesized by the report.", 9, colors.muted);

        const addSection = (title, sectionContent) => {
            newPage();
            const page = pdf.internal.getNumberOfPages();
            pages.push({ title, page });
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(18);
            pdf.setTextColor(`#${colors.ink}`);
            pdf.text(title, margin, y);
            y += 30;
            sectionContent();
        };
        if (report.options.sections.includes("profile")) addSection("Country profile", () => table([["Profile item", "Value"], ...profileRows(report)]));
        if (report.options.sections.includes("geography")) addSection("Geographic information", () => table([["Geographic item", "Value"], ...geographyRows(report)]));
        if (report.options.sections.includes("economy")) addSection("Economic indicators", () => {
            table([["Indicator", `Selected ${report.selectedYear}`], ...report.indicators.map(item => [
                `${item.label} · ${item.source}`,
                item.selectedValue === null ? "Unavailable" : formatIndicator(item.selectedValue, item.unit)
            ])]);
            paragraph("Latest observation is shown with its source year; observations do not imply a forecast.", 9, colors.muted);
            report.indicators.forEach(item => {
                if (!item.latest || item.latest.value === null) return;
                paragraph(`${item.label}: latest ${formatIndicator(item.latest.value, item.unit)} (${item.latest.year}). Source: ${item.source}.`, 9, colors.muted);
            });
        });
        if (mapImage) addSection(`${report.viewMode === "map" ? "2D map" : "3D globe"} snapshot`, () => {
            ensure(370);
            const imageWidth = Math.min(contentWidth, 390);
            const imageX = margin + (contentWidth - imageWidth) / 2;
            pdf.addImage(mapImage, "PNG", imageX, y, imageWidth, imageWidth, undefined, "FAST");
            y += imageWidth + 10;
            paragraph("Static export snapshot; use the linked interactive platform for live rotation, selection, and zoom.", 9, colors.muted);
        });
        if (charts.length) addSection("Charts and statistics", () => {
            report.charts.forEach((indicator, index) => {
                ensure(300);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(12);
                pdf.setTextColor(`#${colors.ink}`);
                pdf.text(indicator.label, margin, y);
                y += 8;
                const chartHeight = contentWidth * 500 / 960;
                ensure(chartHeight + 20);
                pdf.addImage(charts[index], "PNG", margin, y, contentWidth, chartHeight, undefined, "FAST");
                y += chartHeight + 6;
                paragraph(`${indicator.source} observations · ${indicator.unit} · Source values only.`, 8, colors.muted);
            });
        });
        addSection("Sources & platform", () => {
            report.sources.forEach(source => {
                ensure(26);
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10);
                pdf.setTextColor(`#${colors.green}`);
                pdf.textWithLink(source.label, margin, y, { url: source.url });
                y += 22;
            });
            ensure(26);
            if (report.liveUrl) {
                pdf.textWithLink("Open ECON Intelligence interactive platform", margin, y, { url: report.liveUrl });
                y += 26;
            } else {
                paragraph("No public platform URL is configured for this local instance. Return to the app for the live globe.", 9, colors.muted);
            }
            paragraph("This PDF includes static map and chart snapshots. It does not reproduce the live 3D globe interaction.", 9, colors.muted);
        });
        toc.forEach(item => {
            const target = pages.find(page => page.title === item.title);
            if (target) {
                pdf.setPage(1);
                pdf.link(item.x, item.y, item.w, item.h, { pageNumber: target.page });
            }
        });
        pages.forEach(section => {
            pdf.outline.add(null, section.title, { pageNumber: section.page });
        });
        const total = pdf.internal.getNumberOfPages();
        for (let page = 1; page <= total; page++) {
            pdf.setPage(page);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor("#75838E");
            pdf.text("ECON INTELLIGENCE · SOURCE-ATTRIBUTED COUNTRY REPORT", margin, pageHeight - 24);
            pdf.text(`${page} / ${total}`, pageWidth - margin, pageHeight - 24, { align: "right" });
        }
        pdf.save(filename);
    }

    function wordParagraph(text, style, bold) {
        const properties = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
        const runProperties = bold ? "<w:rPr><w:b/></w:rPr>" : "";
        return `<w:p>${properties}<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    }

    function wordTable(rows) {
        return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D7E0E5"/><w:left w:val="single" w:sz="4" w:color="D7E0E5"/><w:bottom w:val="single" w:sz="4" w:color="D7E0E5"/><w:right w:val="single" w:sz="4" w:color="D7E0E5"/><w:insideH w:val="single" w:sz="4" w:color="D7E0E5"/><w:insideV w:val="single" w:sz="4" w:color="D7E0E5"/></w:tblBorders></w:tblPr>${rows.map((row, rowIndex) =>
            `<w:tr>${row.map((cell, cellIndex) => `<w:tc><w:tcPr><w:tcW w:w="${cellIndex === 0 ? 3800 : 5600}" w:type="dxa"/>${rowIndex === 0 ? '<w:shd w:fill="EAF4EF"/>' : ""}</w:tcPr><w:p><w:r>${rowIndex === 0 || cellIndex === 0 ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escapeXml(cell === null || cell === undefined || cell === "" ? "Unavailable" : cell)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`
        ).join("")}</w:tbl>`;
    }

    function wordImage(relId, width, height, maxWidth) {
        const cx = maxWidth || 5486400;
        const cy = Math.round(cx * height / width);
        return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${relId.replace(/\D/g, "") || "1"}" name="ECON Intelligence visualization"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${relId.replace(/\D/g, "") || "1"}" name="Report image"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }

    function dataUrlBytes(dataUrl) {
        const encoded = dataUrl.split(",")[1];
        const binary = atob(encoded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        return bytes;
    }

    function concatBytes(parts) {
        const length = parts.reduce((sum, part) => sum + part.length, 0);
        const output = new Uint8Array(length);
        let offset = 0;
        parts.forEach(part => { output.set(part, offset); offset += part.length; });
        return output;
    }

    function crc32(bytes) {
        let crc = -1;
        for (let index = 0; index < bytes.length; index++) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 0xFF];
        }
        return (crc ^ -1) >>> 0;
    }

    const crcTable = (() => {
        const table = new Uint32Array(256);
        for (let value = 0; value < 256; value++) {
            let crc = value;
            for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1;
            table[value] = crc >>> 0;
        }
        return table;
    })();

    function write16(view, offset, value) { view.setUint16(offset, value, true); }
    function write32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

    function makeZip(files) {
        const encoder = new TextEncoder();
        const localParts = [];
        const centralParts = [];
        let localOffset = 0;
        const date = new Date();
        const zipTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
        const zipDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
        files.forEach(file => {
            const name = encoder.encode(file.name);
            const body = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
            const crc = crc32(body);
            const localHeader = new Uint8Array(30 + name.length);
            const localView = new DataView(localHeader.buffer);
            write32(localView, 0, 0x04034B50); write16(localView, 4, 20); write16(localView, 6, 0x0800);
            write16(localView, 8, 0); write16(localView, 10, zipTime); write16(localView, 12, zipDate);
            write32(localView, 14, crc); write32(localView, 18, body.length); write32(localView, 22, body.length);
            write16(localView, 26, name.length); write16(localView, 28, 0); localHeader.set(name, 30);
            localParts.push(localHeader, body);
            const centralHeader = new Uint8Array(46 + name.length);
            const centralView = new DataView(centralHeader.buffer);
            write32(centralView, 0, 0x02014B50); write16(centralView, 4, 20); write16(centralView, 6, 20);
            write16(centralView, 8, 0x0800); write16(centralView, 10, 0); write16(centralView, 12, zipTime);
            write16(centralView, 14, zipDate); write32(centralView, 16, crc); write32(centralView, 20, body.length);
            write32(centralView, 24, body.length); write16(centralView, 28, name.length); write16(centralView, 30, 0);
            write16(centralView, 32, 0); write16(centralView, 34, 0); write16(centralView, 36, 0);
            write32(centralView, 38, 0); write32(centralView, 42, localOffset); centralHeader.set(name, 46);
            centralParts.push(centralHeader);
            localOffset += localHeader.length + body.length;
        });
        const central = concatBytes(centralParts);
        const end = new Uint8Array(22);
        const endView = new DataView(end.buffer);
        write32(endView, 0, 0x06054B50); write16(endView, 4, 0); write16(endView, 6, 0);
        write16(endView, 8, files.length); write16(endView, 10, files.length);
        write32(endView, 12, central.length); write32(endView, 16, localOffset); write16(endView, 20, 0);
        return concatBytes([...localParts, central, end]);
    }

    async function generateDocx(report, filename) {
        const sections = report.options.sections;
        const relationships = [];
        const files = [];
        let nextRel = 1;
        const addHyperlink = (text, url) => {
            const id = `rId${nextRel++}`;
            relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(url)}" TargetMode="External"/>`);
            return `<w:p><w:hyperlink r:id="${id}"><w:r><w:rPr><w:color w:val="${colors.green}"/><w:u w:val="single"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:hyperlink></w:p>`;
        };
        const addImage = (imageData, name, width, height, maxWidth) => {
            const id = `rId${nextRel++}`;
            const fileName = `image${id.replace(/\D/g, "")}.png`;
            relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fileName}"/>`);
            files.push({ name: `word/media/${fileName}`, data: dataUrlBytes(imageData) });
            return wordImage(id, width, height, maxWidth);
        };
        let body = wordParagraph("ECON INTELLIGENCE", "Title", true)
            + wordParagraph(`${report.country.flagEmoji || report.country.code || ""}  ${report.country.name}`, "Title", true)
            + wordParagraph(`COUNTRY INTELLIGENCE REPORT · ${report.country.code || "CODE UNAVAILABLE"}`, "Subtitle")
            + wordParagraph(`Generated ${new Date(report.generatedAt).toLocaleString("en-US")} · Selected year ${report.selectedYear} · ${report.viewMode === "map" ? "2D map" : "3D globe"} snapshot`);
        const flag = await flagPng(report);
        if (flag) body += addImage(flag, "country flag", 160, 110, 1500000);
        if (sections.includes("profile")) {
            body += wordParagraph("Country profile", "Heading1") + wordTable([["Profile item", "Value"], ...profileRows(report)]);
        }
        if (sections.includes("geography")) {
            body += wordParagraph("Geographic information", "Heading1") + wordTable([["Geographic item", "Value"], ...geographyRows(report)]);
        }
        if (sections.includes("economy")) {
            body += wordParagraph("Economic indicators", "Heading1")
                + wordTable([["Indicator", `Selected ${report.selectedYear}`, "Latest observed"], ...report.indicators.map(indicator => [
                    `${indicator.label} · ${indicator.source}`,
                    indicator.selectedValue === null ? "Unavailable" : formatIndicator(indicator.selectedValue, indicator.unit),
                    indicator.latest && indicator.latest.value !== null ? `${formatIndicator(indicator.latest.value, indicator.unit)} (${indicator.latest.year})` : "Unavailable"
                ])]);
        }
        if (sections.includes("visualization")) {
            body += wordParagraph(`${report.viewMode === "map" ? "2D map" : "3D globe"} visualization snapshot`, "Heading1");
            body += addImage(await svgToPng(report.visualization, 1440, 1440), "map", 1440, 1440);
            body += wordParagraph(report.liveUrl
                ? "Static map image only. Open the linked platform for live globe rotation, selection, and zoom."
                : "Static map image only. This local instance has no public platform URL; return to the app for live globe rotation, selection, and zoom.");
        }
        if (sections.includes("charts") && report.charts.length) {
            body += wordParagraph("Charts and statistics", "Heading1");
            for (const indicator of report.charts) {
                body += wordParagraph(indicator.label, "Heading2");
                body += addImage(await svgToPng(chartSvg(indicator), 960, 500), indicator.key, 960, 500);
                body += wordParagraph(`Editable observation data · ${indicator.source} · ${indicator.unit}`);
                body += wordTable([["Year", "Value"], ...indicator.history.map(point => [point.year, formatIndicator(point.value, indicator.unit)])]);
            }
        }
        body += wordParagraph("Sources & platform", "Heading1");
        report.sources.forEach(source => { body += addHyperlink(source.label, source.url); });
        if (report.liveUrl) body += addHyperlink("Open ECON Intelligence interactive platform", report.liveUrl);
        else body += wordParagraph("No public platform URL is configured for this local instance. Return to the app for live globe interaction.");
        body += wordParagraph("This DOCX includes static map and chart images plus editable observation tables. It does not reproduce the live 3D globe interaction.");
        body += `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
        files.push(
            { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>` },
            { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
            { name: "word/document.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>` },
            { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
            { name: "word/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="${colors.green}"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="5D6A75"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="${colors.green}"/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="${colors.ink}"/><w:sz w:val="26"/></w:rPr></w:style></w:styles>` }
        );
        const zip = makeZip(files);
        addDownload(new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), filename);
    }

    function addPptText(slide, text, options) {
        slide.addText(text, { fontFace: "Aptos", color: "FFFFFF", breakLine: false, margin: 0.05, ...options });
    }

    async function generatePptx(report, filename) {
        if (!window.PptxGenJS) throw new Error("PowerPoint export is unavailable because PptxGenJS did not load.");
        const pptx = new window.PptxGenJS();
        pptx.layout = "LAYOUT_WIDE";
        pptx.author = "ECON Intelligence";
        pptx.subject = `Country report: ${report.country.name}`;
        pptx.title = `${report.country.name} · ECON Intelligence`;
        pptx.company = "ECON Intelligence";
        pptx.lang = "en-US";
        pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };
        const slideRefs = [];
        const addSlide = title => {
            const slide = pptx.addSlide();
            slide.background = { color: colors.navy };
            slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .09, line: { color: "55D6A5", transparency: 100 }, fill: { color: "55D6A5" } });
            addPptText(slide, title, { x: .6, y: .32, w: 12.1, h: .55, bold: true, fontSize: 24 });
            slideRefs.push(slide);
            return slide;
        };
        const cover = pptx.addSlide();
        cover.background = { color: colors.navy };
        cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .1, line: { color: "55D6A5", transparency: 100 }, fill: { color: "55D6A5" } });
        addPptText(cover, "ECON INTELLIGENCE", { x: .8, y: .8, w: 11.7, h: .4, color: "55D6A5", bold: true, fontSize: 16, charSpacing: 2 });
        const flag = await flagPng(report);
        if (flag) cover.addImage({ data: flag, x: .8, y: 1.65, w: .9, h: .6 });
        addPptText(cover, report.country.name, { x: .8, y: 2.45, w: 11.8, h: .85, bold: true, fontSize: 34 });
        addPptText(cover, `COUNTRY INTELLIGENCE REPORT · ${report.country.code || "CODE UNAVAILABLE"}`, { x: .82, y: 3.45, w: 11.4, h: .35, color: "A9B6C2", fontSize: 13, charSpacing: 1 });
        addPptText(cover, `Generated ${new Date(report.generatedAt).toLocaleString("en-US")} · Selected year ${report.selectedYear}`, { x: .82, y: 4.1, w: 11.4, h: .4, color: "D4DDE5", fontSize: 14 });
        const sectionSlideMap = [];
        const sections = report.options.sections;
        if (sections.includes("profile")) sectionSlideMap.push(["Country profile", () => {
            const slide = addSlide("Country profile");
            const rows = profileRows(report);
            rows.forEach((row, index) => {
                const y = 1.35 + index * .88;
                addPptText(slide, row[0], { x: .8, y, w: 3.2, h: .3, color: "A9B6C2", fontSize: 13 });
                addPptText(slide, row[1] || "Unavailable", { x: 4.1, y: y - .02, w: 8.3, h: .42, color: "55D6A5", fontSize: 17, bold: true });
            });
        }]);
        if (sections.includes("geography")) sectionSlideMap.push(["Geographic information", () => {
            const slide = addSlide("Geographic information");
            geographyRows(report).forEach((row, index) => {
                const y = 1.35 + index * .9;
                addPptText(slide, row[0], { x: .8, y, w: 3.2, h: .3, color: "A9B6C2", fontSize: 13 });
                addPptText(slide, row[1] || "Unavailable", { x: 4.1, y: y - .02, w: 8.3, h: .42, color: "55D6A5", fontSize: 17, bold: true });
            });
        }]);
        if (sections.includes("economy")) sectionSlideMap.push(["Economic indicators", () => {
            const slide = addSlide("Economic indicators");
            const rows = [["Indicator", `Selected ${report.selectedYear}`, "Latest observed"], ...report.indicators.map(item => [
                item.label,
                item.selectedValue === null ? "Unavailable" : formatIndicator(item.selectedValue, item.unit),
                item.latest && item.latest.value !== null ? `${formatIndicator(item.latest.value, item.unit)} (${item.latest.year})` : "Unavailable"
            ])];
            slide.addTable(rows, {
                x: .7, y: 1.25, w: 11.95, h: 5.2,
                border: { type: "solid", color: "334452", pt: 1 },
                fill: "14212D",
                color: "E5EDF2",
                fontFace: "Aptos",
                fontSize: 11,
                bold: false,
                breakLine: false,
                rowH: .3,
                colW: [4.3, 3.4, 4.25],
                margin: .12,
                autoFit: false,
                valign: "mid",
                paraSpaceAfterPt: 0
            });
        }]);
        if (sections.includes("visualization")) sectionSlideMap.push([`${report.viewMode === "map" ? "2D map" : "3D globe"} snapshot`, async () => {
            const slide = addSlide(`${report.viewMode === "map" ? "2D map" : "3D globe"} snapshot`);
            const image = await svgToPng(report.visualization, 1440, 1440);
            slide.addImage({ data: image, x: 3.8, y: 1.15, w: 5.7, h: 5.7 });
            addPptText(slide, report.liveUrl
                ? "Static snapshot · Open the linked platform for live rotation and zoom."
                : "Static snapshot · This local instance has no public platform URL.", { x: .8, y: 6.95, w: 11.6, h: .25, color: "A9B6C2", fontSize: 10 });
        }]);
        if (sections.includes("charts")) {
            report.charts.forEach(indicator => sectionSlideMap.push([indicator.label, () => {
                const slide = addSlide(indicator.label);
                const points = indicator.history.filter(point => Number.isFinite(Number(point.value)));
                if (!points.length) {
                    addPptText(slide, "No source observations are available for this chart.", { x: .8, y: 1.4, w: 11.4, h: .4, color: "A9B6C2", fontSize: 14 });
                    return;
                }
                slide.addChart(pptx.ChartType && pptx.ChartType.line || "line", [{
                    name: indicator.label,
                    labels: points.map(point => String(point.year)),
                    values: points.map(point => Number(point.value))
                }], {
                    x: .75, y: 1.25, w: 11.8, h: 5.2,
                    chartColors: ["55D6A5"],
                    showTitle: false,
                    showLegend: false,
                    showValue: false,
                    catAxisLabelFontFace: "Aptos",
                    catAxisLabelFontSize: 9,
                    catAxisLabelColor: "CBD5DE",
                    valAxisLabelFontFace: "Aptos",
                    valAxisLabelFontSize: 10,
                    valAxisLabelColor: "CBD5DE",
                    valAxisLineColor: "465966",
                    catAxisLineColor: "465966",
                    valGridLine: { color: "334452", width: 1 },
                    showCatName: false,
                    showSerName: false,
                    showValAxisTitle: true,
                    valAxisTitle: indicator.unit,
                    showCatAxisTitle: true,
                    catAxisTitle: "Year",
                    showMarker: true,
                    markerSize: 3
                });
                addPptText(slide, `${indicator.source} · Editable chart and source observations`, { x: .8, y: 6.65, w: 11.5, h: .3, color: "A9B6C2", fontSize: 10 });
            }]));
        }
        sectionSlideMap.push(["Sources & platform", () => {
            const slide = addSlide("Sources & platform");
            report.sources.forEach((source, index) => {
                slide.addText(source.label, { x: .8, y: 1.3 + index * .35, w: 11.4, h: .3, color: "55D6A5", fontFace: "Aptos", fontSize: 12, hyperlink: { url: source.url }, underline: { color: "55D6A5" } });
            });
            if (report.liveUrl) {
                slide.addText("Open ECON Intelligence interactive platform", { x: .8, y: 1.3 + report.sources.length * .35, w: 11.4, h: .3, color: "55D6A5", fontFace: "Aptos", fontSize: 12, hyperlink: { url: report.liveUrl }, underline: { color: "55D6A5" } });
            }
            addPptText(slide, "The map and charts are document snapshots. The live 3D globe interaction remains on the platform.", { x: .8, y: 6.8, w: 11.5, h: .3, color: "A9B6C2", fontSize: 10 });
        }]);
        const toc = pptx.addSlide();
        toc.background = { color: colors.navy };
        toc.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .09, line: { color: "55D6A5", transparency: 100 }, fill: { color: "55D6A5" } });
        addPptText(toc, "Report contents", { x: .7, y: .4, w: 12, h: .55, fontSize: 24, bold: true });
        addPptText(toc, `${report.country.name} · ${report.selectedYear}`, { x: .72, y: 1, w: 11, h: .3, color: "A9B6C2", fontSize: 12 });
        cover.addText("View report contents", { x: .82, y: 5.2, w: 3.2, h: .35, color: "55D6A5", fontFace: "Aptos", fontSize: 13, hyperlink: { slide: 2 }, underline: { color: "55D6A5" } });
        const contentSlides = [];
        for (const [title, build] of sectionSlideMap) {
            await build();
            contentSlides.push({ title, slide: slideRefs[slideRefs.length - 1] });
        }
        contentSlides.forEach((entry, index) => {
            toc.addText(entry.title, { x: .9, y: 1.65 + index * .52, w: 11.2, h: .32, color: "55D6A5", fontFace: "Aptos", fontSize: 16, hyperlink: { slide: slideRefs.indexOf(entry.slide) + 3 }, underline: { color: "55D6A5" } });
        });
        const footerText = "ECON INTELLIGENCE · SOURCE-ATTRIBUTED DATA";
        [cover, toc].concat(slideRefs).forEach((slide, index) => {
            slide.addText(footerText, { x: .6, y: 7.18, w: 10.3, h: .18, color: "75838E", fontFace: "Aptos", fontSize: 8, margin: 0 });
            if (index !== 0) slide.addText("Contents", { x: 11.5, y: 7.12, w: 1.15, h: .25, color: "55D6A5", fontFace: "Aptos", fontSize: 9, hyperlink: { slide: 2 }, margin: 0, align: "right" });
        });
        const presentation = await pptx.write({ outputType: "blob" });
        if (!(presentation instanceof Blob)) throw new Error("PowerPoint generation returned an invalid file.");
        if (!window.JSZip) throw new Error("PowerPoint slide transitions could not be added because the bundled ZIP utility is unavailable.");
        const archive = await window.JSZip.loadAsync(presentation);
        const slideFiles = Object.keys(archive.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
        if (!slideFiles.length) throw new Error("PowerPoint generation returned a presentation with no slides.");
        await Promise.all(slideFiles.map(async name => {
            const file = archive.file(name);
            const xml = await file.async("string");
            const transition = '<p:transition spd="med"><p:fade/></p:transition>';
            const updated = xml.includes("</p:clrMapOvr>")
                ? xml.replace("</p:clrMapOvr>", `</p:clrMapOvr>${transition}`)
                : xml.replace("</p:cSld>", `</p:cSld>${transition}`);
            if (updated === xml) throw new Error(`Could not add a transition to ${name}.`);
            archive.file(name, updated);
        }));
        const interactivePresentation = await archive.generateAsync({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            compression: "DEFLATE",
            compressionOptions: { level: 4 }
        });
        addDownload(interactivePresentation, filename);
    }

    function updateChartControls() {
        if (!api) return;
        let report;
        try { report = api.getReport(); } catch (error) { return; }
        const available = new Set((report.indicators || []).filter(item =>
            Array.isArray(item.history) && item.history.length
        ).map(item => item.key));
        const chartsSelected = document.querySelector('input[name="globeExportSection"][value="charts"]').checked;
        document.querySelectorAll('input[name="globeExportChart"]').forEach(input => {
            const unavailable = !available.has(input.value);
            input.dataset.unavailable = String(unavailable);
            input.disabled = unavailable || !chartsSelected;
            if (unavailable) input.checked = false;
        });
    }

    function toggleChartChoices() {
        const chartsSection = document.querySelector('input[name="globeExportSection"][value="charts"]');
        const disabled = !chartsSection.checked;
        document.querySelectorAll('input[name="globeExportChart"]').forEach(input => { input.disabled = disabled || input.dataset.unavailable === "true"; });
    }

    function mount(options) {
        if (mounted) return;
        mounted = true;
        api = options;
        const toggle = $("globeExportToggle");
        const center = $("globeExportCenter");
        const form = $("globeExportForm");
        toggle.addEventListener("click", () => {
            const opening = center.hidden;
            center.hidden = !opening;
            toggle.setAttribute("aria-expanded", String(opening));
            if (opening) updateChartControls();
        });
        document.querySelectorAll('input[name="globeExportSection"]').forEach(input => input.addEventListener("change", () => {
            if (input.value === "charts") updateChartControls();
            else toggleChartChoices();
        }));
        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (busy) return;
            busy = true;
            const button = $("globeExportGenerate");
            const format = $("globeExportFormat").value;
            button.disabled = true;
            button.setAttribute("aria-busy", "true");
            const previousText = button.textContent;
            button.textContent = "Generating…";
            status(`Generating ${format.toUpperCase()} report…`, false);
            try {
                if (window.EconIntel.GlobalModules) await window.EconIntel.GlobalModules.init();
                const report = selectedReport();
                const filename = `econ-intelligence-${safeFilename(report.country.name)}-report.${format}`;
                if (format === "pdf") await generatePdf(report, filename);
                else if (format === "docx") await generateDocx(report, filename);
                else if (format === "pptx") await generatePptx(report, filename);
                else if (format === "html") await generateHtml(report, filename);
                else throw new Error("Choose a supported report format.");
                status(report.liveUrl
                    ? `${filename} is ready. Document maps are snapshots; use the linked platform for the live globe.`
                    : `${filename} is ready. This local instance has no public platform URL; the live globe remains in the app.`, false);
            } catch (error) {
                console.error("Country report generation failed:", error);
                status(`Could not generate the report: ${error.message || "An unexpected error occurred."}`, true);
            } finally {
                busy = false;
                button.disabled = false;
                button.removeAttribute("aria-busy");
                button.textContent = previousText;
            }
        });
        updateChartControls();
        toggleChartChoices();
    }

    window.EconIntel.GlobeExport = { mount };
}());
