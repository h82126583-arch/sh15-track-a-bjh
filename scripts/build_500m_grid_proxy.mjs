import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputsDir = join(root, 'outputs');
const h3Path = join(outputsDir, 'sh15_trackA_h3_r8_scored.geojson');
const gridPath = join(outputsDir, 'sh15_trackA_500m_grid_proxy.geojson');
const summaryPath = join(outputsDir, 'sh15_trackA_500m_grid_summary.csv');

if (!existsSync(h3Path)) throw new Error(`Missing H3 GeoJSON: ${h3Path}`);
mkdirSync(outputsDir, { recursive: true });

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
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

function centerOfPolygon(feature) {
  const ring = feature.geometry?.coordinates?.[0] || [];
  const points = ring.slice(0, -1);
  if (!points.length) return [0, 0];
  const sums = points.reduce((acc, point) => [acc[0] + Number(point[0]), acc[1] + Number(point[1])], [0, 0]);
  return [sums[0] / points.length, sums[1] / points.length];
}

function square500m(lng, lat) {
  const halfSideMeters = 250;
  const latDelta = halfSideMeters / 111320;
  const lngDelta = halfSideMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const west = lng - lngDelta;
  const east = lng + lngDelta;
  const south = lat - latDelta;
  const north = lat + latDelta;
  return [
    [round(west), round(south)],
    [round(east), round(south)],
    [round(east), round(north)],
    [round(west), round(north)],
    [round(west), round(south)],
  ];
}

const h3 = JSON.parse(readFileSync(h3Path, 'utf-8'));
const gridFeatures = (h3.features || []).map((feature, index) => {
  const props = feature.properties || {};
  const [lng, lat] = centerOfPolygon(feature);
  return {
    type: 'Feature',
    properties: {
      grid_id: `grid500_${String(index + 1).padStart(5, '0')}`,
      linked_h3_r8: props.h3_r8,
      district: props.district,
      center_lng: round(lng),
      center_lat: round(lat),
      composite_score: props.composite_score,
      baseline_score: props.baseline_score,
      trackA_score: props.trackA_score,
      walk_baseline_score: props.walk_baseline_score,
      bike_baseline_score: props.bike_baseline_score,
      transit_baseline_score: props.transit_baseline_score,
      car_baseline_score: props.car_baseline_score,
      sport_count: props.sport_count,
      green_count: props.green_count,
      fresh_food_count: props.fresh_food_count,
      bike_support_count: props.bike_support_count,
      mean_aqi: props.mean_aqi,
      method_note: '500m square proxy centered on the linked H3 r8 cell; not a replacement for true network isochrone grid cells.',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [square500m(lng, lat)],
    },
  };
});

const grid = {
  type: 'FeatureCollection',
  name: 'sh15_trackA_500m_grid_proxy',
  metadata: {
    generated_at: new Date().toISOString(),
    grid_spacing_m: 500,
    feature_count: gridFeatures.length,
    linked_h3_resolution: h3.metadata?.h3_resolution ?? 8,
    method: '500m square proxy centered on each scored H3 r8 cell centroid; used as reproducible evidence of the requested grid stage while true 4-mode network isochrones remain pending.',
  },
  features: gridFeatures,
};

writeFileSync(gridPath, JSON.stringify(grid), 'utf-8');
writeCsv(summaryPath, [
  {
    output: 'sh15_trackA_500m_grid_proxy.geojson',
    grid_spacing_m: 500,
    feature_count: gridFeatures.length,
    linked_h3_resolution: grid.metadata.linked_h3_resolution,
    method: grid.metadata.method,
  },
], ['output', 'grid_spacing_m', 'feature_count', 'linked_h3_resolution', 'method']);

console.log(`Wrote ${gridPath}`);
console.log(`Wrote ${summaryPath}`);
