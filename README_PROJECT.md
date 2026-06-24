# 15-Minute Shanghai Track A Final Package

This folder turns the provided course materials into a reproducible Track A final package.

## Current scope

- Track: Healthy Lifestyle and Sport.
- H3 output: resolution 8 GeoJSON.
- Web app: static Leaflet application under `webapp/`.
- Data build: `scripts/build_track_a_dataset.mjs`.
- 500m grid proxy build: `scripts/build_500m_grid_proxy.mjs`.
- Final assets build: `scripts/build_final_submission_assets.mjs`.

## Important source decisions

- The WeChat record says the 2024 education POI data has a problem.
- Education access therefore uses `EDU 2026 POI`, which was collected from the Gaode / AMap API.
- The 2023 POI shapefiles are used for non-education POI categories.
- Shapefile sidecar files must stay together: `.shp`, `.dbf`, `.shx`, `.prj`, and `.cpg`.
- AQI uses the official Shanghai 2025 package.

## Run

```powershell
cd "C:\Users\Baijinhao\Desktop\bjh"
npm install
npm run build:all
npm run serve
```

Then open the local URL printed by the server.

## Outputs

- `outputs/sh15_trackA_h3_r8_scored.geojson`
- `outputs/sh15_trackA_500m_grid_proxy.geojson`
- `outputs/sh15_trackA_500m_grid_summary.csv`
- `outputs/sh15_trackA_top10_h3.csv`
- `outputs/sh15_trackA_data_dictionary.csv`
- `outputs/data_provenance_trackA.csv`
- `outputs/sh15_trackA_district_summary.csv`
- `outputs/sh15_pdf_requirement_checklist.csv`
- `outputs/sh15_trackA_final_submission.md`
- `webapp/data/sh15_trackA_h3_r8_scored.geojson`

## Web App Features

- Layer switching: Composite, Baseline, Track A, Green, Air.
- Travel mode switching: walk, bike, transit, car baseline proxies.
- District filter for local Top10 recommendations.
- Weighted recommendation sliders.
- Selected-H3 inspection with recommendation, strength, watch point, top amenity counts, transit/metro proxy note, and rent-band data note.
- Export functions: current Top10 CSV, weights JSON, selected-H3 JSON, selected-H3 Markdown report.

## Scoring Method

Each POI is assigned to an H3 resolution 8 cell. For each cell, nearby H3 cells are aggregated with different proxy radii for walk, bike, transit, and car. Raw category scores use saturating functions so one very dense category does not dominate the whole score.

The project also exports `outputs/sh15_trackA_500m_grid_proxy.geojson`. This file creates 500m square grid proxies centered on the scored H3 r8 cells and carries the same four travel-mode proxy scores. It documents the requested grid stage, but it is not a replacement for true network-travel-time grid isochrones.

The raw baseline and Track A scores are then converted to empirical percentiles across all Shanghai H3 cells. This keeps scores comparable while avoiding the previous issue where many central cells all rounded to 100%.

- `baseline_score`: everyday 15-minute access proxy from food, shopping, health, education, transit, and green/public facilities.
- `trackA_score`: healthy-lifestyle proxy from sport, green, cycling support, fresh food, and AQI.
- `composite_score`: `0.55 * baseline_score + 0.45 * trackA_score`.

## Limitations

This first prototype uses H3 neighborhood proxy accessibility rather than graph-based isochrones. The provided network notebook depends on `graph_tool`, `policosm`, and old absolute paths, so it needs a separate environment cleanup before true network isochrones can replace the proxy scores.

The Web app is ready to be hosted as a static folder, but this machine has not published it to an external hosting service. For final submission, provide either the local demonstration URL during presentation or deploy the `webapp/` folder through a static host such as GitHub Pages, Netlify, or Vercel.

No verified rental-listing dataset is present in this Track A folder, so the selected-H3 panel reports rent band as not collected rather than inventing a value. Metro distance is represented only by a transit POI proxy count unless a station layer is added before submission.

## PDF Requirement Status

- Strongest completed parts: H3 r8 scored GeoJSON, Track A Web app, district filter, weighted Top10 recommender, data transparency, exports, data provenance.
- Improved but still proxy-based: 500m grid and walk/bike/transit/car isochrone stage.
- Still needs user/account action: public deployed URL and Trello shared board.
- Still not a true replacement for the brief: graph-based 15-minute network isochrones.

## Academic Integrity and AI Disclosure

Codex/AI assistance was used to help organize code, draft documentation, and validate the local Web app. The student should review all analysis, interpretation, and submission choices before final submission. No API keys are stored in this project folder.
