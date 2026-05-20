// ======================================================
// MAP — PRO+++
// Carte Leaflet, ADS-B, heatmap, zones bruit
// ======================================================

import { getRunwayCorridors, getRunwayThresholds } from "./runways.js";
import { ENDPOINTS } from "./config.js";
import { fetchJSON } from "./helpers.js";

const IS_DEV = location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1");
const log = (...a) => IS_DEV && console.log("[MAP]", ...a);
const logErr = (...a) => console.error("[MAP ERROR]", ...a);

let map;
let adsbLayer = null;
let heatLayer = null;
let noiseZonesLayer = null;

window.activeRunway = null;
window.runwayThresholds = getRunwayThresholds();
window.runwayCorridors = getRunwayCorridors();

// ------------------------------------------------------
// API PUBLIC — appelée par app.js
// ------------------------------------------------------
export function initMap() {
    map = L.map("map", {
        center: [50.643, 5.443],
        zoom: 12,
        preferCanvas: true
    });

    window.map = map; // pour sonometers.js

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    adsbLayer = L.layerGroup().addTo(map);
    log("Map initialisée");
}

export function resetMapView() {
    if (!map) return;
    map.setView([50.643, 5.443], 12);
}

export function toggleNoiseHeatmap() {
    if (!map) return;

    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
        return;
    }

    // Exemple simple : heatmap centrée sur la piste
    const pts = window.runwayCorridors.flatMap(c => c.coords);
    heatLayer = L.heatLayer(pts, {
        radius: 40,
        blur: 25,
        maxZoom: 17
    }).addTo(map);
}

export function toggleNoiseZones() {
    if (!map) return;

    if (noiseZonesLayer) {
        map.removeLayer(noiseZonesLayer);
        noiseZonesLayer = null;
        return;
    }

    noiseZonesLayer = L.layerGroup();

    window.runwayCorridors.forEach(c => {
        const poly = L.polygon(c.coords, {
            color: "#ff00ff",
            weight: 1,
            fillOpacity: 0.15
        });
        noiseZonesLayer.addLayer(poly);
    });

    noiseZonesLayer.addTo(map);
}

export async function updateADSB() {
    try {
        const data = await fetchJSON("/api/adsb");
        if (!data || !data.ac) {
            logErr("Données ADSB invalides", data);
            return;
        }

        renderADSB(data.ac);
    } catch (err) {
        logErr("Erreur updateADSB", err);
    }
}

// ------------------------------------------------------
// Rendu ADS-B
// ------------------------------------------------------
function renderADSB(acList) {
    if (!adsbLayer) return;
    adsbLayer.clearLayers();

    acList.forEach(ac => {
        const m = L.circleMarker([ac.lat, ac.lon], {
            radius: 4,
            color: "#00ffff",
            weight: 1,
            fillOpacity: 0.8
        });

        m.bindTooltip(`${ac.call || "N/A"} (${ac.alt_baro || "?"} ft)`);
        adsbLayer.addLayer(m);
    });
}
// ======================================================
// DEBUG PANEL — FPS / CPU / RENDER — PRO+++
// ======================================================

let fpsEl = null;
let cpuEl = null;
let renderEl = null;

export function initDebugPanel() {
    fpsEl = document.getElementById("fps");
    cpuEl = document.getElementById("cpu");
    renderEl = document.getElementById("render");

    startFPSCounter();
    startCPUCounter();
    hookRenderTime();
}

// ------------------------------------------------------
// FPS
// ------------------------------------------------------
function startFPSCounter() {
    let last = performance.now();

    function loop(now) {
        const delta = now - last;
        last = now;

        if (fpsEl) fpsEl.textContent = delta.toFixed(1);

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}

// ------------------------------------------------------
// CPU
// ------------------------------------------------------
function startCPUCounter() {
    let last = performance.now();

    setInterval(() => {
        const now = performance.now();
        const cpu = now - last;
        last = now;

        if (cpuEl) cpuEl.textContent = cpu.toFixed(1);
    }, 200);
}

// ------------------------------------------------------
// Render time Leaflet
// ------------------------------------------------------
function hookRenderTime() {
    if (!window.map) return;

    let t0 = 0;

    window.map.on("movestart", () => {
        t0 = performance.now();
    });

    window.map.on("moveend", () => {
        const dt = performance.now() - t0;
        if (renderEl) renderEl.textContent = dt.toFixed(1);
    });
}
