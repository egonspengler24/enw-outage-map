// Fetches all current outage records from the Electricity North West
// open data API and writes them to data/outages.json as a GeoJSON
// FeatureCollection. Run by the GitHub Actions workflow on a schedule.
//
// Requires ENW_API_KEY in the environment. Never hardcode the key here.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE =
  "https://electricitynorthwest.opendatasoft.com/api/explore/v2.1/catalog/datasets/sp-enw-live-neop/records";
const PAGE_SIZE = 100;
const MAX_PAGES = 20; // safety cap, 2000 records

const apiKey = process.env.ENW_API_KEY;
if (!apiKey) {
  console.error("ENW_API_KEY environment variable is not set.");
  process.exit(1);
}

function toFeature(record) {
  const { geo_shape, geo_point_2d, ...properties } = record;

  let geometry = geo_shape?.geometry ?? null;
  if (!geometry && geo_point_2d) {
    geometry = { type: "Point", coordinates: [geo_point_2d.lon, geo_point_2d.lat] };
  }
  if (!geometry) return null;

  return { type: "Feature", geometry, properties };
}

async function fetchAllRecords() {
  const records = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${API_BASE}?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: `Apikey ${apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText} - ${await res.text()}`);
    }

    const body = await res.json();
    records.push(...body.results);

    if (body.results.length < PAGE_SIZE || records.length >= body.total_count) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return records;
}

async function main() {
  const records = await fetchAllRecords();
  const features = records.map(toFeature).filter(Boolean);

  const output = {
    type: "FeatureCollection",
    generated_at: new Date().toISOString(),
    feature_count: features.length,
    features,
  };

  const dataDir = path.join(__dirname, "..", "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, "outages.json"), JSON.stringify(output, null, 2));

  console.log(`Wrote ${features.length} outage features to data/outages.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
