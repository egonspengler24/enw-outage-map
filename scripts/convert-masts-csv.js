// Converts a locally downloaded OpenCelliD bulk CSV export (e.g. 234.csv,
// downloaded manually from my.opencellid.org while logged in) into the
// static data/masts.geojson file used by the map, filtered to the
// Electricity North West licence area.
//
// Usage:
//   node scripts/convert-masts-csv.js /path/to/234.csv [/path/to/235.csv ...]
//
// CSV columns (no header row), per OpenCelliD's export format:
//   radio,mcc,net,area,cell,unit,lon,lat,range,samples,changeable,created,updated,averageSignal

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bounding box roughly covering the ENW licence area: lat/lon min/max.
const BBOX = { latMin: 52.9, lonMin: -3.6, latMax: 55.2, lonMax: -1.9 };

const inputPaths = process.argv.slice(2);
if (inputPaths.length === 0) {
  console.error("Usage: node scripts/convert-masts-csv.js /path/to/234.csv [more files...]");
  process.exit(1);
}

function readCsv(filePath) {
  const raw = readFileSync(filePath);
  const text = filePath.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return text.split("\n").filter((line) => line.trim().length > 0);
}

function inBbox(lat, lon) {
  return lat >= BBOX.latMin && lat <= BBOX.latMax && lon >= BBOX.lonMin && lon <= BBOX.lonMax;
}

const features = [];

for (const inputPath of inputPaths) {
  const lines = readCsv(inputPath);
  let kept = 0;

  for (const line of lines) {
    const cols = line.split(",");
    const [radio, mcc, net, area, cell, , lonStr, latStr, range] = cols;
    const lon = Number(lonStr);
    const lat = Number(latStr);

    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !inBbox(lat, lon)) continue;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        radio,
        mcc: Number(mcc),
        net: Number(net),
        area: Number(area),
        cellid: cell,
        range_m: Number(range),
      },
    });
    kept++;
  }

  console.log(`${inputPath}: ${lines.length} rows read, ${kept} within the ENW bounding box`);
}

const output = {
  type: "FeatureCollection",
  attribution: "Cell data © OpenCelliD (opencellid.org), CC-BY-SA 4.0",
  generated_at: new Date().toISOString(),
  feature_count: features.length,
  features,
};

const outPath = path.join(__dirname, "..", "data", "masts.geojson");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${features.length} mast/cell features to ${outPath}`);
