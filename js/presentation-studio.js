(function () {
    "use strict";

    const ENDPOINT = "/.netlify/functions/ai-presentation";
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const MAX_ASSIGNMENT_LENGTH = 16000;
    const FALLBACK_COUNTRIES = [
        ["UZB", "Uzbekistan", "uz"], ["USA", "United States", "us"], ["CHN", "China", "cn"],
        ["IND", "India", "in"], ["DEU", "Germany", "de"], ["JPN", "Japan", "jp"],
        ["GBR", "United Kingdom", "gb"], ["FRA", "France", "fr"], ["BRA", "Brazil", "br"],
        ["IDN", "Indonesia", "id"], ["TUR", "Türkiye", "tr"], ["KOR", "South Korea", "kr"],
        ["ZAF", "South Africa", "za"], ["MEX", "Mexico", "mx"], ["CAN", "Canada", "ca"],
        ["AUS", "Australia", "au"], ["KAZ", "Kazakhstan", "kz"], ["SGP", "Singapore", "sg"],
        ["NGA", "Nigeria", "ng"], ["EGY", "Egypt", "eg"], ["SAU", "Saudi Arabia", "sa"],
        ["ARE", "United Arab Emirates", "ae"], ["ITA", "Italy", "it"], ["ESP", "Spain", "es"],
        ["NLD", "Netherlands", "nl"], ["CHE", "Switzerland", "ch"], ["SWE", "Sweden", "se"],
        ["POL", "Poland", "pl"], ["ARG", "Argentina", "ar"], ["VNM", "Vietnam", "vn"]
    ].map(([code, name, alpha2]) => ({ code, name, alpha2 }));
    const state = {
        countries: FALLBACK_COUNTRIES.slice(),
        plan: null,
        presentation: null,
        busy: false
    };
    const $ = id => document.getElementById(id);

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
    }

    function safeHttps(value) {
        try {
            const url = new URL(value);
            return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
        } catch (error) {
            return "";
        }
    }

    function setStatus(message, kind) {
        const status = $("presentationStatus");
        status.textContent = message;
        status.classList.toggle("is-error", kind === "error");
        status.classList.toggle("is-success", kind === "success");
    }

    function setProgress(percent, activeStep) {
        $("presentationProgressBar").style.width = `${Math.max(0, Math.min(100, percent))}%`;
        document.querySelectorAll("#presentationSteps [data-step]").forEach(step => {
            const steps = ["analyze", "research", "generate"];
            const currentIndex = steps.indexOf(activeStep);
            const stepIndex = steps.indexOf(step.dataset.step);
            step.classList.toggle("is-current", stepIndex === currentIndex);
            step.classList.toggle("is-done", activeStep === "complete"
                || stepIndex >= 0 && currentIndex >= 0 && stepIndex < currentIndex);
        });
    }

    function setBusy(busy, activeButton) {
        state.busy = busy;
        document.querySelectorAll("#presentationForm button, #presentationPlan button, #presentationResult button")
            .forEach(button => { button.disabled = busy; });
        if (activeButton) activeButton.disabled = busy;
        $("presentationForm").setAttribute("aria-busy", String(busy));
    }

    async function readJsonResponse(response) {
        const contentType = response.headers.get("Content-Type") || "";
        const body = contentType.includes("application/json") ? await response.json() : {};
        if (!response.ok) {
            throw new Error(typeof body.error === "string" ? body.error : `The presentation service returned HTTP ${response.status}.`);
        }
        return body;
    }

    async function postAction(action, values) {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        let timeout;
        try {
            const request = fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ action, ...values }),
                ...(controller ? { signal: controller.signal } : {})
            }).then(readJsonResponse);
            const timeoutRequest = new Promise((resolve, reject) => {
                timeout = window.setTimeout(() => {
                    if (controller) controller.abort();
                    reject(new Error("The research request timed out. Please try again."));
                }, 55000);
            });
            return await Promise.race([request, timeoutRequest]);
        } catch (error) {
            if (error.name === "TypeError" && location.protocol === "file:") {
                throw new Error("AI Presentation Studio needs the deployed Netlify site so its secure server function can run.");
            }
            throw error;
        } finally {
            if (timeout) window.clearTimeout(timeout);
        }
    }

    function renderCountryOptions() {
        const select = $("presentationCountry");
        const previous = select.value;
        const sorted = state.countries.slice().sort((left, right) => left.name.localeCompare(right.name));
        select.replaceChildren();
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select a country";
        select.appendChild(placeholder);
        sorted.forEach(country => {
            const option = document.createElement("option");
            option.value = country.code;
            option.textContent = country.name;
            option.dataset.name = country.name;
            option.dataset.alpha2 = country.alpha2 || "";
            select.appendChild(option);
        });
        select.value = sorted.some(country => country.code === previous) ? previous : "UZB";
        select.disabled = $("presentationCountryMode").value !== "manual";
    }

    async function loadCountries() {
        try {
            const response = await fetch("https://api.worldbank.org/v2/country?format=json&per_page=400", {
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error(`World Bank country directory returned HTTP ${response.status}.`);
            const result = await response.json();
            if (!Array.isArray(result) || !Array.isArray(result[1])) throw new Error("The World Bank country directory had an unexpected format.");
            const records = result[1].filter(country => country && country.id && country.name
                && country.region && country.region.value && country.region.value !== "Aggregates")
                .map(country => ({
                    code: String(country.id).toUpperCase(),
                    name: String(country.name),
                    alpha2: String(country.iso2Code || "").toLowerCase()
                }));
            if (!records.length) throw new Error("The World Bank country directory contained no countries.");
            state.countries = records;
            $("presentationCountryStatus").textContent = "World Bank country directory loaded.";
        } catch (error) {
            $("presentationCountryStatus").textContent = `Country directory unavailable; a curated country list is available. ${error.message}`;
            console.warn("Could not load the World Bank country directory for Presentation Studio:", error);
        }
        renderCountryOptions();
    }

    async function checkService() {
        try {
            const response = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
            const result = await readJsonResponse(response);
            $("presentationProviderStatus").innerHTML = `<i></i> ${result.configured
                ? `Research enabled · ${escapeHtml(result.model || "AI")}`
                : "Server-side AI provider not configured"}`;
            $("presentationProviderStatus").classList.toggle("is-unavailable", !result.configured);
        } catch (error) {
            $("presentationProviderStatus").innerHTML = `<i></i> AI research service unavailable`;
            $("presentationProviderStatus").classList.add("is-unavailable");
            console.warn("Could not check the Presentation Studio service:", error);
        }
    }

    function clearResults() {
        state.plan = null;
        state.presentation = null;
        $("presentationPlan").hidden = true;
        $("presentationResult").hidden = true;
    }

    function renderSources(sources) {
        return sources.map(source => {
            const url = safeHttps(source.url);
            if (!url) return "";
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)} · ${escapeHtml(source.hostname || new URL(url).hostname)}</a>`;
        }).join("");
    }

    function renderPlan(plan) {
        $("presentationPlan").hidden = false;
        $("presentationResult").hidden = true;
        $("presentationPlanCount").textContent = `${plan.slideCount} SLIDES`;
        $("presentationSelectedCountry").textContent = plan.country;
        $("presentationCountryReason").textContent = plan.countryReason;
        $("presentationPlanLanguage").textContent = plan.language;
        $("presentationPlanSlides").textContent = String(plan.slideCount);
        $("presentationPlanSections").innerHTML = (plan.sections || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")
            || "<li>No explicit sections listed.</li>";
        $("presentationPlanFormatting").innerHTML = (plan.formatting || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")
            || "<li>No specific formatting rules identified.</li>";
        $("presentationPlanSources").innerHTML = renderSources(plan.sources || []);
        $("presentationPlanTitleText").textContent = plan.title || "Presentation outline";
        $("presentationOutline").innerHTML = plan.outline.map((item, index) =>
            `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.purpose)}</p></div></li>`
        ).join("");
    }

    function currentInputs() {
        const assignment = $("presentationAssignment").value.trim();
        if (assignment.length < 40) throw new Error("Paste or upload at least 40 characters of assignment requirements.");
        const mode = $("presentationCountryMode").value;
        const selectedOption = $("presentationCountry").selectedOptions[0];
        const slideValue = $("presentationSlideCount").value;
        return {
            assignment,
            countryMode: mode,
            country: mode === "manual" ? selectedOption.value ? selectedOption.textContent : "" : "",
            countries: state.countries.map(country => ({ code: country.code, name: country.name })),
            language: $("presentationLanguage").value,
            slideCount: slideValue === "auto" ? null : Number(slideValue)
        };
    }

    async function analyzeAssignment() {
        if (state.busy) return;
        let input;
        try {
            input = currentInputs();
        } catch (error) {
            setStatus(error.message, "error");
            $("presentationAssignment").focus();
            return;
        }
        clearResults();
        setBusy(true, $("analyzeAssignment"));
        setProgress(10, "analyze");
        setStatus("Reading requirements and preparing the research plan…");
        try {
            const result = await postAction("prepare", input);
            if (!result.plan || !Array.isArray(result.plan.outline)) throw new Error("The service returned an incomplete assignment analysis.");
            state.plan = result.plan;
            renderPlan(state.plan);
            setProgress(42, "research");
            setStatus("Analysis complete. Review the country choice and outline before generating slides.", "success");
            $("presentationPlan").scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
            setProgress(0, "analyze");
            setStatus(error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    function safePresentation(presentation) {
        if (!presentation || !Array.isArray(presentation.slides) || !Array.isArray(presentation.sources)) {
            throw new Error("The service returned an incomplete presentation.");
        }
        const sources = presentation.sources.filter(source => source && source.id && safeHttps(source.url));
        if (!sources.length) throw new Error("The generated slides do not contain verifiable web sources.");
        const sourceIds = new Set(sources.map(source => source.id));
        const slides = presentation.slides.map(slide => {
            if (!slide || !Array.isArray(slide.sourceIds) || !Array.isArray(slide.bullets)) {
                throw new Error("A generated slide is missing required content or citations.");
            }
            const citations = slide.sourceIds.filter(id => sourceIds.has(id));
            if (slide.kind !== "cover" && !citations.length) {
                throw new Error(`“${slide.title || "A slide"}” has no verifiable citation. Regenerate the content.`);
            }
            const chart = slide.chart && Array.isArray(slide.chart.labels) && Array.isArray(slide.chart.values)
                && slide.chart.labels.length >= 2 && slide.chart.labels.length <= 8
                && slide.chart.labels.length === slide.chart.values.length
                && slide.chart.values.every(value => Number.isFinite(value))
                ? slide.chart : { labels: [], values: [], unit: "", sourceUrl: "" };
            return {
                ...slide,
                title: String(slide.title || "").slice(0, 180),
                summary: String(slide.summary || "").slice(0, 1200),
                bullets: slide.bullets.slice(0, 6).map(item => String(item).slice(0, 280)),
                metrics: (Array.isArray(slide.metrics) ? slide.metrics : []).slice(0, 3),
                chart,
                sourceIds: citations
            };
        });
        return { ...presentation, slides, sources };
    }

    function renderPresentation(presentation) {
        const sourceMap = new Map(presentation.sources.map(source => [source.id, source]));
        $("presentationResult").hidden = false;
        $("presentationResultCount").textContent = `${presentation.slides.length + 1} SLIDES · ${presentation.sources.length} SOURCES`;
        $("presentationGeneratedTitle").textContent = presentation.title || state.plan.title;
        $("presentationGeneratedSubtitle").textContent = presentation.subtitle || `${state.plan.country} · ${state.plan.language}`;
        $("presentationGeneratedCountry").textContent = state.plan.countryCode || state.plan.country;
        $("presentationSlidesPreview").innerHTML = presentation.slides.map((slide, index) => {
            const metrics = slide.metrics.map(metric =>
                `<div class="studio-metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)} ${escapeHtml(metric.unit)}</strong><small>${escapeHtml(metric.period)}</small></div>`
            ).join("");
            const chart = slide.chart.labels.length
                ? `<p class="studio-chart-note">Cited chart · ${slide.chart.labels.length} reported observations · ${escapeHtml(slide.chart.unit)}</p>`
                : "";
            const sources = slide.sourceIds.map(id => sourceMap.get(id)).filter(Boolean);
            return `<article class="studio-slide-card">
                <header><span>SLIDE ${String(index + 1).padStart(2, "0")}</span><b>${escapeHtml(slide.kind)}</b></header>
                <h3>${escapeHtml(slide.title)}</h3>
                <p>${escapeHtml(slide.summary)}</p>
                ${slide.bullets.length ? `<ul>${slide.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
                ${metrics ? `<div class="studio-metrics">${metrics}</div>` : ""}
                ${chart}
                <footer>${renderSources(sources)}</footer>
            </article>`;
        }).join("");
        $("presentationReferences").innerHTML = presentation.sources.map((source, index) => {
            const url = safeHttps(source.url);
            return `<li><span>[S${index + 1}] ${escapeHtml(source.title)}</span><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></li>`;
        }).join("");
        $("presentationDownloadStatus").textContent = "";
        $("presentationResult").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function generatePresentation(regenerate) {
        if (state.busy) return;
        if (!state.plan) {
            setStatus("Analyze an assignment before generating slides.", "error");
            return;
        }
        let input;
        try {
            input = currentInputs();
        } catch (error) {
            setStatus(error.message, "error");
            return;
        }
        setBusy(true, regenerate ? $("regeneratePresentation") : $("generatePresentation"));
        setProgress(62, "generate");
        setStatus(regenerate ? "Researching and regenerating the slide content…" : "Researching the selected country and writing cited slides…");
        $("presentationPlan").hidden = true;
        $("presentationResult").hidden = true;
        try {
            const result = await postAction("generate", {
                assignment: input.assignment,
                plan: state.plan,
                regenerateNonce: regenerate ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` : ""
            });
            state.presentation = safePresentation(result.presentation);
            renderPresentation(state.presentation);
            setProgress(100, "complete");
            setStatus("Research and slide review are ready. Download the PowerPoint when satisfied.", "success");
        } catch (error) {
            $("presentationPlan").hidden = Boolean(previousPresentation);
            $("presentationResult").hidden = !previousPresentation;
            setProgress(42, "research");
            setStatus(error.message, "error");
        } finally {
            setBusy(false);
        }
    }

    async function readPdf(file) {
        if (!window.pdfjsLib) throw new Error("PDF reader did not load. Check the connection and reload the page.");
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 80); pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            pages.push(content.items.map(item => item.str || "").join(" "));
            if (pages.join("\n").length > MAX_ASSIGNMENT_LENGTH) break;
        }
        return pages.join("\n\n").slice(0, MAX_ASSIGNMENT_LENGTH);
    }

    async function readDocx(file) {
        if (!window.mammoth) throw new Error("DOCX reader did not load. Check the connection and reload the page.");
        const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        return String(result.value || "").trim().slice(0, MAX_ASSIGNMENT_LENGTH);
    }

    async function handleFile(file) {
        if (!file) return;
        clearResults();
        $("presentationFileName").textContent = file.name;
        if (file.size > MAX_FILE_SIZE) {
            $("presentationFileStatus").textContent = "This file is larger than 20 MB. Choose a smaller PDF or DOCX.";
            $("presentationFileStatus").classList.add("is-error");
            return;
        }
        $("presentationFileStatus").classList.remove("is-error");
        $("presentationFileStatus").textContent = "Extracting assignment text in your browser…";
        try {
            const extension = file.name.toLocaleLowerCase().split(".").pop();
            const text = extension === "pdf" ? await readPdf(file)
                : extension === "docx" ? await readDocx(file)
                    : "";
            if (!text.trim()) throw new Error("No readable text was found. If this is a scanned PDF, run OCR and upload it again.");
            $("presentationAssignment").value = text;
            $("presentationAssignment").dispatchEvent(new Event("input", { bubbles: true }));
            $("presentationFileStatus").textContent = `Text extracted from ${file.name} · ${text.length.toLocaleString()} characters. Review it before analysis.`;
        } catch (error) {
            $("presentationFileStatus").textContent = error.message;
            $("presentationFileStatus").classList.add("is-error");
        }
    }

    function addSlideBackground(slide, pptx) {
        slide.background = { color: "071522" };
        slide.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: 0.13, h: 7.5,
            line: { color: "071522", transparency: 100 },
            fill: { color: "13C5D8" }
        });
        slide.addShape(pptx.ShapeType.line, {
            x: 0.7, y: 0.95, w: 11.9, h: 0,
            line: { color: "18384B", width: 0.8 }
        });
    }

    function addSlideTitle(slide, pptx, title, index, total) {
        slide.addText("ECON INTELLIGENCE  /  ACADEMIC RESEARCH", {
            x: 0.74, y: 0.35, w: 8.5, h: 0.22, fontFace: "Aptos", fontSize: 8,
            bold: true, charSpacing: 1.4, color: "56D9E7", margin: 0
        });
        slide.addText(title, {
            x: 0.74, y: 1.12, w: 11.8, h: 0.75, fontFace: "Aptos Display",
            fontSize: title.length > 58 ? 23 : 29, bold: true, color: "F2F7FC",
            breakLine: false, fit: "shrink", margin: 0
        });
        slide.addText(`${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
            x: 11.3, y: 0.35, w: 1.25, h: 0.22, fontFace: "Aptos",
            fontSize: 8, color: "90A9BC", align: "right", margin: 0
        });
        slide.addShape(pptx.ShapeType.line, {
            x: 0.74, y: 2.01, w: 0.7, h: 0,
            line: { color: "13C5D8", width: 2.6 }
        });
    }

    function addSlideSources(slide, pptx, slideData, sourceMap) {
        const sources = [...new Set(slideData.sourceIds || [])].map(id => sourceMap.get(id)).filter(Boolean);
        if (!sources.length) return;
        const runs = [];
        sources.slice(0, 4).forEach((source, index) => {
            if (index) runs.push({ text: "   ·   ", options: { color: "557184" } });
            runs.push({
                text: `[${source.id}] ${source.hostname || source.title}`,
                options: { color: "64C8D6", hyperlink: { url: source.url }, underline: { color: "64C8D6" } }
            });
        });
        slide.addText(runs, {
            x: 0.76, y: 6.98, w: 11.7, h: 0.22,
            fontFace: "Aptos", fontSize: 8, color: "8CA5B6", margin: 0,
            breakLine: false, fit: "shrink"
        });
        slide.addShape(pptx.ShapeType.line, {
            x: 0.75, y: 6.84, w: 11.8, h: 0,
            line: { color: "18384B", width: 0.6 }
        });
    }

    function addSummaryAndBullets(slide, pptx, slideData, startY) {
        let y = startY;
        if (slideData.summary) {
            slide.addText(slideData.summary, {
                x: 0.82, y, w: 11.5, h: 0.95, fontFace: "Aptos",
                fontSize: 16, color: "BDCAD5", breakLine: false, valign: "mid",
                fit: "shrink", margin: 0.04, paraSpaceAfterPt: 6
            });
            y += 1.08;
        }
        slideData.bullets.forEach((text, index) => {
            const height = text.length > 130 ? 0.55 : 0.38;
            slide.addShape(pptx.ShapeType.ellipse, {
                x: 0.86, y: y + 0.11, w: 0.09, h: 0.09,
                line: { color: "45D9ED", transparency: 100 },
                fill: { color: index === 0 ? "45D9ED" : "59B7CC" }
            });
            slide.addText(text, {
                x: 1.12, y, w: 11.1, h: height, fontFace: "Aptos",
                fontSize: 15, color: "DFE8EF", breakLine: false, valign: "mid",
                fit: "shrink", margin: 0
            });
            y += height + 0.15;
        });
    }

    function addMetricCards(slide, pptx, metrics) {
        const cards = metrics.slice(0, 3);
        const gap = 0.18;
        const width = (11.5 - gap * (cards.length - 1)) / cards.length;
        cards.forEach((metric, index) => {
            const x = 0.82 + index * (width + gap);
            slide.addShape(pptx.ShapeType.roundRect, {
                x, y: 3.25, w: width, h: 1.72, rectRadius: 0.08,
                line: { color: "21465A", width: 0.8 },
                fill: { color: "0D2232" }
            });
            slide.addText(metric.label, {
                x: x + 0.18, y: 3.47, w: width - 0.36, h: 0.35,
                fontFace: "Aptos", fontSize: 10, bold: true, color: "93AFC0",
                fit: "shrink", margin: 0
            });
            slide.addText(`${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`, {
                x: x + 0.18, y: 3.92, w: width - 0.36, h: 0.57,
                fontFace: "Aptos Display", fontSize: 24, bold: true, color: "66E4EF",
                fit: "shrink", margin: 0
            });
            slide.addText(metric.period || "", {
                x: x + 0.18, y: 4.59, w: width - 0.36, h: 0.22,
                fontFace: "Aptos", fontSize: 9, color: "839BAD", margin: 0
            });
        });
    }

    function addChart(slide, pptx, slideData) {
        const chart = slideData.chart;
        if (!chart || chart.labels.length < 2 || chart.labels.length !== chart.values.length) return false;
        try {
            slide.addChart(pptx.ChartType && pptx.ChartType.bar || "bar", [{
                name: chart.unit || slideData.title,
                labels: chart.labels,
                values: chart.values
            }], {
                x: 0.88, y: 2.35, w: 11.2, h: 4.1,
                catAxisLabelFontFace: "Aptos",
                catAxisLabelFontSize: 11,
                catAxisLabelColor: "B3C5D1",
                valAxisLabelFontFace: "Aptos",
                valAxisLabelFontSize: 9,
                valAxisLabelColor: "829BAC",
                valAxisLabelFormatCode: "0.##",
                valAxisMinVal: Math.min(0, ...chart.values),
                valAxisMaxVal: Math.max(...chart.values) * 1.15 || 1,
                chartColors: ["16BFD4"],
                showLegend: false,
                showTitle: false,
                showCatName: false,
                showSerName: false,
                showValAxisTitle: false,
                showCatAxisTitle: false,
                showBorder: false,
                showMarker: false,
                showValue: true,
                showDataLabel: true,
                dataLabelPosition: "outEnd",
                dataLabelColor: "D7E5ED",
                dataLabelFormatCode: "0.##",
                showGridLines: true,
                valGridLine: { color: "1A3548", width: 0.7 },
                catAxisLineColor: "315065",
                valAxisLineColor: "315065",
                showLeaderLines: false
            });
            return true;
        } catch (error) {
            console.warn("Could not add an editable chart to the presentation; using a native bar visual instead:", error);
            const max = Math.max(...chart.values.map(Math.abs), 1);
            chart.values.forEach((value, index) => {
                const y = 2.55 + index * 0.49;
                const barW = Math.max(0.08, Math.abs(value) / max * 7.3);
                slide.addText(chart.labels[index], { x: 1, y, w: 2.4, h: 0.26, fontFace: "Aptos", fontSize: 10, color: "B3C5D1", margin: 0 });
                slide.addShape(pptx.ShapeType.rect, {
                    x: 3.5, y: y + 0.03, w: barW, h: 0.2,
                    line: { color: "16BFD4", transparency: 100 }, fill: { color: "16BFD4" }
                });
                slide.addText(`${value} ${chart.unit}`, { x: 3.6 + barW, y, w: 2.2, h: 0.26, fontFace: "Aptos", fontSize: 9, color: "D7E5ED", margin: 0 });
            });
            return true;
        }
    }

    function addCover(pptx, slideData, presentation, country, flagData) {
        const slide = pptx.addSlide();
        slide.background = { color: "071522" };
        slide.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: 0.18, h: 7.5,
            line: { color: "071522", transparency: 100 }, fill: { color: "13C5D8" }
        });
        slide.addShape(pptx.ShapeType.ellipse, {
            x: 8.65, y: 0.85, w: 3.4, h: 3.4,
            line: { color: "16445A", width: 1.3, transparency: 12 },
            fill: { color: "071522", transparency: 100 }
        });
        slide.addShape(pptx.ShapeType.ellipse, {
            x: 9.18, y: 1.38, w: 2.34, h: 2.34,
            line: { color: "176C7B", width: 1.1, transparency: 12 },
            fill: { color: "071522", transparency: 100 }
        });
        slide.addShape(pptx.ShapeType.ellipse, {
            x: 9.81, y: 2.01, w: 1.08, h: 1.08,
            line: { color: "13C5D8", width: 1.2, transparency: 0 },
            fill: { color: "0D2839" }
        });
        slide.addText("ECON INTELLIGENCE  /  PRESENTATION STUDIO", {
            x: 0.88, y: 0.85, w: 7.5, h: 0.28, fontFace: "Aptos", fontSize: 9,
            bold: true, charSpacing: 1.5, color: "66DCE8", margin: 0
        });
        slide.addShape(pptx.ShapeType.line, {
            x: 0.88, y: 1.43, w: 0.72, h: 0,
            line: { color: "13C5D8", width: 2.6 }
        });
        const title = presentation.title || slideData.title;
        slide.addText(title, {
            x: 0.88, y: 1.9, w: 7.3, h: 1.55,
            fontFace: "Aptos Display", fontSize: title.length > 62 ? 28 : 36,
            bold: true, color: "F2F7FC", breakLine: false, valign: "mid",
            fit: "shrink", margin: 0
        });
        slide.addText(presentation.subtitle || slideData.summary || "", {
            x: 0.9, y: 3.72, w: 7.1, h: 0.8,
            fontFace: "Aptos", fontSize: 16, color: "AABCC9",
            breakLine: false, valign: "top", fit: "shrink", margin: 0
        });
        slide.addShape(pptx.ShapeType.line, {
            x: 0.9, y: 5.2, w: 6.8, h: 0,
            line: { color: "23475A", width: 0.8 }
        });
        slide.addText(country, {
            x: 0.9, y: 5.48, w: 5.9, h: 0.48,
            fontFace: "Aptos", fontSize: 20, bold: true, color: "65DBE7", margin: 0
        });
        slide.addText(`Prepared ${new Date().toLocaleDateString()}`, {
            x: 0.9, y: 6.08, w: 5.2, h: 0.28,
            fontFace: "Aptos", fontSize: 10, color: "829AAA", margin: 0
        });
        if (flagData) {
            slide.addImage({ data: flagData, x: 10.02, y: 2.26, w: 0.66, h: 0.48, sizing: "contain" });
        }
        return slide;
    }

    async function flagImageData(countryCode) {
        const country = state.countries.find(item => item.code === countryCode)
            || state.countries.find(item => item.name.toLocaleLowerCase() === String(state.plan.country).toLocaleLowerCase());
        if (!country || !country.alpha2) return null;
        const response = await fetch(`https://flagcdn.com/w160/${encodeURIComponent(country.alpha2.toLowerCase())}.png`);
        if (!response.ok) throw new Error(`Flag image returned HTTP ${response.status}.`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Could not read the optional country flag image."));
            reader.readAsDataURL(blob);
        });
    }

    async function downloadPowerPoint() {
        if (!state.presentation || state.busy) return;
        if (!window.PptxGenJS) {
            $("presentationDownloadStatus").textContent = "PowerPoint generator did not load. Check the connection and reload the page.";
            $("presentationDownloadStatus").classList.add("is-error");
            return;
        }
        const button = $("downloadPresentation");
        button.disabled = true;
        $("presentationDownloadStatus").classList.remove("is-error");
        $("presentationDownloadStatus").textContent = "Building the PowerPoint file…";
        try {
            let flagData = null;
            try {
                flagData = await flagImageData(state.plan.countryCode);
            } catch (error) {
                console.warn("Optional country flag could not be added to the PowerPoint:", error);
                $("presentationDownloadStatus").textContent = "Country flag image unavailable; the built-in visual theme will be used.";
            }
            const presentation = state.presentation;
            const pptx = new window.PptxGenJS();
            pptx.layout = "LAYOUT_WIDE";
            pptx.author = "ECON Intelligence · AI Presentation Studio";
            pptx.subject = `${state.plan.country} · Source-cited academic presentation`;
            pptx.title = presentation.title || state.plan.title;
            pptx.company = "ECON Intelligence";
            pptx.lang = state.plan.language === "Uzbek" ? "uz-UZ" : state.plan.language === "Russian" ? "ru-RU" : "en-US";
            pptx.theme = {
                headFontFace: "Aptos Display",
                bodyFontFace: "Aptos",
                lang: pptx.lang
            };
            const sourceMap = new Map(presentation.sources.map(source => [source.id, source]));
            const allSlides = presentation.slides;
            addCover(pptx, allSlides[0], presentation, state.plan.country, flagData);
            for (let index = 1; index < allSlides.length; index++) {
                const data = allSlides[index];
                const slide = pptx.addSlide();
                addSlideBackground(slide, pptx);
                addSlideTitle(slide, pptx, data.title, index + 1, allSlides.length + 1);
                if (data.kind === "chart" && addChart(slide, pptx, data)) {
                    if (data.summary) slide.addText(data.summary, {
                        x: 0.82, y: 2.13, w: 11.5, h: 0.38, fontFace: "Aptos",
                        fontSize: 12, color: "AFC1CD", fit: "shrink", margin: 0
                    });
                    slide.addText(data.chart.unit ? `Reported values · ${data.chart.unit}` : "Reported values", {
                        x: 0.92, y: 6.48, w: 10.8, h: 0.23,
                        fontFace: "Aptos", fontSize: 9, color: "7F9AAA", margin: 0
                    });
                } else {
                    if (data.metrics.length) {
                        if (data.summary) slide.addText(data.summary, {
                            x: 0.82, y: 2.25, w: 11.5, h: 0.82, fontFace: "Aptos",
                            fontSize: 15, color: "BDCAD5", fit: "shrink", margin: 0.03
                        });
                        addMetricCards(slide, pptx, data.metrics);
                        data.bullets.slice(0, 2).forEach((bullet, bulletIndex) => {
                            slide.addText(`•  ${bullet}`, {
                                x: 0.9, y: 5.28 + bulletIndex * 0.48, w: 11.25, h: 0.38,
                                fontFace: "Aptos", fontSize: 13, color: "DFE8EF", fit: "shrink", margin: 0
                            });
                        });
                    } else {
                        addSummaryAndBullets(slide, pptx, data, 2.3);
                    }
                }
                addSlideSources(slide, pptx, data, sourceMap);
            }
            const references = pptx.addSlide();
            addSlideBackground(references, pptx);
            addSlideTitle(references, pptx, "Research references", allSlides.length + 1, allSlides.length + 1);
            references.addText("Sources discovered through web research and cited in the presentation.", {
                x: 0.82, y: 2.18, w: 11.4, h: 0.38, fontFace: "Aptos", fontSize: 13, color: "AFC1CD", margin: 0
            });
            presentation.sources.forEach((source, index) => {
                    const column = index < 5 ? 0 : 1;
                    const row = index % 5;
                    const x = 0.88 + column * 5.95;
                    const y = 2.78 + row * 0.76;
                references.addText(`[${source.id}] ${source.title}`, {
                        x, y, w: 5.5, h: 0.3, fontFace: "Aptos", fontSize: 10,
                    bold: true, color: "DDE9EF", fit: "shrink", margin: 0
                });
                references.addText(source.url, {
                        x: x + 0.14, y: y + 0.32, w: 5.32, h: 0.28, fontFace: "Aptos",
                        fontSize: 7, color: "5FD7E5", hyperlink: { url: source.url }, underline: { color: "5FD7E5" },
                    fit: "shrink", margin: 0
                });
            });
            await pptx.writeFile({
                fileName: `ECON-Intelligence-${state.plan.country.replace(/[^a-z0-9]+/gi, "-")}-presentation.pptx`
            });
            $("presentationDownloadStatus").textContent = `PowerPoint downloaded · ${allSlides.length + 1} slides · ${presentation.sources.length} cited sources.`;
        } catch (error) {
            console.error("Could not build the AI presentation PowerPoint:", error);
            $("presentationDownloadStatus").textContent = `PowerPoint export failed: ${error.message}`;
            $("presentationDownloadStatus").classList.add("is-error");
        } finally {
            button.disabled = false;
        }
    }

    function bind() {
        renderCountryOptions();
        $("presentationForm").addEventListener("submit", event => {
            event.preventDefault();
            analyzeAssignment();
        });
        $("presentationCountryMode").addEventListener("change", () => {
            $("presentationCountry").disabled = $("presentationCountryMode").value !== "manual";
        });
        $("presentationFile").addEventListener("change", () => handleFile($("presentationFile").files[0]));
        $("presentationAssignment").addEventListener("input", () => {
            if (state.plan || state.presentation) {
                clearResults();
                setProgress(0, "analyze");
                setStatus("Assignment changed. Analyze it again to refresh the plan and citations.");
            }
        });
        ["presentationCountryMode", "presentationCountry", "presentationLanguage", "presentationSlideCount"].forEach(id => {
            $(id).addEventListener("change", () => {
                if (state.plan || state.presentation) {
                    clearResults();
                    setProgress(0, "analyze");
                    setStatus("Presentation settings changed. Analyze the assignment again to refresh the plan.");
                }
            });
        });
        $("reanalyzeAssignment").addEventListener("click", analyzeAssignment);
        $("generatePresentation").addEventListener("click", () => generatePresentation(false));
        $("regeneratePresentation").addEventListener("click", () => generatePresentation(true));
        $("downloadPresentation").addEventListener("click", downloadPowerPoint);
        checkService();
        loadCountries();
    }

    document.addEventListener("DOMContentLoaded", bind);
}());
