const REFRESH_MS = 5 * 60 * 1000; // 5 minutes
const OUTAGES_URL = "data/outages.json";
const MASTS_URL = "data/masts.geojson";

const STATUS_COLORS = {
  "In Progress": "#d7263d",
  "Awaiting": "#f4a300",
  "Restored": "#2e7d32",
};

function statusColor(status) {
  return STATUS_COLORS[status] || "#6c757d";
}

const map = L.map("map", { preferCanvas: true }).setView([53.85, -2.6], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const outagesLayer = L.geoJSON(null, {
  style: outageStyle,
  pointToLayer: (feature, latlng) =>
    L.circleMarker(latlng, {
      radius: 7,
      weight: 2,
      color: statusColor(feature.properties?.status),
      fillColor: statusColor(feature.properties?.status),
      fillOpacity: 0.7,
    }),
  onEachFeature: bindOutagePopup,
}).addTo(map);

const mastsLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) =>
    L.circleMarker(latlng, {
      radius: 3,
      weight: 1,
      color: "#3388ff",
      fillColor: "#3388ff",
      fillOpacity: 0.5,
    }),
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    const html =
      `<strong>Cell/mast</strong><br/>` +
      `Radio: ${p.radio ?? "?"}<br/>` +
      `Cell ID: ${p.cellid ?? "?"}<br/>` +
      `Network: MCC ${p.mcc ?? "?"} / MNC ${p.net ?? "?"}<br/>` +
      `Range: ${Number.isFinite(p.range_m) ? `${p.range_m} m` : "?"}`;

    layer.bindTooltip(html, { sticky: true, direction: "top", opacity: 0.9 });
    layer.bindPopup(html);
  },
}).addTo(map);

document.getElementById("toggle-masts").addEventListener("change", (e) => {
  if (e.target.checked) {
    map.addLayer(mastsLayer);
  } else {
    map.removeLayer(mastsLayer);
  }
});

function outageStyle(feature) {
  const color = statusColor(feature.properties?.status);
  const planned = feature.properties?.planned === true;
  return {
    color,
    weight: feature.geometry.type === "LineString" ? 4 : 2,
    fillColor: color,
    fillOpacity: 0.35,
    dashArray: planned ? "6 4" : null,
  };
}

function bindOutagePopup(feature, layer) {
  const p = feature.properties || {};
  const rows = [
    ["Fault ID", p.fault_id],
    ["Status", p.status],
    ["Planned", p.planned ? "Yes" : "No"],
    ["Voltage level", p.voltagelevel],
    ["Customers affected", p.confirmedoff],
    ["Postcodes", Array.isArray(p.postcode) ? p.postcode.join(", ") : p.postcode],
    ["Started", formatDate(p.outage_start_date)],
    ["Estimated restoration", formatDate(p.etr)],
    ["Restored at", formatDate(p.date_time_of_restoration)],
  ];

  const rowsHtml = rows
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `<tr><td class="label">${label}</td><td>${value}</td></tr>`)
    .join("");

  layer.bindPopup(
    `<div class="outage-popup"><h3>${p.fault_id ?? "Outage"}</h3><table>${rowsHtml}</table></div>`
  );
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB");
}

function setStatusLine(text) {
  document.getElementById("last-updated").textContent = text;
}

async function loadOutages() {
  try {
    const res = await fetch(`${OUTAGES_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    outagesLayer.clearLayers();
    outagesLayer.addData(data);

    const count = data.feature_count ?? data.features?.length ?? 0;
    const generated = data.generated_at ? formatDate(data.generated_at) : "unknown";
    setStatusLine(`${count} active outages · data as of ${generated}`);
  } catch (err) {
    console.error("Failed to load outages:", err);
    setStatusLine("Could not load outage data - showing last known state.");
  }
}

async function loadMasts() {
  try {
    const res = await fetch(MASTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    mastsLayer.addData(data);
  } catch (err) {
    console.error("Failed to load mast data:", err);
  }
}

loadMasts();
loadOutages();
setInterval(loadOutages, REFRESH_MS);
