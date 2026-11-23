(function () {
    "use strict";

    const defaultView = { center: [22, 12], zoom: 2 };
    let map;
    let onSelect = () => {};
    let selectedCode = "";
    let markers = Object.create(null);
    let countryDirectory = Object.create(null);
    let markerLayer;
    let mapStatus;
    let tilesUnavailable = false;
    let needsInitialLayout = false;

    function markerIcon(code) {
        const className = code === selectedCode
            ? "signal-marker signal-marker-selected"
            : "signal-marker";
        return window.L.divIcon({
            className: "",
            html: `<span class="${className}" aria-hidden="true"><i></i></span>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }

    function overviewZoom() {
        const width = map.getSize().x;
        if (!width) return defaultView.zoom;
        const zoom = Math.log2(width * 360 / (256 * 300));
        return Math.max(0.5, Math.min(defaultView.zoom, Math.round(zoom * 4) / 4));
    }

    function refreshMarkers() {
        Object.entries(markers).forEach(([code, marker]) => marker.setIcon(markerIcon(code)));
    }

    function setCountries(countries, sourceUnavailable) {
        countryDirectory = countries || Object.create(null);
        if (!map || !markerLayer) return;

        markerLayer.clearLayers();
        markers = Object.create(null);
        let mappedCount = 0;
        Object.values(countryDirectory).forEach(country => {
            if (!country || !Number.isFinite(country.latitude) || !Number.isFinite(country.longitude)
                || country.latitude < -90 || country.latitude > 90
                || country.longitude < -180 || country.longitude > 180) return;
            const marker = window.L.marker([country.latitude, country.longitude], {
                icon: markerIcon(country.code),
                keyboard: true,
                title: `${country.name} · Select country`
            });
            const tooltipContent = document.createElement("span");
            tooltipContent.textContent = `${country.name} · ${country.code}`;
            marker.bindTooltip(tooltipContent, { direction: "top", offset: [0, -9] });
            marker.on("click", () => onSelect(country.code, country.name));
            markers[country.code] = marker;
            markerLayer.addLayer(marker);
            mappedCount += 1;
        });

        if (mapStatus) {
            mapStatus.textContent = tilesUnavailable
                ? "Map tiles unavailable · Country locations remain usable."
                : mappedCount
                    ? `${mappedCount} World Bank country locations ready · Zoom in or select a cluster to explore.`
                    : sourceUnavailable
                        ? "Source unavailable · Country locations could not be loaded; the world map remains available."
                        : Object.keys(countryDirectory).length
                            ? "Country coordinates unavailable · The world map remains available."
                            : "Loading country locations · The world map is available.";
        }
    }

    function mount(options) {
        const container = document.getElementById(options.mapId);
        mapStatus = document.getElementById(options.statusId);
        if (!window.L || !container) {
            if (mapStatus) mapStatus.textContent = "Interactive map unavailable · The map library did not load.";
            return false;
        }

        selectedCode = options.initialCode || "";
        onSelect = options.onSelect;
        const bounds = container.getBoundingClientRect();
        needsInitialLayout = bounds.width === 0 || bounds.height === 0;
        map = window.L.map(container, {
            minZoom: 0.5,
            maxZoom: 7,
            zoomSnap: 0.25,
            zoomControl: false,
            scrollWheelZoom: true,
            worldCopyJump: true,
            attributionControl: true
        });
        map.setView(defaultView.center, overviewZoom());

        const tiles = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        });
        const tileTimeout = window.setTimeout(() => {
            tilesUnavailable = true;
            if (mapStatus) mapStatus.textContent = "Map tiles unavailable or delayed · Country locations remain usable.";
        }, 15000);
        tiles.once("load", () => window.clearTimeout(tileTimeout));
        tiles.on("tileerror", () => {
            tilesUnavailable = true;
            window.clearTimeout(tileTimeout);
            if (mapStatus) mapStatus.textContent = "Map tiles unavailable · Country locations remain usable.";
        });
        tiles.addTo(map);

        markerLayer = window.L.markerClusterGroup
            ? window.L.markerClusterGroup({
                maxClusterRadius: 48,
                showCoverageOnHover: false,
                spiderfyOnMaxZoom: true,
                zoomToBoundsOnClick: true
            })
            : window.L.layerGroup();
        markerLayer.addTo(map);

        const controls = [
            ["overviewZoomIn", () => map.zoomIn()],
            ["overviewZoomOut", () => map.zoomOut()],
            ["overviewMapReset", reset]
        ];
        controls.forEach(([id, action]) => {
            const button = document.getElementById(id);
            if (button) button.addEventListener("click", action);
        });
        map.whenReady(() => {
            invalidateSize();
        });
        if (typeof ResizeObserver === "function") {
            new ResizeObserver(invalidateSize).observe(container);
        }
        window.addEventListener("resize", invalidateSize);
        window.addEventListener("orientationchange", invalidateSize);
        setCountries(options.countries);
        return true;
    }

    function setSelectedCountry(code) {
        selectedCode = code || "";
        refreshMarkers();
    }

    function invalidateSize() {
        if (!map) return;
        map.invalidateSize({ pan: false });
        const size = map.getSize();
        if (needsInitialLayout && size.x > 0 && size.y > 0) {
            map.setView(defaultView.center, overviewZoom(), { animate: false });
            needsInitialLayout = false;
        }
    }

    function reset() {
        if (!map) return;
        map.invalidateSize({ pan: false });
        map.setView(defaultView.center, overviewZoom(), { animate: false });
    }

    window.EconIntel.IntelligenceMap = { mount, setCountries, setSelectedCountry, invalidateSize, reset };
}());
