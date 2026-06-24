# Submission Guide

Use this file as the quick handoff checklist for the instructor.

## Submit These Links

1. Web app: https://h82126583-arch.github.io/sh15-track-a-bjh/
2. GitHub repository: https://github.com/h82126583-arch/sh15-track-a-bjh
3. Trello shared board link: copy from Trello and submit separately.

## Recommended Review Order

1. Open the Web app.
2. Check the map layer toggle: Composite, Baseline, Track A, Green, Air.
3. Check travel modes: Walk, Bike, Transit, Car.
4. Use the district filter and "Where to live" sliders.
5. Click a hexagon and inspect the detail panel.
6. Open `notebooks/01_data_collection.ipynb` for data sources and literature review.
7. Open `notebooks/02_grid_isochrones.ipynb` for grid and mode proxy documentation.
8. Open `notebooks/03_scoring_h3.ipynb` for scoring and H3 export checks.
9. Open `outputs/sh15_pdf_requirement_checklist.csv` for requirement status.

## Files That Matter Most

- `README.md`: overview for GitHub.
- `README_PROJECT.md`: technical details.
- `notebooks/`: documented analytical pipeline.
- `outputs/sh15_trackA_final_submission.md`: concise final summary.
- `outputs/sh15_pdf_requirement_checklist.csv`: requirement-by-requirement status.
- `webapp/`: static application source deployed through GitHub Pages.

## Honest Limitations To Mention

- Four-mode accessibility is implemented as a reproducible H3 proxy, not true network isochrones.
- The 500m grid file is a proxy linked to H3 centroids.
- Rent band and exact metro distance are not directly measured from verified datasets.
- Trello should be submitted as the shared board link from Trello.
