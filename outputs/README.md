# Outputs Guide

This folder contains the final generated data and submission evidence.

| File | Purpose |
| --- | --- |
| `sh15_trackA_h3_r8_scored.geojson` | Main H3 r8 scored GeoJSON used by the Web app. |
| `sh15_trackA_500m_grid_proxy.geojson` | 500m square grid proxy linked to scored H3 cells. |
| `sh15_trackA_top10_h3.csv` | Global Top10 H3 cells by composite score. |
| `sh15_trackA_district_summary.csv` | District-level average scores and best H3 cells. |
| `sh15_trackA_data_dictionary.csv` | Field definitions. |
| `data_provenance_trackA.csv` | Data source provenance and row counts. |
| `sh15_pdf_requirement_checklist.csv` | Direct checklist against the project PDF. |
| `sh15_trackA_final_submission.md` | Final method, results, and limitations summary. |

The public Web app reads `webapp/data/sh15_trackA_h3_r8_scored.geojson`, which is synchronized with the main H3 output.
