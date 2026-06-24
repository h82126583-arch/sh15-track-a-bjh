const DATA_URL = './data/sh15_trackA_h3_r8_scored.geojson';

const state = {
  geojson: null,
  layer: 'composite_score',
  mode: 'walk',
  district: 'all',
  selectedLayer: null,
  highlightLayer: null,
  hoverLayer: null,
  selectedFeatureLayer: null,
  selectedFeature: null,
  selectedH3: null,
  currentTop: [],
  weights: {
    baseline: 3,
    sport: 5,
    green: 4,
    cycling: 2,
    air: 3,
  },
};

const map = L.map('map', {
  zoomControl: false,
}).setView([31.2304, 121.4737], 9);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function pct(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'n/a';
  if (digits <= 0) return `${Math.round(number * 100)}%`;
  const factor = 10 ** digits;
  return `${Math.floor(number * 100 * factor) / factor}%`;
}

function num(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : 'n/a';
}

function metroProxyText(props) {
  const transit = Number(props.transit_count || 0);
  if (transit > 0) return `${transit} transit POI proxy`;
  return 'No transit POI proxy';
}

function rentBandText() {
  return 'Not collected';
}

function topAmenityText(props) {
  const items = [
    ['Sport', Number(props.sport_count || 0)],
    ['Green', Number(props.green_count || 0)],
    ['Fresh food', Number(props.fresh_food_count || 0)],
    ['Transit', Number(props.transit_count || 0)],
    ['Education', Number(props.education_count || 0)],
  ].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return items.map(([label, value]) => `${label}: ${value}`).join('; ');
}

function csvValue(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  const lines = [columns.join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((column) => csvValue(row[column])).join(','));
  });
  return `\uFEFF${lines.join('\n')}\n`;
}

function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function setExportStatus(text) {
  const status = document.getElementById('exportStatus');
  if (status) status.textContent = text;
}

function districtMatches(props) {
  return state.district === 'all' || props.district === state.district;
}

function filteredFeatures() {
  return (state.geojson?.features || []).filter((feature) => districtMatches(feature.properties || {}));
}

function populateDistrictFilter() {
  const select = document.getElementById('districtFilter');
  const districts = [...new Set((state.geojson?.features || [])
    .map((feature) => feature.properties?.district)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  select.innerHTML = '<option value="all">All Shanghai</option>';
  districts.forEach((district) => {
    const option = document.createElement('option');
    option.value = district;
    option.textContent = district;
    select.appendChild(option);
  });
  select.value = state.district;
}

function scoreColor(value) {
  const v = clamp(Number(value || 0));
  if (v < 0.2) return '#a83232';
  if (v < 0.4) return '#d66d3f';
  if (v < 0.6) return '#e3bb45';
  if (v < 0.8) return '#7ba956';
  return '#23845c';
}

function modeBaseline(props) {
  return Number(props[`${state.mode}_baseline_score`] ?? props.baseline_score ?? 0);
}

function activeScore(props) {
  if (state.layer === 'baseline_score') return modeBaseline(props);
  if (state.layer === 'composite_score') return modeBaseline(props) * 0.55 + Number(props.trackA_score || 0) * 0.45;
  if (state.layer === 'green_count') return clamp(Math.log1p(Number(props.green_count || 0)) / Math.log(20));
  return Number(props[state.layer] || 0);
}

function weightedScore(props) {
  const total = Object.values(state.weights).reduce((sum, value) => sum + Number(value), 0) || 1;
  return (
    modeBaseline(props) * state.weights.baseline +
    Number(props.trackA_score || 0) * state.weights.sport +
    clamp(Math.log1p(Number(props.green_count || 0)) / Math.log(20)) * state.weights.green +
    clamp(Math.log1p(Number(props.bike_support_count || 0)) / Math.log(6)) * state.weights.cycling +
    Number(props.air_quality_score || 0) * state.weights.air
  ) / total;
}

function layerLabel() {
  const layerNames = {
    composite_score: 'Composite',
    baseline_score: 'Baseline',
    trackA_score: 'Track A',
    green_count: 'Green',
    air_quality_score: 'Air',
  };
  const modeNames = { walk: 'Walk', bike: 'Bike', transit: 'Transit', car: 'Car' };
  const name = layerNames[state.layer] || 'Layer';
  if (state.layer === 'trackA_score' || state.layer === 'green_count' || state.layer === 'air_quality_score') return name;
  return `${name} - ${modeNames[state.mode]}`;
}

function styleFeature(feature) {
  const props = feature.properties || {};
  const value = activeScore(props);
  const muted = !districtMatches(props);
  return {
    color: '#26343b',
    weight: 0.35,
    opacity: muted ? 0.12 : 0.38,
    fillColor: scoreColor(value),
    fillOpacity: muted ? 0.16 : 0.68,
  };
}

function renderLayer() {
  if (!state.geojson) return;
  if (state.selectedLayer) state.selectedLayer.remove();
  if (state.hoverLayer) state.hoverLayer.remove();
  state.hoverLayer = null;
  state.selectedLayer = L.geoJSON(state.geojson, {
    style: styleFeature,
    onEachFeature(feature, layer) {
      const props = feature.properties || {};
      layer.bindTooltip(`${props.h3_r8}<br>${pct(activeScore(props), 1)}`, { sticky: true });
      layer.on('mouseover', () => renderHoverFeature(feature));
      layer.on('mouseout', () => clearHoverFeature());
      layer.on('click', () => selectFeature(feature));
    },
  }).addTo(map);
  updateSummary();
  updateTopList();
  if (state.selectedFeature) renderSelectedFeature(state.selectedFeature);
}

function updateSummary() {
  const features = filteredFeatures();
  const average = features.length
    ? features.reduce((sum, feature) => sum + activeScore(feature.properties || {}), 0) / features.length
    : 0;
  document.getElementById('hexCount').textContent = features.length || 'n/a';
  document.getElementById('avgScore').textContent = pct(average, 1);
  document.getElementById('activeLayerTitle').textContent = layerLabel();
  document.getElementById('legendMetric').textContent = layerLabel();
}

function updateTopList() {
  const features = filteredFeatures()
    .map((feature) => ({ feature, score: weightedScore(feature.properties || {}) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  state.currentTop = features;
  const list = document.getElementById('topList');
  list.innerHTML = '';
  features.forEach(({ feature, score }, index) => {
    const props = feature.properties || {};
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.classList.toggle('selected', props.h3_r8 === state.selectedH3);
    button.innerHTML = `<span>${index + 1}</span><strong>${pct(score, 1)}</strong><em>${props.district || props.h3_r8}</em>`;
    button.addEventListener('click', () => {
      selectFeature(feature);
      const bounds = L.geoJSON(feature).getBounds();
      map.fitBounds(bounds, { maxZoom: 12, padding: [60, 60] });
    });
    li.appendChild(button);
    list.appendChild(li);
  });
  if (!features.length) {
    const li = document.createElement('li');
    li.className = 'empty-top-list';
    li.textContent = 'No H3 cells match this district.';
    list.appendChild(li);
  }
  renderHighlights(features.map((item) => item.feature));
}

function renderHighlights(features) {
  if (state.highlightLayer) state.highlightLayer.remove();
  state.highlightLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style: {
      color: '#0f1720',
      weight: 2,
      opacity: 0.95,
      fillOpacity: 0,
    },
    interactive: false,
  }).addTo(map);
}

function clearHoverFeature() {
  if (state.hoverLayer) state.hoverLayer.remove();
  state.hoverLayer = null;
}

function renderHoverFeature(feature) {
  clearHoverFeature();
  state.hoverLayer = L.geoJSON(feature, {
    style: {
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillColor: '#ffffff',
      fillOpacity: 0.12,
    },
    interactive: false,
  }).addTo(map);
  state.hoverLayer.bringToFront();
}

function renderSelectedFeature(feature) {
  if (state.selectedFeatureLayer) state.selectedFeatureLayer.remove();
  state.selectedFeatureLayer = L.geoJSON(feature, {
    style: {
      color: '#06111a',
      weight: 4,
      opacity: 1,
      fillColor: '#ffffff',
      fillOpacity: 0.08,
    },
    interactive: false,
  }).addTo(map);
  state.selectedFeatureLayer.bringToFront();
}

function stat(label, value) {
  return `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function scoreLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Not enough data';
  if (number >= 0.85) return 'High fit';
  if (number >= 0.65) return 'Strong candidate';
  if (number >= 0.45) return 'Balanced option';
  return 'Needs review';
}

function mainStrength(props) {
  const candidates = [
    { label: 'Everyday access', score: modeBaseline(props), text: `${pct(modeBaseline(props), 1)} baseline access in ${props.district || 'this area'}.` },
    { label: 'Healthy lifestyle', score: Number(props.trackA_score || 0), text: `${pct(props.trackA_score, 1)} Track A score with ${props.sport_count || 0} sport POI and ${props.green_count || 0} green POI.` },
    { label: 'Air quality', score: Number(props.air_quality_score || 0), text: `${pct(props.air_quality_score, 1)} air-quality score from 2025 district AQI.` },
  ];
  return candidates.sort((a, b) => b.score - a.score)[0];
}

function watchPoint(props) {
  if (Number(props.sport_desert || 0) > 0.2) {
    return {
      label: 'Sport gap',
      text: 'Everyday access is stronger than healthy-lifestyle access; review sport and green supply nearby.',
    };
  }
  if (Number(props.air_quality_score || 0) < 0.45) {
    return {
      label: 'Air quality',
      text: 'District-level AQI is weaker than most candidate cells, so outdoor activity suitability needs caution.',
    };
  }
  if (Number(props.education_count || 0) === 0) {
    return {
      label: 'Education access',
      text: 'No education POI is present inside this H3 cell; check adjacent cells before using it for family-oriented choices.',
    };
  }
  return {
    label: 'No major gap',
    text: 'The current proxy does not flag a single dominant weakness for this H3 cell.',
  };
}

function decisionCue(props) {
  const baseline = modeBaseline(props);
  const trackA = Number(props.trackA_score || 0);
  const composite = Number(props.composite_score || 0);
  if (composite >= 0.85 && baseline >= 0.8 && trackA >= 0.8) {
    return {
      label: 'Priority candidate',
      text: 'Use this cell as a shortlist anchor: both everyday needs and healthy-lifestyle access are strong.',
    };
  }
  if (baseline >= 0.75 && trackA < 0.6) {
    return {
      label: 'Convenience first',
      text: 'Good for daily services, but the health and sport layer should be checked before final recommendation.',
    };
  }
  if (trackA >= 0.75 && baseline < 0.6) {
    return {
      label: 'Lifestyle niche',
      text: 'Healthy-lifestyle signals are strong, but broader 15-minute service coverage is not yet balanced.',
    };
  }
  return {
    label: 'Context check',
    text: 'Use this cell with surrounding H3 context rather than as a standalone recommendation.',
  };
}

function insightCard(label, title, text) {
  return `<article class="insight-card"><span>${label}</span><strong>${title}</strong><p>${text}</p></article>`;
}

function topRows() {
  return state.currentTop.map(({ feature, score }, index) => {
    const props = feature.properties || {};
    return {
      rank: index + 1,
      h3_r8: props.h3_r8,
      district: props.district,
      weighted_score: Number(score || 0).toFixed(4),
      composite_score: Number(props.composite_score || 0).toFixed(4),
      baseline_score: Number(modeBaseline(props) || 0).toFixed(4),
      trackA_score: Number(props.trackA_score || 0).toFixed(4),
      mean_aqi: props.mean_aqi ?? '',
      sport_count: props.sport_count ?? 0,
      green_count: props.green_count ?? 0,
      education_count: props.education_count ?? 0,
      transit_count: props.transit_count ?? 0,
    };
  });
}

function exportTop10() {
  const rows = topRows();
  if (!rows.length) {
    setExportStatus('Top10 is not ready yet.');
    return;
  }
  const columns = [
    'rank',
    'h3_r8',
    'district',
    'weighted_score',
    'composite_score',
    'baseline_score',
    'trackA_score',
    'mean_aqi',
    'sport_count',
    'green_count',
    'education_count',
    'transit_count',
  ];
  downloadText('sh15_current_top10.csv', toCsv(rows, columns), 'text/csv;charset=utf-8');
  setExportStatus('Top10 CSV exported.');
}

function exportWeights() {
  const payload = {
    generated_at: new Date().toISOString(),
    mode: state.mode,
    layer: state.layer,
    layer_label: layerLabel(),
    district_filter: state.district,
    weights: { ...state.weights },
    top10_count: state.currentTop.length,
  };
  downloadText('sh15_current_weights.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  setExportStatus('Weight settings exported.');
}

function exportSelectedH3() {
  if (!state.selectedFeature) {
    setExportStatus('Select an H3 cell before exporting.');
    return;
  }
  const props = state.selectedFeature.properties || {};
  const payload = {
    generated_at: new Date().toISOString(),
    h3_r8: props.h3_r8,
    district: props.district,
    district_filter: state.district,
    mode: state.mode,
    layer: state.layer,
    layer_label: layerLabel(),
    active_score: activeScore(props),
    weighted_score: weightedScore(props),
    fit_profile: scoreLabel(props.composite_score),
    recommendation: decisionCue(props),
    strength: mainStrength(props),
    watch_point: watchPoint(props),
    properties: props,
    geometry: state.selectedFeature.geometry,
  };
  downloadText(`sh15_selected_${props.h3_r8 || 'h3'}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  setExportStatus('Selected H3 exported.');
}

function selectedReportMarkdown() {
  if (!state.selectedFeature) return '';
  const props = state.selectedFeature.properties || {};
  const decision = decisionCue(props);
  const strength = mainStrength(props);
  const watch = watchPoint(props);
  return [
    `# Selected H3 Report: ${props.h3_r8 || 'n/a'}`,
    '',
    `- District: ${props.district || 'n/a'}`,
    `- Current filter: ${state.district === 'all' ? 'All Shanghai' : state.district}`,
    `- Mode: ${state.mode}`,
    `- Active layer: ${layerLabel()}`,
    `- Composite score: ${pct(props.composite_score, 1)}`,
    `- Weighted recommendation score: ${pct(weightedScore(props), 1)}`,
    '',
    '## Recommendation',
    '',
    `**${decision.label}.** ${decision.text}`,
    '',
    '## Strength',
    '',
    `**${strength.label}.** ${strength.text}`,
    '',
    '## Watch Point',
    '',
    `**${watch.label}.** ${watch.text}`,
    '',
    '## Key Metrics',
    '',
    `| Metric | Value |`,
    `| --- | --- |`,
    `| AQI mean | ${num(props.mean_aqi, 1)} |`,
    `| Baseline score | ${pct(modeBaseline(props), 1)} |`,
    `| Track A score | ${pct(props.trackA_score, 1)} |`,
    `| Sport POI | ${props.sport_count ?? 0} |`,
    `| Green POI | ${props.green_count ?? 0} |`,
    `| Education POI | ${props.education_count ?? 0} |`,
    `| Transit POI | ${props.transit_count ?? 0} |`,
    `| Metro distance | ${metroProxyText(props)}; true station distance not measured |`,
    `| Rent band | ${rentBandText()} in provided Track A data |`,
    `| Fresh food POI | ${props.fresh_food_count ?? 0} |`,
    `| Bike-support proxy POI | ${props.bike_support_count ?? 0} |`,
    '',
    '## Method Note',
    '',
    'This report uses the current H3 neighborhood proxy scoring layer. True graph-based 15-minute isochrones should replace the proxy layer after the graph-tool / road-network environment is prepared.',
    '',
  ].join('\n');
}

function exportSelectedReport() {
  if (!state.selectedFeature) {
    setExportStatus('Select an H3 cell before exporting a report.');
    return;
  }
  const props = state.selectedFeature.properties || {};
  downloadText(`sh15_report_${props.h3_r8 || 'selected'}.md`, selectedReportMarkdown(), 'text/markdown;charset=utf-8');
  setExportStatus('Selected H3 report exported.');
}

function selectFeature(feature) {
  const props = feature.properties || {};
  const decision = decisionCue(props);
  const strength = mainStrength(props);
  const watch = watchPoint(props);
  state.selectedFeature = feature;
  state.selectedH3 = props.h3_r8 || null;
  document.getElementById('exportSelected').disabled = false;
  document.getElementById('exportReport').disabled = false;
  updateTopList();
  renderSelectedFeature(feature);
  document.getElementById('detailTitle').textContent = props.h3_r8 || 'Selected hex';
  document.getElementById('detailBody').innerHTML = `
    <div class="decision-summary">
      <div class="score-ring" style="--score:${Number(props.composite_score || 0)}">
        <strong>${pct(props.composite_score, 1)}</strong>
        <span>Composite</span>
      </div>
      <div class="summary-copy">
        <span class="eyebrow">Fit Profile</span>
        <h3>${scoreLabel(props.composite_score)}</h3>
        <p>${props.district || 'This cell'} combines ${pct(modeBaseline(props), 1)} everyday access with ${pct(props.trackA_score, 1)} healthy-lifestyle access.</p>
      </div>
    </div>
    <div class="metric-grid">
      ${stat('District', props.district || 'n/a')}
      ${stat('AQI', num(props.mean_aqi, 1))}
      ${stat('Baseline', pct(modeBaseline(props), 1))}
      ${stat('Track A', pct(props.trackA_score, 1))}
      ${stat('Sport POI', props.sport_count ?? 0)}
      ${stat('Green POI', props.green_count ?? 0)}
      ${stat('Education', props.education_count ?? 0)}
      ${stat('Transit', props.transit_count ?? 0)}
      ${stat('Metro proxy', metroProxyText(props))}
      ${stat('Rent band', rentBandText())}
    </div>
    <div class="insight-grid">
      ${insightCard('Recommendation', decision.label, decision.text)}
      ${insightCard('Strength', strength.label, strength.text)}
      ${insightCard('Watch Point', watch.label, watch.text)}
    </div>
    <div class="amenities">
      <h3>Top Amenities & Evidence</h3>
      <p>${topAmenityText(props)}. Bike-support proxy: ${props.bike_support_count || 0}. Air-quality score: ${pct(props.air_quality_score, 1)}.</p>
      <p class="muted">Metro distance is shown as a transit POI proxy because no verified metro-station distance layer is present. Rent band is not collected in the provided Track A data.</p>
    </div>
  `;
}

function bindControls() {
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      state.mode = button.dataset.mode;
      renderLayer();
    });
  });

  document.querySelectorAll('[data-layer]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-layer]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      state.layer = button.dataset.layer;
      renderLayer();
    });
  });

  document.querySelectorAll('[data-weight]').forEach((input) => {
    input.addEventListener('input', () => {
      state.weights[input.dataset.weight] = Number(input.value);
      input.nextElementSibling.textContent = input.value;
      updateTopList();
    });
  });

  document.getElementById('districtFilter').addEventListener('change', (event) => {
    state.district = event.target.value;
    updateSummary();
    updateTopList();
    if (state.selectedLayer) state.selectedLayer.setStyle(styleFeature);
    if (state.selectedFeature && !districtMatches(state.selectedFeature.properties || {})) {
      state.selectedFeature = null;
      state.selectedH3 = null;
      if (state.selectedFeatureLayer) state.selectedFeatureLayer.remove();
      state.selectedFeatureLayer = null;
      document.getElementById('exportSelected').disabled = true;
      document.getElementById('exportReport').disabled = true;
      document.getElementById('detailTitle').textContent = 'No hex selected';
      document.getElementById('detailBody').innerHTML = '<p class="muted">Select a matching district result or click a visible hexagon to inspect it.</p>';
    }
  });

  const recommender = document.getElementById('recommender');
  const toggleRecommender = document.getElementById('toggleRecommender');
  toggleRecommender.addEventListener('click', () => {
    const collapsed = recommender.classList.toggle('collapsed');
    toggleRecommender.textContent = collapsed ? '+' : '-';
    toggleRecommender.title = collapsed ? 'Expand recommender' : 'Collapse recommender';
    toggleRecommender.setAttribute('aria-expanded', String(!collapsed));
  });

  document.getElementById('exportTop10').addEventListener('click', exportTop10);
  document.getElementById('exportWeights').addEventListener('click', exportWeights);
  document.getElementById('exportSelected').addEventListener('click', exportSelectedH3);
  document.getElementById('exportReport').addEventListener('click', exportSelectedReport);

  document.getElementById('closeDetail').addEventListener('click', () => {
    state.selectedFeature = null;
    state.selectedH3 = null;
    if (state.selectedFeatureLayer) state.selectedFeatureLayer.remove();
    state.selectedFeatureLayer = null;
    document.getElementById('exportSelected').disabled = true;
    document.getElementById('exportReport').disabled = true;
    updateTopList();
    document.getElementById('detailTitle').textContent = 'No hex selected';
    document.getElementById('detailBody').innerHTML = '<p class="muted">Click a hexagon to inspect access, healthy-lifestyle signals, district, and AQI.</p>';
  });

  document.getElementById('infoButton').addEventListener('click', () => {
    document.getElementById('transparency').classList.add('open');
  });
  document.getElementById('closeInfo').addEventListener('click', () => {
    document.getElementById('transparency').classList.remove('open');
  });
}

async function boot() {
  bindControls();
  const pill = document.getElementById('dataPill');
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    state.geojson = await response.json();
    populateDistrictFilter();
    pill.textContent = 'Live H3 Data';
    pill.classList.add('ready');
    renderLayer();
    if (state.geojson.features?.length) {
      map.fitBounds(state.selectedLayer.getBounds(), { padding: [20, 20] });
    }
  } catch (error) {
    pill.textContent = 'Data Missing';
    pill.classList.add('error');
    document.getElementById('detailBody').innerHTML = `<p class="muted">Run <code>npm run build:data</code> first. ${error.message}</p>`;
  }
}

boot();
