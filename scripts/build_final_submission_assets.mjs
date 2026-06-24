import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputsDir = join(root, 'outputs');
const geojsonPath = join(outputsDir, 'sh15_trackA_h3_r8_scored.geojson');
const top10Path = join(outputsDir, 'sh15_trackA_top10_h3.csv');
const gridPath = join(outputsDir, 'sh15_trackA_500m_grid_proxy.geojson');

if (!existsSync(geojsonPath)) throw new Error(`Missing GeoJSON: ${geojsonPath}`);
mkdirSync(outputsDir, { recursive: true });

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function pct(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(path, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  }
  writeFileSync(path, `\uFEFF${lines.join('\n')}\n`, 'utf-8');
}

function avg(rows, field) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row.properties[field] || 0), 0) / rows.length;
}

function districtSummary(features) {
  const byDistrict = new Map();
  for (const feature of features) {
    const district = feature.properties.district || 'Unknown';
    if (!byDistrict.has(district)) byDistrict.set(district, []);
    byDistrict.get(district).push(feature);
  }

  return [...byDistrict.entries()].map(([district, rows]) => {
    const best = [...rows].sort((a, b) => b.properties.composite_score - a.properties.composite_score)[0];
    return {
      district,
      h3_count: rows.length,
      avg_composite_score: round(avg(rows, 'composite_score')),
      avg_baseline_score: round(avg(rows, 'baseline_score')),
      avg_trackA_score: round(avg(rows, 'trackA_score')),
      avg_air_quality_score: round(avg(rows, 'air_quality_score')),
      avg_sport_count: round(avg(rows, 'sport_count'), 2),
      avg_green_count: round(avg(rows, 'green_count'), 2),
      avg_education_count: round(avg(rows, 'education_count'), 2),
      avg_transit_count: round(avg(rows, 'transit_count'), 2),
      best_h3_r8: best.properties.h3_r8,
      best_composite_score: best.properties.composite_score,
    };
  }).sort((a, b) => b.avg_composite_score - a.avg_composite_score);
}

function markdownTable(rows, columns) {
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => row[column]).join(' |')} |`);
  return [header, separator, ...body].join('\n');
}

function readTop10() {
  if (!existsSync(top10Path)) return [];
  const lines = readFileSync(top10Path, 'utf-8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = lines.shift()?.split(',') || [];
  return lines.map((line) => {
    const parts = line.split(',');
    return Object.fromEntries(header.map((name, index) => [name, parts[index] || '']));
  });
}

const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8'));
const features = geojson.features || [];
const summaries = districtSummary(features);
const top10 = readTop10();
const gridMetadata = existsSync(gridPath)
  ? JSON.parse(readFileSync(gridPath, 'utf-8')).metadata || {}
  : null;

const summaryCsv = join(outputsDir, 'sh15_trackA_district_summary.csv');
writeCsv(summaryCsv, summaries, [
  'district',
  'h3_count',
  'avg_composite_score',
  'avg_baseline_score',
  'avg_trackA_score',
  'avg_air_quality_score',
  'avg_sport_count',
  'avg_green_count',
  'avg_education_count',
  'avg_transit_count',
  'best_h3_r8',
  'best_composite_score',
]);

const checklistCsv = join(outputsDir, 'sh15_pdf_requirement_checklist.csv');
writeCsv(checklistCsv, [
  { requirement: 'Three documented notebooks', status: 'partial', evidence: 'notebooks/01_data_collection.ipynb; notebooks/02_grid_isochrones.ipynb; notebooks/03_scoring_h3.ipynb', risk: 'Core build is scripted in Node and called from notebooks rather than pure Python.' },
  { requirement: '01 notebook literature review >=4 papers and 800 words', status: 'improved', evidence: '01 notebook top markdown cell includes 6 DOI references and methodology/equity critique.', risk: 'Word count should be rechecked after final editing.' },
  { requirement: '500m grid', status: 'proxy', evidence: 'outputs/sh15_trackA_500m_grid_proxy.geojson', risk: 'Grid squares are centered on scored H3 cells, not a full authoritative municipal 500m lattice.' },
  { requirement: 'Four-mode 15-minute isochrones', status: 'proxy', evidence: 'walk/bike/transit/car baseline proxy fields in H3 and 500m outputs', risk: 'Not true network travel-time isochrones.' },
  { requirement: 'H3 r8 scored GeoJSON', status: 'done', evidence: 'outputs/sh15_trackA_h3_r8_scored.geojson', risk: 'Scores depend on available proxy data quality.' },
  { requirement: 'Public deployed web app', status: 'done', evidence: 'https://h82126583-arch.github.io/sh15-track-a-bjh/', risk: 'Uses external Leaflet CDN; network restrictions may affect loading.' },
  { requirement: 'Trello board shared link', status: 'user_completed', evidence: 'Student reported Trello board completed; submit shared Trello link separately.', risk: 'Historical weekly movement cannot be verified from local files.' },
  { requirement: 'Academic integrity / AI disclosure', status: 'done', evidence: 'README_PROJECT.md and final submission notes', risk: 'Disclosure wording should be kept with submitted materials.' },
], ['requirement', 'status', 'evidence', 'risk']);

const topDistricts = summaries.slice(0, 5).map((row) => ({
  District: row.district,
  'H3 Cells': row.h3_count,
  'Avg Composite': pct(row.avg_composite_score),
  'Best H3': row.best_h3_r8,
  'Best Score': pct(row.best_composite_score),
}));

const topH3 = top10.slice(0, 10).map((row) => ({
  Rank: row.rank,
  H3: row.h3_r8,
  District: row.district,
  Composite: pct(row.composite_score),
  Baseline: pct(row.baseline_score),
  'Track A': pct(row.trackA_score),
}));

const report = `# 15-Minute Shanghai - Track A Final Submission

## Project Scope

This final package addresses Track A: Healthy Lifestyle and Sport. The project identifies Shanghai H3 resolution 8 cells that combine everyday 15-minute access with healthy-lifestyle signals such as sport facilities, green space, fresh-food access, cycling-support proxies, and district-level air quality.

## Deliverables

- Three notebooks under \`notebooks/\` covering data collection, H3 grid/proxy accessibility, and scoring/export inspection.
- Static Web app under \`webapp/\`, served locally with \`npm run serve\`.
- Public Web app: \`https://h82126583-arch.github.io/sh15-track-a-bjh/\`.
- GitHub repository: \`https://github.com/h82126583-arch/sh15-track-a-bjh\`.
- Generated H3 GeoJSON and CSV outputs under \`outputs/\`.
- 500m grid proxy output: \`outputs/sh15_trackA_500m_grid_proxy.geojson\`.
- District-level summary: \`outputs/sh15_trackA_district_summary.csv\`.
- Final report: \`outputs/sh15_trackA_final_submission.md\`.

## Data Decisions

- The course chat states that the 2024 education data has a problem, so education access uses the 2026 Gaode / AMap education POI package.
- Non-education POI categories use the provided 2023 Shanghai shapefiles.
- AQI uses the official Shanghai 2025 district daily export.
- The provided road parquet is retained for the next graph-based stage, but the current final package uses an H3 neighborhood proxy because the graph-tool/policosm notebook depends on a separate environment cleanup.

## Method Summary

Each POI is assigned to an H3 resolution 8 cell. Nearby H3 cells are aggregated using different proxy radii for walk, bike, transit, and car. Category counts are converted through saturating functions, then baseline and Track A raw scores are converted to empirical percentiles across all cells. A 500m square grid proxy is also exported from the scored H3 centroids so the notebook can show a grid stage, while explicitly keeping the limitation that this is not a true road-network isochrone grid. The composite score is:

\`0.55 * baseline_score + 0.45 * trackA_score\`

This gives a transparent, reproducible final proxy layer while clearly marking the remaining limitation: it is not yet a true network isochrone.

## Main Output Statistics

- H3 feature count: ${features.length}
- 500m grid proxy count: ${gridMetadata?.feature_count ?? 'not generated'}
- District count: ${summaries.length}
- H3 resolution: ${geojson.metadata?.h3_resolution ?? 'n/a'}
- Scoring method: ${geojson.metadata?.scoring_method ?? 'n/a'}

## Top Districts by Average Composite Score

${markdownTable(topDistricts, ['District', 'H3 Cells', 'Avg Composite', 'Best H3', 'Best Score'])}

## Global Top 10 H3 Cells

${markdownTable(topH3, ['Rank', 'H3', 'District', 'Composite', 'Baseline', 'Track A'])}

## Web App Use

Run:

\`\`\`powershell
cd "C:\\Users\\Baijinhao\\Desktop\\bjh"
npm install
npm run build:all
npm run serve
\`\`\`

Then open \`http://127.0.0.1:5174/\`. The deployed version is available at \`https://h82126583-arch.github.io/sh15-track-a-bjh/\`.

The app supports layer switching, travel-mode switching, weighted Top10 recommendations, district filtering, selected-H3 inspection, and exports for Top10 CSV, weights JSON, selected-H3 JSON, and selected-H3 Markdown reports.

## Known Limitations

- The project uses an H3 neighborhood accessibility proxy, not true graph-tool network isochrones.
- The 500m grid file is a linked proxy centered on scored H3 cells, not a complete authoritative Shanghai 500m lattice.
- The Web app is deployed through GitHub Pages; if a restricted network blocks the Leaflet CDN, run the local version with \`npm run serve\`.
- The selected-H3 panel reports metro and rent requirements transparently as unavailable/approximated because no verified metro-distance or rental-listing dataset is present in the provided Track A data.
- AQI is district-level, so it cannot represent within-district micro-variation.
- POI categories are proxy indicators; final policy conclusions should be checked against local knowledge and network travel time.

## Academic Integrity and AI Disclosure

Codex/AI assistance was used to help organize code, draft documentation, and validate the local Web app. Data interpretation, source choices, and final submission decisions should be reviewed by the student before submission. No API keys are stored in the submitted project files.

## Final Submission Checklist

- [x] Source data decisions documented.
- [x] 2024 education data issue handled by using 2026 Gaode / AMap education POI.
- [x] H3 scored GeoJSON generated.
- [x] 500m grid proxy generated and documented.
- [x] Web app implemented and locally runnable.
- [x] Web app externally deployed through GitHub Pages.
- [x] District filter and export functions implemented.
- [x] Final report and district summary generated.
- [x] AI assistance disclosure added.
- [ ] True graph-tool isochrones completed.
- [x] Trello board organized by student; submit the shared Trello link separately.
`;

const reportPath = join(outputsDir, 'sh15_trackA_final_submission.md');
writeFileSync(reportPath, `\uFEFF${report}`, 'utf-8');

console.log(`Wrote ${summaryCsv}`);
console.log(`Wrote ${checklistCsv}`);
console.log(`Wrote ${reportPath}`);
