// ======================================================
// MAP.JS — EBLG Cockpit IFR PRO+++
// ======================================================

// IMPORTS (doivent être tout en haut)
import { ENDPOINTS } from "./config.js";
import { fetchJSON } from "./helpers.js";

// ======================================================
// COUCHES
// ======================================================
export let map = null;

const adsbLayer = L.layerGroup();
const adsbTracksLayer = L.layerGroup();
const adsbLabelsLayer = L.layerGroup();
let adsbHeatmap = null;

let approachCorridorLayer = L.layerGroup();
let departureCorridorLayer = L.layerGroup();
let noiseZonesLayer = L.layerGroup();

// Tracks mémoire
const adsbTracks = new Map();

// Bouton reset map
 export function resetMapView() {
    if (!map) return;

    map.flyTo(
        [50.645, 5.46],   // centre EBLG
        12,               // zoom
        {
            animate: true,
            duration: 1.2,     // durée totale
            easeLinearity: 0.25 // easing smooth
        }
    );
}
// ======================================================
// INIT MAP
// ======================================================
export function initMap() {

    map = L.map("map", {
        center: [50.645, 5.46],
        zoom: 12,
        preferCanvas: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map);

    adsbLayer.addTo(map);
    adsbTracksLayer.addTo(map);
    adsbLabelsLayer.addTo(map);

    // Heatmap
    adsbHeatmap = L.heatLayer([], {
        radius: 25,
        blur: 15,
        maxZoom: 14
    }).addTo(map);

    // Zones bruit
    drawNoiseZones();

    console.log("[MAP] Carte initialisée");
}
export function toggleNoiseHeatmap(state) {
    if (!adsbHeatmap) return;

    if (state) adsbHeatmap.addTo(map);
    else map.removeLayer(adsbHeatmap);
}

// ======================================================
// UPDATE ADS-B
// ======================================================
export async function updateADSB() {
    try {
        const json = await fetchJSON(ENDPOINTS.adsb);
        if (!json || !json.ac) return;

        const heatPoints = [];

        adsbTracksLayer.clearLayers();
        adsbLabelsLayer.clearLayers();

        json.ac.forEach(ac => {
            if (!ac.lat || !ac.lon) return;

            // Heatmap
            heatPoints.push([ac.lat, ac.lon, 0.7]);

            // TRACKS
            if (!adsbTracks.has(ac.hex)) {
                adsbTracks.set(ac.hex, { positions: [] });
            }

            const track = adsbTracks.get(ac.hex);
            track.positions.push([ac.lat, ac.lon]);
            if (track.positions.length > 20) track.positions.shift();

            const poly = L.polyline(track.positions, {
                color: "#00c8ff",
                weight: 2,
                opacity: 0.7
            }).addTo(adsbTracksLayer);

            // FLÈCHES
            L.polylineDecorator(poly, {
                patterns: [{
                    offset: "50%",
                    repeat: 0,
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 12,
                        polygon: false,
                        pathOptions: { color: "#00c8ff", weight: 2 }
                    })
                }]
            }).addTo(adsbTracksLayer);

            // LABELS
            const label = L.marker([ac.lat, ac.lon], {
                icon: L.divIcon({
                    className: "adsb-label",
                    html: `
                        <div class="adsb-label-box">
                            <b>${ac.call || "—"}</b><br>
                            ${ac.alt_baro ? ac.alt_baro + " ft" : ""}<br>
                            ${ac.gs ? ac.gs + " kt" : ""}
                        </div>
                    `,
                    iconSize: [80, 40],
                    iconAnchor: [40, -10]
                })
            });

            adsbLabelsLayer.addLayer(label);
        });

        adsbHeatmap.setLatLngs(heatPoints);

    } catch (e) {
        console.error("[ADSB] Erreur chargement", e);
    }
}

// ======================================================
// ZONES BRUIT
// ======================================================
export function drawNoiseZones() {
    noiseZonesLayer.clearLayers();

    const zoneCritique = [
        [50.6600, 5.4300],
        [50.6600, 5.4550],
        [50.6400, 5.4550],
        [50.6400, 5.4300]
    ];

    const zoneElevee = [
        [50.6700, 5.4100],
        [50.6700, 5.4750],
        [50.6300, 5.4750],
        [50.6300, 5.4100]
    ];

    const zoneModeree = [
        [50.6800, 5.3900],
        [50.6800, 5.4950],
        [50.6200, 5.4950],
        [50.6200, 5.3900]
    ];

    L.polygon(zoneCritique, {
        color: "#ff0000",
        fillColor: "#ff0000",
        fillOpacity: 0.25
    }).addTo(noiseZonesLayer);

    L.polygon(zoneElevee, {
        color: "#ff8800",
        fillColor: "#ff8800",
        fillOpacity: 0.20
    }).addTo(noiseZonesLayer);

    L.polygon(zoneModeree, {
        color: "#ffee00",
        fillColor: "#ffee00",
        fillOpacity: 0.15
    }).addTo(noiseZonesLayer);

    noiseZonesLayer.addTo(map);
}

// ======================================================
// CORRIDORS IFR
// ======================================================
const RWY22 = [50.64594, 5.44338];
const RWY04 = [50.65455, 5.46570];

export function drawApproachCorridor(rwy) {
    approachCorridorLayer.clearLayers();
    if (rwy !== "22") return;

    const pts = [
        RWY22,
        [50.6300, 5.4200],
        [50.6200, 5.4000],
        [50.6100, 5.3800]
    ];

    L.polyline(pts, {
        color: "#00ff88",
        weight: 3,
        opacity: 0.8,
        dashArray: "6,4"
    }).addTo(approachCorridorLayer);

    approachCorridorLayer.addTo(map);
}

export function drawDepartureCorridor(rwy) {
    departureCorridorLayer.clearLayers();
    if (rwy !== "04") return;

    const pts = [
        RWY04,
        [50.6650, 5.4800],
        [50.6800, 5.5000]
    ];

    L.polyline(pts, {
        color: "#ffaa00",
        weight: 3,
        opacity: 0.8,
        dashArray: "6,4"
    }).addTo(departureCorridorLayer);

    departureCorridorLayer.addTo(map);
}
