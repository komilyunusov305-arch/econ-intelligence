(function () {
    "use strict";

    const defaultView = { center: [22, 12], zoom: 2 };
    let map;
    let onSelect = () => {};
    let selectedCode = "";
    let markers = Object.create(null);
    let countryDirectory = Object.create(null);
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

    function mount(options) {
        const container = document.getElementById(options.mapId);
        const status = document.getElementById(options.statusId);
        if (!window.L || !container) {
            if (status) status.textContent = "Interactive map unavailable · Check that Leaflet loaded.";
            return false;
        }
        if (!window.L.markerClusterGroup) {
            if (status) status.textContent = "Country map unavailable · The marker clustering library did not load.";
            return false;
        }

        countryDirectory = options.countries;
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
        tiles.on("tileerror", () => {
            if (status) status.textContent = "Some map tiles could not be loaded · World Bank country locations remain usable.";
        });
        tiles.addTo(map);

        const markerLayer = window.L.markerClusterGroup({
            maxClusterRadius: 48,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true
        });
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
            if (status) status.textContent = `${mappedCount} World Bank country locations ready · Zoom in or select a cluster to explore.`;
        });
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

    window.EconIntel.IntelligenceMap = { mount, setSelectedCountry, invalidateSize, reset };
}());
