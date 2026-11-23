(function () {
    "use strict";

    const GEOJSON_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
    const NS = "http://www.w3.org/2000/svg";
    let svg;
    let tooltip;
    let wrap;
    let projection;
    let path;
    let features = [];
    let countries = Object.create(null);
    let onSelect = () => {};
    let selectedCodes = [];
    let focusedCode = "";
    let rotation = [-10, -10, 0];
    let viewMode = "globe";
    let drag = null;
    let translate = [480, 480];
    let zoom = 1;
    let zoomTarget = 1;
    let zoomFrame = 0;
    let zoomOutput;
    let pinch = null;
    let resizeFrame = 0;
    const activePointers = new Map();
    let suppressClick = false;

    const aliases = {
        "United States of America": "USA",
        Russia: "RUS",
        "South Korea": "KOR",
        "North Korea": "PRK",
        "Democratic Republic of the Congo": "COD",
        "Republic of the Congo": "COG",
        "Ivory Coast": "CIV",
        "Eswatini": "SWZ",
        Swaziland: "SWZ",
        "East Timor": "TLS",
        "Timor Leste": "TLS",
        Turkey: "TUR",
        "Türkiye": "TUR",
        Syria: "SYR",
        Iran: "IRN",
        Vietnam: "VNM",
        Laos: "LAO",
        Brunei: "BRN",
        Bahamas: "BHS",
        Gambia: "GMB",
        Egypt: "EGY",
        Venezuela: "VEN",
        Bolivia: "BOL",
        Micronesia: "FSM",
        Moldova: "MDA",
        Palestine: "PSE"
    };

    function normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]/g, "");
    }

    function featureName(feature) {
        const properties = feature.properties || {};
        return properties.ADMIN || properties.NAME_EN || properties.NAME || "Unknown country";
    }

    function featureCode(feature, nameIndex) {
        const properties = feature.properties || {};
        const globalCountries = window.EconIntel.GlobalData && window.EconIntel.GlobalData.state.byCode;
        const candidates = [
            properties.ISO_A3_EH,
            properties.ISO_A3,
            properties.ADM0_A3,
            properties.WB_A3
        ];
        for (const candidate of candidates) {
            if (candidate && candidate !== "-99" && (countries[candidate] || globalCountries && globalCountries[candidate])) return candidate;
        }
        const alias = aliases[featureName(feature)];
        if (alias && (countries[alias] || globalCountries && globalCountries[alias])) return alias;
        return nameIndex.get(normalize(featureName(feature))) || `name:${normalize(featureName(feature))}`;
    }

    function createSvgNode(tag, attributes) {
        const node = document.createElementNS(NS, tag);
        Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
    }

    function configureProjection() {
        const width = 960;
        zoom = clampZoom(zoom);
        svg.setAttribute("viewBox", `0 0 ${width} ${width}`);
        if (viewMode === "globe") {
            projection = window.d3.geoOrthographic()
                .scale(width * .44)
                .translate([width / 2, width / 2])
                .clipAngle(90)
                .precision(0.35)
                .rotate(rotation);
        } else {
            if (!window.d3.geoNaturalEarth1) throw new Error("The 2D map projection did not load.");
            projection = window.d3.geoNaturalEarth1()
                .fitExtent([[30, 82], [width - 30, width - 82]], { type: "Sphere" })
                .precision(0.35);
        }
        path = window.d3.geoPath(projection);
    }

    function renderZoom() {
        const layer = svg && svg.querySelector(".globe-layer");
        if (layer) layer.setAttribute("transform", `translate(${translate[0]} ${translate[1]}) scale(${zoom}) translate(-480 -480)`);
        if (svg) {
            const screenScale = svg.getBoundingClientRect().width / 960 * zoom;
            const radius = screenScale ? 6 / (Math.sqrt(zoom) * screenScale) : 18;
            svg.querySelectorAll(".globe-country-hit-target").forEach(target => target.setAttribute("r", radius));
        }
    }

    function scheduleRedraw() {
        if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = 0;
            if (svg && features.length) drawGlobe();
        });
    }

    function currentPinchDistance() {
        const points = Array.from(activePointers.values()).slice(0, 2);
        return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    function svgPoint(clientX, clientY) {
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const matrix = svg.getScreenCTM();
        const local = point.matrixTransform(matrix.inverse());
        return [local.x, local.y];
    }

    function currentPinchFocus() {
        const points = Array.from(activePointers.values()).slice(0, 2);
        return svgPoint((points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2);
    }

    function clampZoom(value) {
        return Math.max(.8, Math.min(8, value));
    }

    function updateZoomOutput() {
        if (zoomOutput) zoomOutput.textContent = `${Math.round(zoom * 100)}%`;
    }

    function setZoom(value, animate, focusPoint) {
        zoomTarget = clampZoom(value);
        if (zoomFrame) window.cancelAnimationFrame(zoomFrame);
        zoomFrame = 0;
        const focus = focusPoint || [480, 480];
        const applyZoom = nextZoom => {
            const factor = nextZoom / zoom;
            if (nextZoom <= 1) {
                translate = [480, 480];
            } else {
                translate = [
                    focus[0] + (translate[0] - focus[0]) * factor,
                    focus[1] + (translate[1] - focus[1]) * factor
                ];
            }
            zoom = nextZoom;
            renderZoom();
        };
        if (!animate) {
            applyZoom(zoomTarget);
            updateZoomOutput();
            return;
        }

        const animateStep = () => {
            const difference = zoomTarget - zoom;
            if (Math.abs(difference) < .005) {
                applyZoom(zoomTarget);
                zoomFrame = 0;
                renderZoom();
                updateZoomOutput();
                return;
            }
            applyZoom(zoom + difference * .24);
            updateZoomOutput();
            zoomFrame = window.requestAnimationFrame(animateStep);
        };
        zoomFrame = window.requestAnimationFrame(animateStep);
    }

    function drawGlobe() {
        configureProjection();
        const layer = svg.querySelector(".globe-layer");
        layer.replaceChildren();

        const sphere = createSvgNode("path", { class: `globe-sphere${viewMode === "map" ? " globe-map-sphere" : ""}`, d: path({ type: "Sphere" }) });
        const graticule = createSvgNode("path", { class: "globe-graticule", d: path(window.d3.geoGraticule10()) });
        layer.append(sphere, graticule);

        const globalCountries = window.EconIntel.GlobalData && window.EconIntel.GlobalData.state.byCode;
        const nameIndex = new Map([
            ...Object.values(countries),
            ...Object.values(globalCountries || {})
        ].map(country => [normalize(country.name), country.code]));
        const hitTargets = [];
        features.forEach(feature => {
            const geometry = path(feature);
            if (!geometry) return;
            const name = featureName(feature);
            const code = featureCode(feature, nameIndex);
            const focusId = code || `name:${normalize(name)}`;
            const countryPath = createSvgNode("path", {
                class: `globe-country${code && !code.startsWith("name:") ? "" : " unavailable"}${selectedCodes.includes(code) ? " selected" : ""}${focusId === focusedCode ? " focused" : ""}`,
                d: geometry,
                tabindex: 0,
                role: "button",
                "data-name": name,
                "data-code": code || "",
                "data-focus": focusId,
                "aria-label": code.startsWith("name:") ? `Select ${name} for country details` : `Select ${name}${countries[code] ? " for comparison" : " for country details"}`
            });
            const title = createSvgNode("title");
            title.textContent = `${name} · Select for country details`;
            countryPath.appendChild(title);
            layer.appendChild(countryPath);
            const bounds = countryPath.getBBox();
            if (bounds.width < 28 && bounds.height < 28) {
                const center = projection(window.d3.geoCentroid(feature));
                if (!center) return;
                const target = createSvgNode("circle", {
                    class: "globe-country-hit-target",
                    cx: center[0],
                    cy: center[1],
                    r: 18,
                    fill: "transparent",
                    "pointer-events": "all",
                    "aria-hidden": "true",
                    "data-name": name,
                    "data-code": code || "",
                    "data-focus": focusId
                });
                hitTargets.push(target);
            }
        });
        layer.append(...hitTargets);
        renderZoom();
    }

    function hideTooltip() {
        tooltip.hidden = true;
    }

    function showTooltip(countryPath, event) {
        const name = countryPath.dataset.name;
        const code = countryPath.dataset.code;
        const rect = wrap.getBoundingClientRect();
        const left = Math.max(8, Math.min(event.clientX - rect.left + 12, rect.width - 205));
        const top = Math.max(8, Math.min(event.clientY - rect.top + 12, rect.height - 44));
        tooltip.textContent = code ? name : `${name} · unavailable`;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.hidden = false;
    }

    function bindInteraction() {
        svg.addEventListener("pointerover", event => {
            const countryPath = event.target.closest(".globe-country, .globe-country-hit-target");
            if (countryPath && !drag) showTooltip(countryPath, event);
        });
        svg.addEventListener("pointermove", event => {
            if (pinch && activePointers.has(event.pointerId)) {
                activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
                const distance = currentPinchDistance();
                if (distance && pinch.distance) {
                    setZoom(pinch.zoom * distance / pinch.distance, false, currentPinchFocus());
                }
                return;
            }
            const countryPath = event.target.closest(".globe-country, .globe-country-hit-target");
            if (drag && drag.pointerId === event.pointerId) {
                const deltaX = event.clientX - drag.x;
                const deltaY = event.clientY - drag.y;
                if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                    drag.moved = true;
                    hideTooltip();
                    if (viewMode === "globe") {
                        rotation = [drag.rotation[0] + deltaX * .35, Math.max(-75, Math.min(75, drag.rotation[1] - deltaY * .25)), 0];
                        drawGlobe();
                    } else {
                        const svgWidth = svg.getBoundingClientRect().width || 960;
                        const scale = 960 / svgWidth;
                        translate = [drag.translate[0] + deltaX * scale, drag.translate[1] + deltaY * scale];
                        renderZoom();
                    }
                }
                return;
            }
            if (countryPath) showTooltip(countryPath, event);
            else hideTooltip();
        });
        svg.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            svg.setPointerCapture(event.pointerId);
            if (activePointers.size >= 2) {
                drag = null;
                const distance = currentPinchDistance();
                pinch = distance ? { distance, zoom } : null;
                suppressClick = true;
                hideTooltip();
                return;
            }
            const countryPath = event.target.closest(".globe-country, .globe-country-hit-target");
            drag = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                rotation: rotation.slice(),
                translate: translate.slice(),
                moved: false,
                countryCode: countryPath ? countryPath.dataset.code || countryPath.dataset.focus : "",
                countryName: countryPath ? countryPath.dataset.name : ""
            };
        });
        svg.addEventListener("pointerup", event => {
            activePointers.delete(event.pointerId);
            if (pinch) {
                pinch = null;
                drag = null;
                activePointers.clear();
                suppressClick = true;
                window.setTimeout(() => { suppressClick = false; }, 0);
                return;
            }
            if (!drag || drag.pointerId !== event.pointerId) return;
            const selection = drag;
            drag = null;
            suppressClick = true;
            if (!selection.moved && selection.countryName) {
                onSelect(selection.countryCode || null, selection.countryName);
            }
            window.setTimeout(() => { suppressClick = false; }, 0);
        });
        svg.addEventListener("pointercancel", event => {
            activePointers.clear();
            drag = null;
            pinch = null;
        });
        svg.addEventListener("wheel", event => {
            event.preventDefault();
            setZoom(zoomTarget * Math.exp(-event.deltaY * .001), true, svgPoint(event.clientX, event.clientY));
        }, { passive: false });
        svg.addEventListener("pointerout", event => {
            if (!event.relatedTarget || !svg.contains(event.relatedTarget)) hideTooltip();
        });
        svg.addEventListener("click", event => {
            if (suppressClick) return;
            const countryPath = event.target.closest(".globe-country, .globe-country-hit-target");
            if (countryPath) onSelect(countryPath.dataset.code || countryPath.dataset.focus, countryPath.dataset.name);
        });
        svg.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const countryPath = event.target.closest(".globe-country");
            if (!countryPath) return;
            event.preventDefault();
            onSelect(countryPath.dataset.code || countryPath.dataset.focus, countryPath.dataset.name);
        });
        document.getElementById("globeZoomIn").addEventListener("click", () => setZoom(zoomTarget * 1.35, true));
        document.getElementById("globeZoomOut").addEventListener("click", () => setZoom(zoomTarget / 1.35, true));
        document.getElementById("globeResetView").addEventListener("click", () => {
            rotation = [-10, -10, 0];
            translate = [480, 480];
            setZoom(1, false);
        });
        document.getElementById("globeView3d").addEventListener("click", () => setView("globe"));
        document.getElementById("globeView2d").addEventListener("click", () => setView("map"));
    }

    function setView(mode) {
        if (mode !== "globe" && mode !== "map") return;
        if (viewMode === mode) return;
        if (zoomFrame) window.cancelAnimationFrame(zoomFrame);
        zoomFrame = 0;
        viewMode = mode;
        rotation = [-10, -10, 0];
        translate = [480, 480];
        zoomTarget = 1;
        zoom = 1;
        updateZoomOutput();
        document.getElementById("globeView3d").classList.toggle("is-active", mode === "globe");
        document.getElementById("globeView3d").setAttribute("aria-pressed", String(mode === "globe"));
        document.getElementById("globeView2d").classList.toggle("is-active", mode === "map");
        document.getElementById("globeView2d").setAttribute("aria-pressed", String(mode === "map"));
        svg.setAttribute("aria-label", mode === "globe"
            ? "Interactive 3D globe. Drag to rotate and select a country."
            : "Interactive 2D world map. Drag to pan and select a country.");
        drawGlobe();
    }

    function exportSvg() {
        if (!svg || !features.length) throw new Error("The country visualization is not ready to export.");
        const clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", NS);
        clone.setAttribute("width", "1440");
        clone.setAttribute("height", "1440");
        clone.setAttribute("data-view-mode", viewMode);
        clone.querySelectorAll(".globe-country-hit-target").forEach(target => target.removeAttribute("aria-hidden"));
        const originals = svg.querySelectorAll("*");
        const copies = clone.querySelectorAll("*");
        const styleProperties = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "opacity", "stop-color", "stop-opacity"];
        originals.forEach((element, index) => {
            const copy = copies[index];
            if (!copy) return;
            const computed = window.getComputedStyle(element);
            styleProperties.forEach(property => {
                const value = computed.getPropertyValue(property);
                if (value) copy.style.setProperty(property, value);
            });
        });
        clone.style.setProperty("background", "transparent");
        return new XMLSerializer().serializeToString(clone);
    }

    async function mount(options) {
        svg = document.getElementById(options.svgId);
        tooltip = document.getElementById(options.tooltipId);
        wrap = document.getElementById(options.wrapId);
        zoomOutput = document.getElementById("globeZoomLevel");
        countries = options.countries;
        selectedCodes = options.selectedCodes || [];
        onSelect = options.onSelect;

        try {
            if (!window.d3 || !window.d3.geoOrthographic) throw new Error("The globe projection library did not load.");
            const controller = typeof AbortController === "function" ? new AbortController() : null;
            let timeout;
            const fetchRequest = (async () => {
                const response = await fetch(GEOJSON_URL, controller ? { signal: controller.signal } : {});
                if (!response.ok) throw new Error(`Country boundaries request failed (${response.status}).`);
                return response.json();
            })();
            const timeoutRequest = new Promise((resolve, reject) => {
                timeout = window.setTimeout(() => {
                    if (controller) controller.abort();
                    reject(new Error("Country boundaries request timed out after 15000 ms."));
                }, 15000);
            });
            let geojson;
            try {
                geojson = await Promise.race([fetchRequest, timeoutRequest]);
            } finally {
                if (timeout) window.clearTimeout(timeout);
            }
            if (!geojson || !Array.isArray(geojson.features)) throw new Error("The country boundary data has an unexpected format.");

            features = geojson.features;
            svg.innerHTML = `<defs>
                <radialGradient id="globeOceanGradient" cx="38%" cy="32%">
                    <stop class="globe-ocean-stop-1" offset="0%" stop-color="#285264"></stop>
                    <stop class="globe-ocean-stop-2" offset="72%" stop-color="#152e3b"></stop>
                    <stop class="globe-ocean-stop-3" offset="100%" stop-color="#0b1c28"></stop>
                </radialGradient>
            </defs><g class="globe-layer"></g>`;
            drawGlobe();
            bindInteraction();
            updateZoomOutput();
            window.addEventListener("resize", scheduleRedraw);
            if ("ResizeObserver" in window) {
                new ResizeObserver(scheduleRedraw).observe(wrap);
            }
            options.onStatus(`Globe ready · ${features.length} country boundaries`);
            return true;
        } catch (error) {
            console.warn("Could not load interactive globe:", error);
            svg.innerHTML = `<text class="globe-loading" x="480" y="460" text-anchor="middle">Globe map unavailable</text>
                <text class="globe-loading-hint" x="480" y="492" text-anchor="middle">Use the country selector to choose a country.</text>`;
            options.onStatus("Globe unavailable · Use the country selector instead");
            return false;
        }
    }

    function setSelectedCountries(codes) {
        selectedCodes = codes.slice();
        if (svg && features.length) drawGlobe();
    }

    function setFocusedCountry(code) {
        focusedCode = code || "";
        if (svg && features.length) drawGlobe();
    }

    function resolveCountryCode(name) {
        const nameIndex = new Map([
            ...Object.values(countries),
            ...Object.values(window.EconIntel.GlobalData && window.EconIntel.GlobalData.state.byCode || {})
        ].map(country => [normalize(country.name), country.code]));
        const feature = features.find(item => normalize(featureName(item)) === normalize(name));
        return feature ? featureCode(feature, nameIndex) : null;
    }

    function refreshCountries() {
        if (svg && features.length) drawGlobe();
    }

    window.EconIntel.Globe = {
        mount,
        setSelectedCountries,
        setFocusedCountry,
        refreshCountries,
        resolveCountryCode,
        getView: () => viewMode,
        exportSvg
    };
}());
