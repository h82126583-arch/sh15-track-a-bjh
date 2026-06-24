import { createReadStream, existsSync, mkdirSync, openSync, readSync, closeSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { latLngToCell, cellToBoundary, gridDisk } from 'h3-js';

const root = fileURLToPath(new URL('../', import.meta.url));
const shapeDir = join(root, '2023_Shp', 'Shp');
const eduCsv = join(root, 'EDU 2026 POI', 'preschool_k12_clean.csv');
const aqiCsv = join(
  root,
  'shanghai_aqi_official_2025_20250101_20251231_package',
  'clean',
  'shanghai_aqi_district_daily_sthj_official_20250101_20251231.csv',
);
const outputsDir = join(root, 'outputs');
const webDataDir = join(root, 'webapp', 'data');
const h3Resolution = 8;

mkdirSync(outputsDir, { recursive: true });
mkdirSync(webDataDir, { recursive: true });

const decoder = new TextDecoder('utf-8', { fatal: false });
const cells = new Map();
const provenance = [];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function saturation(count, threshold) {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return clamp(1 - Math.exp(-count / Math.max(0.0001, threshold)));
}

function getCellStats(cell) {
  if (!cells.has(cell)) {
    cells.set(cell, {
      h3_r8: cell,
      poi_total: 0,
      food_count: 0,
      shopping_count: 0,
      life_count: 0,
      health_count: 0,
      education_count: 0,
      transit_count: 0,
      sport_count: 0,
      green_count: 0,
      public_count: 0,
      fresh_food_count: 0,
      bike_support_count: 0,
      districts: new Map(),
    });
  }
  return cells.get(cell);
}

function addDistrict(stats, district) {
  const key = normalizeDistrict(district);
  if (!key) return;
  stats.districts.set(key, (stats.districts.get(key) || 0) + 1);
}

function normalizeDistrict(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text === '浦东' || text === '浦东新区') return '浦东新区';
  if (text.endsWith('区') || text === '崇明县') return text.replace('崇明县', '崇明区');
  return text;
}

function classifyPoi(row, stats) {
  const major = row.major || '';
  const detail = `${row.name || ''} ${row.type || ''} ${row.mid || ''} ${row.minor || ''}`;
  stats.poi_total += 1;

  if (major.includes('餐饮')) stats.food_count += 1;
  if (major.includes('购物')) stats.shopping_count += 1;
  if (major.includes('生活')) stats.life_count += 1;
  if (major.includes('医疗')) stats.health_count += 1;
  if (major.includes('交通')) stats.transit_count += 1;
  if (major.includes('体育')) stats.sport_count += 1;
  if (major.includes('风景')) stats.green_count += 1;
  if (major.includes('公共')) stats.public_count += 1;

  if (/公园|绿地|花园|湿地|森林|滨江|广场/.test(detail)) stats.green_count += 1;
  if (/健身|体育|运动|篮球|足球|网球|羽毛球|游泳|瑜伽|舞蹈|武术|跑道|球场|fitness|gym/i.test(detail)) {
    stats.sport_count += 1;
  }
  if (/菜场|农贸|生鲜|水果|蔬菜|超市|便利店|market|fresh/i.test(detail)) {
    stats.fresh_food_count += 1;
  }
  if (/自行车|单车|骑行|bike|cycling/i.test(detail)) {
    stats.bike_support_count += 1;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);
      if (row.some((item) => item.length)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value.length || row.length) {
    row.push(value);
    if (row.some((item) => item.length)) rows.push(row);
  }
  const header = rows.shift() || [];
  return rows.map((items) => Object.fromEntries(header.map((name, index) => [name, items[index] ?? ''])));
}

function readFileBuffer(path) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    createReadStream(path)
      .on('data', (chunk) => chunks.push(chunk))
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function readCsvFile(path) {
  const buffer = await readFileBuffer(path);
  return parseCsv(decoder.decode(buffer));
}

function parseDbfHeader(filePath) {
  const fd = openSync(filePath, 'r');
  const header = Buffer.alloc(32);
  readSync(fd, header, 0, 32, 0);
  const recordCount = header.readUInt32LE(4);
  const headerLength = header.readUInt16LE(8);
  const recordLength = header.readUInt16LE(10);
  const fieldBytes = Buffer.alloc(headerLength - 33);
  readSync(fd, fieldBytes, 0, fieldBytes.length, 32);

  const fields = [];
  let offset = 1;
  for (let pos = 0; pos < fieldBytes.length; pos += 32) {
    if (fieldBytes[pos] === 0x0d) break;
    const nameBytes = fieldBytes.subarray(pos, pos + 11);
    const zero = nameBytes.indexOf(0);
    const fieldName = decoder.decode(nameBytes.subarray(0, zero >= 0 ? zero : nameBytes.length)).trim();
    const length = fieldBytes[pos + 16];
    fields.push({ name: fieldName, offset, length });
    offset += length;
  }
  closeSync(fd);
  return { recordCount, headerLength, recordLength, fields };
}

function fieldLookup(fields) {
  return new Map(fields.map((field) => [field.name, field]));
}

function readField(record, field) {
  if (!field) return '';
  return decoder.decode(record.subarray(field.offset, field.offset + field.length)).trim();
}

function listShapeDbfs() {
  return readdirSync(shapeDir)
    .filter((name) => name.toLowerCase().endsWith('.dbf'))
    .map((name) => join(shapeDir, name))
    .sort();
}

function addPoiPoint(lng, lat, district, classifier) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < 120 || lng > 123 || lat < 30 || lat > 32.5) return false;
  const cell = latLngToCell(lat, lng, h3Resolution);
  const stats = getCellStats(cell);
  classifier(stats);
  addDistrict(stats, district);
  return true;
}

async function loadShapefileDbfs() {
  let totalRows = 0;
  let usedRows = 0;

  for (const dbfPath of listShapeDbfs()) {
    const header = parseDbfHeader(dbfPath);
    const fields = fieldLookup(header.fields);
    const fd = openSync(dbfPath, 'r');
    const batchRecords = 4000;
    const batchSize = header.recordLength * batchRecords;
    const buffer = Buffer.alloc(batchSize);
    let position = header.headerLength;
    let remaining = header.recordCount;
    let fileRows = 0;
    let fileUsed = 0;
    let fileCategory = '';

    const selected = {
      lng: fields.get('经度'),
      lat: fields.get('纬度'),
      major: fields.get('行业大'),
      mid: fields.get('行业中'),
      minor: fields.get('行业小'),
      name: fields.get('name'),
      type: fields.get('type'),
      district: fields.get('adname'),
    };

    while (remaining > 0) {
      const take = Math.min(batchRecords, remaining);
      const bytes = readSync(fd, buffer, 0, take * header.recordLength, position);
      if (bytes <= 0) break;
      for (let index = 0; index < take; index += 1) {
        const start = index * header.recordLength;
        const record = buffer.subarray(start, start + header.recordLength);
        if (record[0] === 0x2a) continue;
        fileRows += 1;
        const lng = Number(readField(record, selected.lng));
        const lat = Number(readField(record, selected.lat));
        const row = {
          major: readField(record, selected.major),
          mid: readField(record, selected.mid),
          minor: readField(record, selected.minor),
          name: readField(record, selected.name),
          type: readField(record, selected.type),
        };
        if (!fileCategory && row.major) fileCategory = row.major;
        const district = readField(record, selected.district);
        if (addPoiPoint(lng, lat, district, (stats) => classifyPoi(row, stats))) fileUsed += 1;
      }
      remaining -= take;
      position += bytes;
    }
    closeSync(fd);
    totalRows += fileRows;
    usedRows += fileUsed;
    provenance.push({
      dataset: fileCategory ? `2023 POI - ${fileCategory}` : basename(dbfPath),
      source: '2023_Shp.zip from course WeChat record',
      rows_read: fileRows,
      rows_used: fileUsed,
      notes: 'WGS84 POI DBF read directly; matching shapefile sidecars retained.',
    });
    console.log(`Loaded ${basename(dbfPath)}: ${fileUsed}/${fileRows}`);
  }
  console.log(`Loaded shapefile DBF POIs: ${usedRows}/${totalRows}`);
}

function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat];
  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
  const mgLat = lat + dLat;
  const mgLng = lng + dLng;
  return [lng * 2 - mgLng, lat * 2 - mgLat];
}

async function loadEducationPoi() {
  const rows = await readCsvFile(eduCsv);
  let used = 0;
  for (const row of rows) {
    const lng = Number(row.lng);
    const lat = Number(row.lat);
    const [wgsLng, wgsLat] = gcj02ToWgs84(lng, lat);
    if (addPoiPoint(wgsLng, wgsLat, row.district, (stats) => {
      stats.education_count += 1;
      stats.poi_total += 1;
    })) {
      used += 1;
    }
  }
  provenance.push({
    dataset: relative(root, eduCsv),
    source: 'Gaode / AMap API; provided as EDU 2026 POI.zip',
    rows_read: rows.length,
    rows_used: used,
    notes: 'GCJ-02 coordinates converted to WGS84 before H3 indexing.',
  });
  console.log(`Loaded education POI: ${used}/${rows.length}`);
}

async function loadAqi() {
  const rows = await readCsvFile(aqiCsv);
  const byDistrict = new Map();
  for (const row of rows) {
    const district = normalizeDistrict(row.group_name);
    const aqi = Number(row.aqi);
    if (!district || !Number.isFinite(aqi)) continue;
    if (!byDistrict.has(district)) byDistrict.set(district, []);
    byDistrict.get(district).push(aqi);
  }
  const means = new Map();
  for (const [district, values] of byDistrict.entries()) {
    means.set(district, values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  provenance.push({
    dataset: relative(root, aqiCsv),
    source: 'Shanghai Municipal Bureau of Ecology and Environment official 2025 export',
    rows_read: rows.length,
    rows_used: [...byDistrict.values()].reduce((sum, values) => sum + values.length, 0),
    notes: 'Annual district mean AQI; blank AQI rows ignored.',
  });
  return means;
}

function dominantDistrict(stats) {
  let best = '';
  let bestCount = 0;
  for (const [district, count] of stats.districts.entries()) {
    if (count > bestCount) {
      best = district;
      bestCount = count;
    }
  }
  return best;
}

function aggregateAround(cell, radius) {
  const sum = {
    food_count: 0,
    shopping_count: 0,
    life_count: 0,
    health_count: 0,
    education_count: 0,
    transit_count: 0,
    sport_count: 0,
    green_count: 0,
    public_count: 0,
    fresh_food_count: 0,
    bike_support_count: 0,
  };
  for (const neighbor of gridDisk(cell, radius)) {
    const stats = cells.get(neighbor);
    if (!stats) continue;
    for (const key of Object.keys(sum)) sum[key] += stats[key] || 0;
  }
  return sum;
}

function baselineScore(counts, areaFactor) {
  const food = saturation(counts.food_count, 22 * areaFactor);
  const shops = saturation(counts.shopping_count + counts.life_count, 36 * areaFactor);
  const health = saturation(counts.health_count, 8 * areaFactor);
  const education = saturation(counts.education_count, 5 * areaFactor);
  const transit = saturation(counts.transit_count, 18 * areaFactor);
  const green = saturation(counts.green_count + counts.public_count, 8 * areaFactor);
  return (food + shops + health + education + transit + green) / 6;
}

function trackScore(counts, airScore, areaFactor) {
  const sport = saturation(counts.sport_count, 16 * areaFactor);
  const green = saturation(counts.green_count, 10 * areaFactor);
  const cycling = saturation(counts.bike_support_count, 2.5 * areaFactor);
  const fresh = saturation(counts.fresh_food_count, 10 * areaFactor);
  return sport * 0.32 + green * 0.24 + cycling * 0.14 + fresh * 0.15 + airScore * 0.15;
}

function cellPolygon(cell) {
  const ring = cellToBoundary(cell, true);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function lowerBound(sortedValues, target) {
  let left = 0;
  let right = sortedValues.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedValues[mid] < target) left = mid + 1;
    else right = mid;
  }
  return left;
}

function upperBound(sortedValues, target) {
  let left = 0;
  let right = sortedValues.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedValues[mid] <= target) left = mid + 1;
    else right = mid;
  }
  return left;
}

function percentileScalers(rows, fields) {
  return Object.fromEntries(fields.map((field) => {
    const values = rows
      .map((row) => Number(row[field]))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    return [field, (value) => {
      const number = Number(value);
      if (!Number.isFinite(number) || !values.length) return 0;
      const lower = lowerBound(values, number);
      const upper = upperBound(values, number);
      const lastTieRank = Math.max(lower, upper - 1);
      const midpointRank = (lower + lastTieRank) / 2;
      return clamp((midpointRank + 0.5) / (values.length + 1));
    }];
  }));
}

function scoreCells(aqiMeans) {
  const meanValues = [...aqiMeans.values()];
  const minAqi = Math.min(...meanValues);
  const maxAqi = Math.max(...meanValues);
  const modeRadii = { walk: 2, bike: 4, transit: 5, car: 7 };
  const drafts = [];
  const features = [];

  for (const [cell, stats] of cells.entries()) {
    const district = dominantDistrict(stats);
    const meanAqi = aqiMeans.get(district);
    const airQualityScore = Number.isFinite(meanAqi)
      ? clamp(1 - (meanAqi - minAqi) / Math.max(1, maxAqi - minAqi))
      : 0.5;
    const modeScoresRaw = {};
    const modeCounts = {};

    for (const [mode, radius] of Object.entries(modeRadii)) {
      const counts = aggregateAround(cell, radius);
      const areaFactor = Math.max(1, (radius * radius) / 4);
      modeScoresRaw[`${mode}_baseline_raw`] = baselineScore(counts, areaFactor);
      modeCounts[mode] = counts;
    }

    const walkCounts = modeCounts.walk;
    drafts.push({
      cell,
      stats,
      district,
      meanAqi,
      airQualityScore,
      trackA_raw: trackScore(walkCounts, airQualityScore, 1),
      ...modeScoresRaw,
    });
  }

  const scoreFields = [
    'trackA_raw',
    ...Object.keys(modeRadii).map((mode) => `${mode}_baseline_raw`),
  ];
  const scales = percentileScalers(drafts, scoreFields);

  for (const draft of drafts) {
    const { cell, stats, district, meanAqi, airQualityScore } = draft;
    const modeScores = {};
    for (const mode of Object.keys(modeRadii)) {
      const rawField = `${mode}_baseline_raw`;
      modeScores[`${mode}_baseline_score`] = scales[rawField](draft[rawField]);
    }

    const baseline = modeScores.walk_baseline_score;
    const trackA = scales.trackA_raw(draft.trackA_raw);
    const composite = baseline * 0.55 + trackA * 0.45;

    const properties = {
      h3_r8: cell,
      district,
      poi_total: stats.poi_total,
      food_count: stats.food_count,
      shopping_count: stats.shopping_count,
      life_count: stats.life_count,
      health_count: stats.health_count,
      education_count: stats.education_count,
      transit_count: stats.transit_count,
      sport_count: stats.sport_count,
      green_count: stats.green_count,
      fresh_food_count: stats.fresh_food_count,
      bike_support_count: stats.bike_support_count,
      mean_aqi: Number.isFinite(meanAqi) ? round(meanAqi, 2) : null,
      air_quality_score: round(airQualityScore),
      baseline_score: round(baseline),
      trackA_score: round(trackA),
      composite_score: round(composite),
      sport_desert: round(Math.max(0, baseline - trackA)),
    };

    for (const [key, value] of Object.entries(modeScores)) {
      properties[key] = round(value);
    }

    features.push({
      type: 'Feature',
      properties,
      geometry: cellPolygon(cell),
    });
  }

  features.sort((a, b) => b.properties.composite_score - a.properties.composite_score);
  return {
    type: 'FeatureCollection',
    name: 'sh15_trackA_h3_r8_scored',
    metadata: {
      h3_resolution: h3Resolution,
      generated_at: new Date().toISOString(),
      scoring_method: 'H3 neighborhood proxy accessibility with empirical percentile scaling; true graph isochrones not yet substituted.',
      feature_count: features.length,
    },
    features,
  };
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

function writeOutputs(geojson) {
  const geojsonText = JSON.stringify(geojson);
  const outputGeojson = join(outputsDir, 'sh15_trackA_h3_r8_scored.geojson');
  const webGeojson = join(webDataDir, 'sh15_trackA_h3_r8_scored.geojson');
  writeFileSync(outputGeojson, geojsonText, 'utf-8');
  writeFileSync(webGeojson, geojsonText, 'utf-8');

  const topRows = geojson.features.slice(0, 10).map((feature, index) => ({
    rank: index + 1,
    ...feature.properties,
  }));
  writeCsv(join(outputsDir, 'sh15_trackA_top10_h3.csv'), topRows, [
    'rank',
    'h3_r8',
    'district',
    'composite_score',
    'baseline_score',
    'trackA_score',
    'mean_aqi',
    'sport_count',
    'green_count',
    'education_count',
    'transit_count',
  ]);

  writeCsv(join(outputsDir, 'data_provenance_trackA.csv'), provenance, [
    'dataset',
    'source',
    'rows_read',
    'rows_used',
    'notes',
  ]);

  writeCsv(join(outputsDir, 'sh15_trackA_data_dictionary.csv'), [
    { field: 'baseline_score', description: 'Walk-mode baseline accessibility proxy across six everyday need categories, scaled by empirical percentile.' },
    { field: 'trackA_score', description: 'Healthy lifestyle score from sport, green, cycling support, fresh food, and AQI, scaled by empirical percentile.' },
    { field: 'composite_score', description: '0.55 baseline_score + 0.45 trackA_score.' },
    { field: 'walk/bike/transit/car_baseline_score', description: 'Mode-specific H3 neighborhood proxy score, scaled by empirical percentile.' },
    { field: 'sport_desert', description: 'Positive gap where baseline access is stronger than Track A healthy-lifestyle access.' },
    { field: 'mean_aqi', description: '2025 official annual mean AQI for the dominant district.' },
  ], ['field', 'description']);

  console.log(`Wrote ${outputGeojson}`);
  console.log(`Wrote ${webGeojson}`);
}

if (!existsSync(shapeDir)) throw new Error(`Missing shapefile directory: ${shapeDir}`);
if (!existsSync(eduCsv)) throw new Error(`Missing education CSV: ${eduCsv}`);
if (!existsSync(aqiCsv)) throw new Error(`Missing AQI CSV: ${aqiCsv}`);

await loadShapefileDbfs();
await loadEducationPoi();
const aqiMeans = await loadAqi();
const geojson = scoreCells(aqiMeans);
writeOutputs(geojson);
console.log(`Generated ${geojson.features.length} H3 r${h3Resolution} features.`);
