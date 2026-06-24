# 15-Minute Shanghai - Track A Final Submission

## Project Scope

This final package addresses Track A: Healthy Lifestyle and Sport. The project identifies Shanghai H3 resolution 8 cells that combine everyday 15-minute access with healthy-lifestyle signals such as sport facilities, green space, fresh-food access, cycling-support proxies, and district-level air quality.

## Deliverables

- Three notebooks under `notebooks/` covering data collection, H3 grid/proxy accessibility, and scoring/export inspection.
- Static Web app under `webapp/`, served locally with `npm run serve`.
- Generated H3 GeoJSON and CSV outputs under `outputs/`.
- 500m grid proxy output: `outputs/sh15_trackA_500m_grid_proxy.geojson`.
- District-level summary: `outputs/sh15_trackA_district_summary.csv`.
- Final report: `outputs/sh15_trackA_final_submission.md`.

## Data Decisions

- The course chat states that the 2024 education data has a problem, so education access uses the 2026 Gaode / AMap education POI package.
- Non-education POI categories use the provided 2023 Shanghai shapefiles.
- AQI uses the official Shanghai 2025 district daily export.
- The provided road parquet is retained for the next graph-based stage, but the current final package uses an H3 neighborhood proxy because the graph-tool/policosm notebook depends on a separate environment cleanup.

## Method Summary

Each POI is assigned to an H3 resolution 8 cell. Nearby H3 cells are aggregated using different proxy radii for walk, bike, transit, and car. Category counts are converted through saturating functions, then baseline and Track A raw scores are converted to empirical percentiles across all cells. A 500m square grid proxy is also exported from the scored H3 centroids so the notebook can show a grid stage, while explicitly keeping the limitation that this is not a true road-network isochrone grid. The composite score is:

`0.55 * baseline_score + 0.45 * trackA_score`

This gives a transparent, reproducible final proxy layer while clearly marking the remaining limitation: it is not yet a true network isochrone.

## Main Output Statistics

- H3 feature count: 11344
- 500m grid proxy count: 11344
- District count: 16
- H3 resolution: 8
- Scoring method: H3 neighborhood proxy accessibility with empirical percentile scaling; true graph isochrones not yet substituted.

## Top Districts by Average Composite Score

| District | H3 Cells | Avg Composite | Best H3 | Best Score |
| --- | --- | --- | --- | --- |
| 虹口区 |42 |98.7% |88309958cdfffff |99.6% |
| 徐汇区 |95 |97% |883099598dfffff |99.7% |
| 杨浦区 |107 |92.8% |88309958d9fffff |96% |
| 黄浦区 |38 |91.4% |8830995983fffff |92.7% |
| 静安区 |62 |90.4% |883099591bfffff |91.2% |

## Global Top 10 H3 Cells

| Rank | H3 | District | Composite | Baseline | Track A |
| --- | --- | --- | --- | --- | --- |
| 1 |883099598dfffff |徐汇区 |99.7% |99.9% |99.4% |
| 2 |88309959adfffff |徐汇区 |99.7% |99.4% |100% |
| 3 |88309959e3fffff |徐汇区 |99.7% |99.9% |99.3% |
| 4 |88309959a9fffff |徐汇区 |99.6% |99.8% |99.5% |
| 5 |88309959ebfffff |徐汇区 |99.6% |99.9% |99.3% |
| 6 |8830995985fffff |徐汇区 |99.6% |99.8% |99.3% |
| 7 |88309959abfffff |徐汇区 |99.6% |99.6% |99.6% |
| 8 |88309b96dbfffff |徐汇区 |99.6% |99.3% |99.8% |
| 9 |88309959e7fffff |徐汇区 |99.6% |99.7% |99.4% |
| 10 |88309958cdfffff |虹口区 |99.6% |99.9% |99.1% |

## Web App Use

Run:

```powershell
cd "C:\Users\Baijinhao\Desktop\bjh"
npm install
npm run build:all
npm run serve
```

Then open `http://127.0.0.1:5174/`.

The app supports layer switching, travel-mode switching, weighted Top10 recommendations, district filtering, selected-H3 inspection, and exports for Top10 CSV, weights JSON, selected-H3 JSON, and selected-H3 Markdown reports.

## Known Limitations

- The project uses an H3 neighborhood accessibility proxy, not true graph-tool network isochrones.
- The 500m grid file is a linked proxy centered on scored H3 cells, not a complete authoritative Shanghai 500m lattice.
- The Web app is deployment-ready as a static folder but has not been published to an external hosting service from this machine.
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
- [x] District filter and export functions implemented.
- [x] Final report and district summary generated.
- [x] AI assistance disclosure added.
- [ ] True graph-tool isochrones completed.
- [ ] Web app externally deployed.
- [ ] Trello board exported or submitted.
