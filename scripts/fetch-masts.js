// One-off script to build the static mobile mast layer (data/masts.geojson)
// from OpenCelliD, covering the Electricity North West licence area
// (Cumbria, Lancashire, Greater Manchester, Merseyside, Cheshire).
//
// Masts don't move, so this is NOT run on a schedule - run it locally
// once (or whenever you want to refresh coverage) and commit the result.
//
// Get a free API key at https://opencellid.org/, then run:
//   OPENCELLID_API_KEY=xxxx node scripts/fetch-masts.js
//
// Data license: OpenCelliD is CC-BY-SA 4.0 - attribution is included in
// the output file and must be kept visible in the app (see index.html).

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.OPENCELLID_API_KEY;
if (!apiKey) {
  console.error("OPENCELLID_API_KEY environment variable is not set.");
  process.exit(1);
}

// Bounding box roughly covering the ENW licence area: lat/lon min/max.
const BBOX = { latMin: 52.9, lonMin: -3.6, latMax: 55.2, lonMax: -1.9 };

async function main() {
  const url =
    `https://opencellid.org/cell/getInArea?key=${apiKey}` +
    `&BBOX=${BBOX.latMin},${BBOX.lonMin},${BBOX.latMax},${BBOX.lonMax}` +
    `&format=json&limit=10000`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OpenCelliD request failed: ${res.status} ${res.statusText}`);
  }

  const body = await res.json();
  const cells = body.cells ?? [];

  const features = cells.map((cell) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [cell.lon, cell.lat] },
    properties: {
      radio: cell.radio,
      mcc: cell.mcc,
      mnc: cell.mnc,
      lac: cell.lac,
      cellid: cell.cellid,
      range_m: cell.range,
    },
  }));

  const output = {
    type: "FeatureCollection",
    attribution: "Cell data © OpenCelliD (opencellid.org), CC-BY-SA 4.0",
    generated_at: new Date().toISOString(),
    feature_count: features.length,
    features,
  };

  const dataDir = path.join(__dirname, "..", "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, "masts.geojson"), JSON.stringify(output, null, 2));

  console.log(`Wrote ${features.length} mast/cell features to data/masts.geojson`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
