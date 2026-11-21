(function () {
    "use strict";

    const GEOJSON_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
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
    let drag = null;
    let zoom = 1;
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
        const candidates = [
            properties.ISO_A3_EH,
            properties.ISO_A3,
            properties.ADM0_A3,
            properties.WB_A3
        ];
        for (const candidate of candidates) {
            if (candidate && candidate !== "-99" && countries[candidate]) return candidate;
        }
        const alias = aliases[featureName(feature)];
        if (alias && countries[alias]) return alias;
        return nameIndex.get(normalize(featureName(feature))) || null;
    }

    function createSvgNode(tag, attributes) {
        const node = document.createElementNS(NS, tag);
        Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
    }

    function configureProjection() {
        const mobile = window.matchMedia("(max-width: 760px)").matches;
        const width = 960;
        const height = mobile ? 820 : 600;
        zoom = clampZoom(zoom);
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        const scale = mobile ? Math.min(width * .42, height * .44) : 248;
        projection = window.d3.geoOrthographic()
            .scale(scale * zoom)
            .translate([width / 2, height / 2])
            .clipAngle(90)
            .precision(0.35)
            .rotate(rotation);
        path = window.d3.geoPath(projection);
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

    function clampZoom(value) {
        const maximum = window.matchMedia("(max-width: 760px)").matches ? 1.12 : 1.18;
        return Math.max(.8, Math.min(maximum, value));
    }

    function drawGlobe() {
        configureProjection();
        const layer = svg.querySelector(".globe-layer");
        layer.replaceChildren();

        const sphere = createSvgNode("path", { class: "globe-sphere", d: path({ type: "Sphere" }) });
        const graticule = createSvgNode("path", { class: "globe-graticule", d: path(window.d3.geoGraticule10()) });
        layer.append(sphere, graticule);

        const nameIndex = new Map(Object.values(countries).map(country => [normalize(country.name), country.code]));
        features.forEach(feature => {
            const geometry = path(feature);
            if (!geometry) return;
            const name = featureName(feature);
            const code = featureCode(feature, nameIndex);
            const countryPath = createSvgNode("path", {
                class: `globe-country${code ? "" : " unavailable"}${code && selectedCodes.includes(code) ? " selected" : ""}${code && code === focusedCode ? " focused" : ""}`,
                d: geometry,
                tabindex: 0,
                role: "button",
                "data-name": name,
                "data-code": code || "",
                "aria-label": code ? `Add ${name} to country comparison` : `${name}; no matching World Bank country code`
            });
            const title = createSvgNode("title");
            title.textContent = code ? `${name} · Click to add` : `${name} · No World Bank country match`;
            countryPath.appendChild(title);
            layer.appendChild(countryPath);
        });
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
            const countryPath = event.target.closest(".globe-country");
            if (countryPath && !drag) showTooltip(countryPath, event);
        });
        svg.addEventListener("pointermove", event => {
            if (pinch && activePointers.has(event.pointerId)) {
                activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
                const distance = currentPinchDistance();
                if (distance && pinch.distance) {
                    zoom = clampZoom(pinch.zoom * distance / pinch.distance);
                    drawGlobe();
                }
                return;
            }
            const countryPath = event.target.closest(".globe-country");
            if (drag && drag.pointerId === event.pointerId) {
                const deltaX = event.clientX - drag.x;
                const deltaY = event.clientY - drag.y;
                if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                    drag.moved = true;
                    hideTooltip();
                    rotation = [drag.rotation[0] + deltaX * .35, Math.max(-75, Math.min(75, drag.rotation[1] - deltaY * .25)), 0];
                    drawGlobe();
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
            const countryPath = event.target.closest(".globe-country");
            drag = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                rotation: rotation.slice(),
                moved: false,
                countryCode: countryPath ? countryPath.dataset.code : "",
                countryName: countryPath ? countryPath.dataset.name : ""
            };
        });
        svg.addEventListener("pointerup", event => {
            activePointers.delete(event.pointerId);
            if (pinch) {
                pinch = null;
                drag = null;
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
            activePointers.delete(event.pointerId);
            drag = null;
            pinch = null;
        });
        svg.addEventListener("wheel", event => {
            event.preventDefault();
            zoom = clampZoom(zoom * Math.exp(-event.deltaY * .001));
            drawGlobe();
        }, { passive: false });
        svg.addEventListener("pointerout", event => {
            if (!event.relatedTarget || !svg.contains(event.relatedTarget)) hideTooltip();
        });
        svg.addEventListener("click", event => {
            if (suppressClick) return;
            const countryPath = event.target.closest(".globe-country");
            if (countryPath) onSelect(countryPath.dataset.code || null, countryPath.dataset.name);
        });
        svg.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const countryPath = event.target.closest(".globe-country");
            if (!countryPath) return;
            event.preventDefault();
            onSelect(countryPath.dataset.code || null, countryPath.dataset.name);
        });
    }

    async function mount(options) {
        svg = document.getElementById(options.svgId);
        tooltip = document.getElementById(options.tooltipId);
        wrap = document.getElementById(options.wrapId);
        countries = options.countries;
        selectedCodes = options.selectedCodes || [];
        onSelect = options.onSelect;

        try {
            if (!window.d3 || !window.d3.geoOrthographic) throw new Error("The globe projection library did not load.");
            const response = await fetch(GEOJSON_URL);
            if (!response.ok) throw new Error(`Country boundaries request failed (${response.status}).`);
            const geojson = await response.json();
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
            window.addEventListener("resize", scheduleRedraw);
            if ("ResizeObserver" in window) {
                new ResizeObserver(scheduleRedraw).observe(wrap);
            }
            options.onStatus(`Globe ready · ${features.length} country boundaries`);
            return true;
        } catch (error) {
            console.error("Could not load interactive globe:", error);
            svg.innerHTML = `<text class="globe-loading" x="480" y="270" text-anchor="middle">Globe map unavailable</text>
                <text class="globe-loading-hint" x="480" y="302" text-anchor="middle">Use the country selector to choose a country.</text>`;
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

    window.EconIntel.Globe = { mount, setSelectedCountries, setFocusedCountry };
}());
