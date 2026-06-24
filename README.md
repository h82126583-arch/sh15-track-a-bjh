# 15-Minute Shanghai - Track A Final Submission

Track A: Healthy Lifestyle and Sport  
Student repository for the 15-Minute Shanghai graduate project.

## Submission Links

- Public Web app: https://h82126583-arch.github.io/sh15-track-a-bjh/
- GitHub repository: https://github.com/h82126583-arch/sh15-track-a-bjh
- Trello board: submit the shared Trello link separately from Trello.

## What To Review First

1. Open the public Web app and inspect the H3 map, layer toggles, travel-mode toggles, district filter, and "Where to live" recommender.
2. Review the three notebooks in `notebooks/`.
3. Review `outputs/sh15_trackA_final_submission.md` for the final method summary.
4. Review `outputs/sh15_pdf_requirement_checklist.csv` for a direct requirement-by-requirement status table.

## Folder Guide

| Folder/File | Purpose |
| --- | --- |
| `notebooks/01_data_collection.ipynb` | Data sources, validation, and 800+ word literature review. |
| `notebooks/02_grid_isochrones.ipynb` | 500m grid proxy and four-mode accessibility proxy documentation. |
| `notebooks/03_scoring_h3.ipynb` | Baseline + Track A scoring, H3 aggregation, and export checks. |
| `webapp/` | Deployed static Web application source. |
| `webapp/data/sh15_trackA_h3_r8_scored.geojson` | Data used directly by the Web app. |
| `outputs/` | Final GeoJSON, CSV, checklist, and method summary outputs. |
| `scripts/` | Reproducible Node.js build scripts. |
| `README_PROJECT.md` | More detailed technical project notes. |
| `SUBMISSION_GUIDE.md` | Quick checklist for what to submit and how to verify it. |

## Run Locally

```powershell
npm install
npm run build:all
npm run serve
```

Then open the local URL printed by the server.

## Main Outputs

- `outputs/sh15_trackA_h3_r8_scored.geojson`: scored H3 r8 GeoJSON, 11344 features.
- `outputs/sh15_trackA_500m_grid_proxy.geojson`: 500m square grid proxy, 11344 features.
- `outputs/sh15_trackA_top10_h3.csv`: global Top10 H3 cells.
- `outputs/sh15_trackA_district_summary.csv`: district-level score summary.
- `outputs/data_provenance_trackA.csv`: source provenance.
- `outputs/sh15_trackA_final_submission.md`: final method and results summary.
- `outputs/sh15_pdf_requirement_checklist.csv`: requirement status checklist.

## Current Method Status

Completed:

- H3 r8 choropleth Web app.
- Baseline and Track A scoring layers.
- Walk, bike, transit, and car mode toggles using reproducible proxy scores.
- 500m grid proxy export.
- 800+ word literature review with 6 DOI references.
- Data provenance and output dictionary.
- Public GitHub Pages deployment.

Limitations:

- The accessibility layer is an H3 neighborhood proxy, not a true graph-tool / network-travel-time isochrone model.
- The 500m grid output is linked to scored H3 centroids, not a complete authoritative Shanghai municipal grid.
- Rent band and metro-station distance are marked transparently as unavailable or proxied because verified datasets were not present in the provided Track A folder.
- NDVI, verified cycling-lane length, and swimming-pool subtype validation remain future improvements.

## Academic Integrity and AI Disclosure

Codex/AI assistance was used to help organize code, draft documentation, validate the local Web app, and prepare the GitHub deployment. The analysis, interpretation, source choices, and final submission decisions should be reviewed by the student before submission. No API keys are stored in this repository.
