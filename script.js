/**
 * script.js — updated to support area, stackedBar, horizontalBar charts and a Chart Info modal for placeholders
 *
 * Keep the rest of your original functionality (upload, SheetJS parsing, Leaflet map, filters).
 */

/* =========================
   Globals & Helpers
   ========================= */
let workbook = null;
let currentSheetName = null;
let currentData = []; // array of row objects
let originalData = []; // copy as loaded
let detectedMeta = { headers: [], numeric: [], categorical: [] };
let mainChart = null;
let mapInstance = null;
let mapMarkersLayer = null;
let lastChartType = 'auto';

// DOM elements
const openUploadBtn = document.getElementById('openUploadBtn');
const uploadModal = new bootstrap.Modal(document.getElementById('uploadModal'));
const chartInfoModalEl = document.getElementById('chartInfoModal');
const chartInfoModal = new bootstrap.Modal(chartInfoModalEl);
const chartInfoBody = document.getElementById('chartInfoBody');
const chartInfoDocs = document.getElementById('chartInfoDocs');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const loadFileBtn = document.getElementById('loadFileBtn');
const sheetSelect = document.getElementById('sheetSelect');
const sheetList = document.getElementById('sheetList');
const sheetPreview = document.getElementById('sheetPreview');
const uploadErrors = document.getElementById('uploadErrors');
const chartTypeSelect = document.getElementById('chartTypeSelect');
const refreshChartsBtn = document.getElementById('refreshCharts');
const topNInput = document.getElementById('topN');
const previewTableWrapper = document.getElementById('previewTableWrapper');
const previewTableContainer = document.getElementById('previewTableContainer');
const mainChartCanvas = document.getElementById('mainChart');
const downloadChartBtn = document.getElementById('downloadChartBtn');
const tableSearch = document.getElementById('tableSearch');
const dataTableContainer = document.getElementById('dataTableContainer');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const downloadDataBtn = document.getElementById('downloadDataBtn');
const printDashboardBtn = document.getElementById('printDashboardBtn');
const mapStatus = document.getElementById('mapStatus');
const mapEl = document.getElementById('map');
const filterControls = document.getElementById('filterControls');

// init
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  wireUi();
  tryReloadFromLocal();
});

/* =========================
   UI wiring
   ========================= */
function wireUi() {
  openUploadBtn.addEventListener('click', () => {
    uploadErrors.style.display = 'none';
    fileInput.value = '';
    sheetSelect.innerHTML = '';
    sheetPreview.style.display = 'none';
    loadFileBtn.disabled = true;
    uploadModal.show();
  });

  chooseFileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileChosen);

  ;['dragenter','dragover'].forEach(ev => {
    dropZone.addEventListener(ev, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });
  ;['dragleave','drop'].forEach(ev => {
    dropZone.addEventListener(ev, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', e => {
    const files = (e.dataTransfer && e.dataTransfer.files) || [];
    if (files.length) {
      fileInput.files = files;
      handleFileChosen();
    }
  });

  loadFileBtn.addEventListener('click', () => {
    if (!workbook) return showUploadError('No file loaded.');
    populateSheetSelect();
    uploadModal.hide();
    const firstSheet = sheetSelect.querySelector('option')?.value;
    if (firstSheet) {
      sheetSelect.value = firstSheet;
      loadSheetToVisualizer(firstSheet);
    }
  });

  sheetSelect.addEventListener('change', () => {
    const s = sheetSelect.value;
    if (s) loadSheetToVisualizer(s);
  });

  refreshChartsBtn.addEventListener('click', () => {
    if (!currentData.length) return alert('No data loaded');
    renderCurrentChart();
  });

  chartTypeSelect.addEventListener('change', () => renderCurrentChart());
  topNInput.addEventListener('change', () => renderCurrentChart());

  downloadChartBtn.addEventListener('click', () => {
    if (!mainChart) return;
    const link = document.createElement('a');
    link.download = `chart-${(new Date()).toISOString()}.png`;
    link.href = mainChart.toBase64Image();
    link.click();
  });

  tableSearch.addEventListener('input', () => renderDataTable());
  exportCsvBtn.addEventListener('click', () => exportProcessedData());
  downloadDataBtn.addEventListener('click', () => exportProcessedData());

  printDashboardBtn.addEventListener('click', () => window.print());
}

/* =========================
   File handling
   ========================= */
function handleFileChosen() {
  uploadErrors.style.display = 'none';
  const f = fileInput.files[0];
  if (!f) return;
  const name = f.name.toLowerCase();
  if (!(/\.(xlsx|xls|csv)$/i.test(name))) {
    return showUploadError('Only .xlsx, .xls, and .csv files are supported.');
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = ev.target.result;
    try {
      if (name.endsWith('.csv')) {
        const text = data instanceof ArrayBuffer ? new TextDecoder().decode(data) : data;
        const parsed = Papa.parse(text, { header: true, dynamicTyping: true });
        const headers = Object.keys(parsed.data[0] || {});
        const aoa = [headers].concat(parsed.data.map(r => headers.map(h => r[h])));
        workbook = { Sheets: { Sheet1: XLSX.utils.aoa_to_sheet(aoa) }, SheetNames: ['Sheet1'] };
      } else {
        const arr = new Uint8Array(data);
        workbook = XLSX.read(arr, { type: 'array' });
      }

      sheetPreview.style.display = 'block';
      sheetList.innerHTML = '';
      workbook.SheetNames.forEach((s,i) => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.textContent = s;
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary rounded-pill';
        badge.textContent = 'Sheet ' + (i+1);
        item.appendChild(badge);
        sheetList.appendChild(item);
      });
      loadFileBtn.disabled = false;
      populateSheetSelect();
      showUploadMessage('File loaded. Choose sheet to view.');
    } catch (err) {
      console.error(err);
      showUploadError('Failed to parse file. Make sure file is valid and not corrupted.');
    }
  };

  if (name.endsWith('.csv')) reader.readAsText(f); else reader.readAsArrayBuffer(f);
}

function showUploadError(msg) {
  uploadErrors.style.display = 'block';
  uploadErrors.classList.remove('text-success');
  uploadErrors.classList.add('text-danger');
  uploadErrors.textContent = msg;
}

function showUploadMessage(msg) {
  uploadErrors.style.display = 'block';
  uploadErrors.classList.remove('text-danger');
  uploadErrors.classList.add('text-success');
  uploadErrors.textContent = msg;
  setTimeout(() => {
    uploadErrors.style.display = 'none';
    uploadErrors.classList.remove('text-success');
    uploadErrors.classList.add('text-danger');
  }, 2500);
}

function populateSheetSelect() {
  if (!workbook) return;
  sheetSelect.innerHTML = '';
  workbook.SheetNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sheetSelect.appendChild(opt);
  });
  sheetSelect.disabled = false;
}

/* =========================
   Load sheet into visualizer
   ========================= */
function loadSheetToVisualizer(sheetName) {
  if (!workbook || !workbook.Sheets[sheetName]) return;
  currentSheetName = sheetName;
  try {
    const ws = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (!json || !json.length) {
      alert('Sheet is empty or no rows found.');
      return;
    }
    originalData = json.map(r => ({...r}));
    currentData = originalData.slice();
    detectColumns(currentData);
    renderDataTable();
    renderFilters();
    renderCurrentChart();
    attemptMapPlot(currentData);
    exportCsvBtn.disabled = false;
    downloadDataBtn.disabled = false;
    try {
      const mini = { sheet: sheetName, preview: currentData.slice(0,200) };
      localStorage.setItem('lastDatasetPreview', JSON.stringify(mini));
    } catch(e){ }
  } catch (err) {
    console.error(err);
    alert('Failed to load sheet to visualizer: ' + err.message);
  }
}

/* =========================
   Column detection & meta
   ========================= */
function detectColumns(data) {
  const headers = Object.keys(data[0] || {});
  const numeric = [];
  const categorical = [];

  headers.forEach(h => {
    let numericCount = 0, totalCount = 0;
    for (let i=0;i<data.length && i<200;i++){
      const v = data[i][h];
      if (v === null || v === undefined || v === '') { totalCount++; continue; }
      totalCount++;
      if (typeof v === 'number' && !isNaN(v)) numericCount++;
      else if ( !isNaN(parseFloat(v)) && isFinite(v) ) numericCount++;
    }
    if (totalCount>0 && numericCount/totalCount > 0.6) numeric.push(h);
    else categorical.push(h);
  });

  detectedMeta.headers = headers;
  detectedMeta.numeric = numeric;
  detectedMeta.categorical = categorical;
}

/* =========================
   Rendering charts
   ========================= */
function renderCurrentChart() {
  if (!currentData.length) return;
  const selected = chartTypeSelect.value;
  const chartType = selected === 'auto' ? autoSuggestChart() : selected;
  // if placeholder (unsupported) -> show info modal
  const placeholders = ['histogram','boxplot','violin','heatmap','treemap','sankey','sunburst','funnel','gauge','candlestick','choropleth'];
  if (placeholders.includes(chartType)) {
    showChartInfo(chartType);
    // fallback to table preview so UI doesn't break
    chartTypeSelect.value = chartType; // keep selected
    previewTableWrapper.style.display = 'block';
    renderPreviewTable();
    if (mainChart) { try { mainChart.destroy(); } catch(e){} mainChart = null; downloadChartBtn.disabled = true; }
    return;
  }

  lastChartType = chartType;
  previewTableWrapper.style.display = chartType === 'table' ? 'block' : 'none';
  if (chartType === 'table') {
    renderPreviewTable();
    if (mainChart) { mainChart.destroy(); mainChart = null; downloadChartBtn.disabled = true; }
    return;
  }
  const ctx = mainChartCanvas.getContext('2d');

  // choose fields automatically
  const { xField, yField, categoryField } = chooseFieldsForChart(chartType);

  let chartConfig = null;
  try {
    if (chartType === 'pie') chartConfig = generatePieConfig(categoryField);
    else if (chartType === 'doughnut') chartConfig = generatePieConfig(categoryField, true);
    else if (chartType === 'bar') chartConfig = generateBarConfig(xField, yField);
    else if (chartType === 'horizontalBar') chartConfig = generateHorizontalBarConfig(xField, yField);
    else if (chartType === 'stackedBar') chartConfig = generateStackedBarConfig(xField, yField);
    else if (chartType === 'line') chartConfig = generateLineConfig(xField, yField);
    else if (chartType === 'area') chartConfig = generateAreaConfig(xField, yField);
    else if (chartType === 'bubble') chartConfig = generateBubbleConfig();
    else if (chartType === 'scatter') chartConfig = generateScatterConfig();
    else if (chartType === 'radar') chartConfig = generateRadarConfig();
    else if (chartType === 'polarArea') chartConfig = generatePolarAreaConfig(categoryField);
    else throw new Error('Unsupported chart type: ' + chartType);
  } catch (err) {
    console.error(err);
    alert('Failed to generate chart: ' + err.message);
    return;
  }

  if (mainChart) { try { mainChart.destroy(); } catch(e){} }
  mainChart = new Chart(ctx, chartConfig);
  downloadChartBtn.disabled = false;
}

/* heuristics: choose fields */
function chooseFieldsForChart(type) {
  const numeric = detectedMeta.numeric;
  const cat = detectedMeta.categorical;
  let xField = null, yField = null, categoryField = null;

  if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
    categoryField = cat[0] || detectedMeta.headers[0];
  } else if (type === 'bar' || type === 'stackedBar' || type === 'horizontalBar') {
    categoryField = cat[0] || detectedMeta.headers[0];
    yField = numeric[0] || detectedMeta.headers[1] || categoryField;
    xField = categoryField;
  } else if (type === 'line' || type === 'area') {
    const dateLike = detectedMeta.headers.find(h => /date|time|month|year/i.test(h));
    xField = dateLike || detectedMeta.headers[0];
    yField = numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
  } else if (type === 'bubble') {
    xField = numeric[0] || detectedMeta.headers[0];
    yField = numeric[1] || numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
    categoryField = detectedMeta.headers.find(h => ![xField,yField].includes(h)) || detectedMeta.headers[0];
  } else if (type === 'scatter') {
    xField = numeric[0] || detectedMeta.headers[0];
    yField = numeric[1] || numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
  } else {
    xField = detectedMeta.headers[0];
    yField = detectedMeta.numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
  }

  return { xField, yField, categoryField };
}

/* Auto-suggest chart type */
function autoSuggestChart() {
  if (detectedMeta.categorical.length >= 1 && detectedMeta.numeric.length >= 1) return 'bar';
  if (detectedMeta.numeric.length >= 2) return 'bubble';
  if (detectedMeta.categorical.length >= 1 && detectedMeta.numeric.length === 0) return 'pie';
  return 'table';
}

/* ===== Chart generators ===== */

function generatePieConfig(categoryField, doughnut=false) {
  const topN = Number(topNInput.value) || 10;
  const counts = {};
  currentData.forEach(r => {
    const k = (r[categoryField] ?? 'Unknown') + '';
    counts[k] = (counts[k] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, topN);
  const labels = entries.map(e=>e[0]);
  const values = entries.map(e=>e[1]);
  return {
    type: doughnut ? 'doughnut' : 'pie',
    data: { labels, datasets: [{ data: values, label: categoryField }] },
    options: {
      responsive: true,
      plugins: {
        title: { display:true, text: `Distribution by ${categoryField}` },
        legend: { position:'right' }
      }
    }
  };
}

function generateBarConfig(xField, yField) {
  const topN = Number(topNInput.value) || 10;
  const agg = {};
  currentData.forEach(r => {
    const cat = (r[xField] ?? 'Unknown') + '';
    const val = parseFloat(r[yField]) || 0;
    agg[cat] = (agg[cat] || 0) + val;
  });
  const entries = Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,topN);
  const labels = entries.map(e=>e[0]);
  const values = entries.map(e=>e[1]);
  return {
    type: 'bar',
    data: { labels, datasets: [{ label: yField, data: values }] },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: `${yField} by ${xField}` }, legend: { display:false } },
      scales: { x: { ticks:{ autoSkip: false } }, y: { beginAtZero:true } }
    }
  };
}

function generateHorizontalBarConfig(xField, yField) {
  // reuse bar but set indexAxis to 'y'
  const cfg = generateBarConfig(xField, yField);
  cfg.type = 'bar';
  cfg.options = cfg.options || {};
  cfg.options.indexAxis = 'y';
  return cfg;
}

function generateStackedBarConfig(xField, yField) {
  // produce topN categories for xField and stack by a second categorical (if exists)
  // If there's no second categorical, fallback to single-series stacked (same as bar)
  const topN = Number(topNInput.value) || 10;
  const secondCat = detectedMeta.categorical[1] || null;
  const xCats = Array.from(new Set(currentData.map(r => (r[xField]??'Unknown')+''))).slice(0, topN);
  if (!secondCat) {
    return generateBarConfig(xField, yField);
  }
  const seriesMap = {}; // secondCatValue -> array matching xCats
  xCats.forEach(xv => {
    // init for all secondCat vals
  });
  const secondValues = Array.from(new Set(currentData.map(r => (r[secondCat]??'')+''))).slice(0, 20);
  secondValues.forEach(sv => { seriesMap[sv] = xCats.map(_=>0); });

  currentData.forEach(r => {
    const xv = (r[xField]??'Unknown')+'';
    const sv = (r[secondCat]??'')+'';
    const val = parseFloat(r[yField]) || 0;
    const xi = xCats.indexOf(xv);
    if (xi >= 0 && seriesMap[sv]) seriesMap[sv][xi] += val;
  });

  const datasets = Object.entries(seriesMap).map(([k,v]) => ({ label: k, data: v }));
  return {
    type: 'bar',
    data: { labels: xCats, datasets },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: `${yField} by ${xField} (stacked by ${secondCat})` } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero:true } }
    }
  };
}

function generateLineConfig(xField, yField) {
  const rows = currentData.slice();
  rows.sort((a,b)=>{
    const va = a[xField], vb = b[xField];
    const na = Date.parse(va) || parseFloat(va) || 0;
    const nb = Date.parse(vb) || parseFloat(vb) || 0;
    return na - nb;
  });
  const labels = rows.map(r => (r[xField] ?? '') + '').slice(0,1000);
  const values = rows.map(r => parseFloat(r[yField]) || 0).slice(0,1000);
  return {
    type: 'line',
    data: { labels, datasets: [{ label: yField, data: values, fill:false, tension:0.2 }] },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: `${yField} over ${xField}` }, legend: { display:false } },
      scales: { y: { beginAtZero: true } }
    }
  };
}

function generateAreaConfig(xField, yField) {
  const cfg = generateLineConfig(xField, yField);
  // set fill true for area effect
  cfg.data.datasets[0].fill = true;
  cfg.data.datasets[0].backgroundColor = undefined; // let Chart.js default gradient
  cfg.data.datasets[0].borderWidth = 2;
  cfg.options.plugins.title.text = `${yField} (Area) over ${xField}`;
  return cfg;
}

function generateBubbleConfig() {
  const numeric = detectedMeta.numeric;
  const xField = numeric[0] || detectedMeta.headers[0];
  const yField = numeric[1] || numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
  const rField = numeric[2] || numeric[0] || detectedMeta.headers[2] || detectedMeta.headers[0];

  const points = currentData.map(r => {
    const x = parseFloat(r[xField]) || 0;
    const y = parseFloat(r[yField]) || 0;
    const rsize = Math.max(2, Math.min(40, Math.abs(parseFloat(r[rField]) || 1)));
    return { x, y, r: rsize };
  }).slice(0,500);

  return {
    type: 'bubble',
    data: { datasets: [{ label: `${yField} vs ${xField} (size=${rField})`, data: points }] },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: 'Bubble: multi-metric comparison' } },
      scales: { x: { beginAtZero:true }, y: { beginAtZero:true } }
    }
  };
}

function generateScatterConfig() {
  const numeric = detectedMeta.numeric;
  const xField = numeric[0] || detectedMeta.headers[0];
  const yField = numeric[1] || numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
  const points = currentData.map(r => ({ x: parseFloat(r[xField]) || 0, y: parseFloat(r[yField]) || 0 })).slice(0,200);
  return {
    type: 'scatter',
    data: { datasets: [{ label: `${yField} vs ${xField}`, data: points }] },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: 'Scatter plot' } },
      scales: { x: { beginAtZero:true }, y: { beginAtZero:true } }
    }
  };
}

function generateRadarConfig() {
  const cat = detectedMeta.categorical[0] || detectedMeta.headers[0];
  // convert first few numeric columns into radar dataset
  const numbers = detectedMeta.numeric.slice(0,6);
  if (!numbers.length) return generateBarConfig(detectedMeta.headers[0], detectedMeta.numeric[0] || detectedMeta.headers[1]);
  const labels = numbers;
  const values = numbers.map(n => {
    return currentData.reduce((s,r) => s + (parseFloat(r[n])||0), 0) / Math.max(1, currentData.length);
  });
  return {
    type: 'radar',
    data: { labels, datasets: [{ label: 'Average', data: values }] },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: 'Radar (averages across numeric columns)' } }
    }
  };
}

function generatePolarAreaConfig(categoryField) {
  return generatePieConfig(categoryField); // polarArea looks similar to pie for now
}

/* =========================
   Data preview & table
   ========================= */
function renderPreviewTable() {
  const previewRows = currentData.slice(0, 20);
  previewTableContainer.innerHTML = renderTableFromRows(previewRows);
}

function renderDataTable() {
  const q = (tableSearch.value || '').toLowerCase().trim();
  const rows = currentData.filter(r => {
    if (!q) return true;
    return Object.values(r).some(v => (v === null || v === undefined) ? false : ('' + v).toLowerCase().includes(q));
  });
  dataTableContainer.innerHTML = renderTableFromRows(rows);
  exportCsvBtn.disabled = rows.length === 0;
}

function renderTableFromRows(rows) {
  if (!rows || !rows.length) return '<div class="p-3 text-muted">No data</div>';
  const headers = Object.keys(rows[0]);
  let html = '<table class="table table-sm"><thead><tr>';
  headers.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach(r => {
    html += '<tr>';
    headers.forEach(h => html += `<td>${escapeHtml(r[h])}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function escapeHtml(v){ if (v===null || v===undefined) return ''; return (''+v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

/* =========================
   Export processed data (CSV/XLSX)
   ========================= */
function exportProcessedData() {
  if (!currentData || !currentData.length) return alert('No data to export');
  const ws = XLSX.utils.json_to_sheet(currentData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, currentSheetName || 'Sheet1');
  XLSX.writeFile(wb, `processed-${(new Date()).toISOString().slice(0,19)}.xlsx`);
}

/* =========================
   Map (Leaflet) + geocoding
   ========================= */
function initMap() {
  mapInstance = L.map('map', { zoomControl:true }).setView([22.0, 80.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);
  mapMarkersLayer = L.layerGroup().addTo(mapInstance);
}

async function attemptMapPlot(rows) {
  mapStatus.textContent = 'Checking for location fields...';
  mapMarkersLayer.clearLayers();

  const headers = detectedMeta.headers;
  const latKeys = headers.filter(h => /lat|latitude/i.test(h));
  const lonKeys = headers.filter(h => /lon|lng|longitude/i.test(h));
  if (latKeys.length && lonKeys.length) {
    const latK = latKeys[0], lonK = lonKeys[0];
    rows.forEach(r => {
      const lat = parseFloat(r[latK]);
      const lon = parseFloat(r[lonK]);
      if (isFinite(lat) && isFinite(lon)) addMarker(lat, lon, r);
    });
    mapStatus.textContent = 'Plotted lat/lon points';
    fitMapToMarkers();
    return;
  }

  const placeField = headers.find(h => /city|town|village|state|district|place|location/i.test(h));
  if (!placeField) {
    mapStatus.textContent = 'No location fields found';
    return;
  }

  mapStatus.textContent = `Geocoding unique values in "${placeField}" (this may take a few seconds)`;
  const uniquePlaces = Array.from(new Set(rows.map(r => (r[placeField]||'').toString()).filter(Boolean))).slice(0, 60);
  const geocoded = [];
  for (let i=0;i<uniquePlaces.length;i++){
    const name = uniquePlaces[i];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name + ' India')}&limit=1&addressdetails=1`;
      await delay(600);
      const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!resp.ok) continue;
      const json = await resp.json();
      if (json && json[0]) {
        const lat = parseFloat(json[0].lat), lon = parseFloat(json[0].lon);
        geocoded.push({ name, lat, lon });
      }
    } catch (err) {
      console.warn('geocode failed', name, err);
    }
  }

  rows.forEach(r => {
    const name = (r[placeField]||'').toString();
    const geo = geocoded.find(g => g.name === name);
    if (geo) addMarker(geo.lat, geo.lon, r);
  });

  if (mapMarkersLayer.getLayers().length) {
    mapStatus.textContent = 'Plotted place-based points';
    fitMapToMarkers();
  } else {
    mapStatus.textContent = 'Geocoding found no points (try adding latitude/longitude columns)';
  }
}

function addMarker(lat, lon, row) {
  const marker = L.circleMarker([lat, lon], { radius:6, color:'#3b82f6', fillColor:'#60a5fa', fillOpacity:0.8 });
  const html = renderRowCard(row);
  marker.bindPopup(html, { maxWidth: 320 });
  marker.addTo(mapMarkersLayer);
}

function fitMapToMarkers() {
  if (!mapMarkersLayer || !mapMarkersLayer.getLayers().length) return;
  const group = L.featureGroup(mapMarkersLayer.getLayers());
  mapInstance.fitBounds(group.getBounds().pad(0.2));
}

function renderRowCard(row) {
  const lines = Object.entries(row).map(([k,v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`).join('');
  return `<div style="font-size:0.9rem">${lines}</div>`;
}

function delay(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

/* =========================
   Filters rendering
   ========================= */
function renderFilters() {
  filterControls.innerHTML = '';
  if (!detectedMeta.headers.length) {
    filterControls.innerHTML = '<p class="text-muted small">Upload data to see filters</p>';
    return;
  }
  detectedMeta.categorical.slice(0,3).forEach(col => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-2';
    const label = document.createElement('label'); label.className = 'form-label small mb-1'; label.textContent = col;
    const sel = document.createElement('select'); sel.className = 'form-select form-select-sm';
    const vals = Array.from(new Set(originalData.map(r => r[col]||'').slice(0,200))).slice(0,40);
    const any = document.createElement('option'); any.value=''; any.textContent = 'All';
    sel.appendChild(any);
    vals.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
    sel.addEventListener('change', () => applyFilters());
    wrapper.appendChild(label); wrapper.appendChild(sel);
    filterControls.appendChild(wrapper);
  });
}

function applyFilters() {
  const selects = filterControls.querySelectorAll('select');
  const criteria = [];
  selects.forEach(sel => {
    const val = sel.value;
    const label = sel.previousElementSibling?.textContent;
    if (val && label) criteria.push({ col: label, val });
  });

  currentData = originalData.filter(r => {
    return criteria.every(c => (r[c.col]??'')+'' === (c.val+''));
  });
  renderDataTable();
  renderCurrentChart();
  attemptMapPlot(currentData);
}

/* =========================
   Chart Info modal (placeholders)
   ========================= */
function showChartInfo(type) {
  const docs = {
    histogram: { title: 'Histogram — placeholder', url: 'https://www.npmjs.com/search?q=chartjs%20histogram', body: 'Histogram support requires binning and/or a plugin. Consider using a Chart.js histogram plugin or pre-binning your data in JS before rendering.' },
    boxplot: { title: 'Box Plot — placeholder', url: 'https://chartjs-chart-boxplot.netlify.app/', body: 'Box plots require the chartjs-chart-boxplot plugin. This demo currently shows a placeholder — to enable, add the plugin and adapt data.' },
    violin: { title: 'Violin Plot — placeholder', url: 'https://www.npmjs.com/search?q=violin%20chart%20chartjs', body: 'Violin plots are not native to Chart.js. Use a specialized library/plugin.' },
    heatmap: { title: 'Heatmap — placeholder', url: 'https://www.npmjs.com/search?q=heatmap%20chartjs', body: 'Heatmaps typically require matrix-like data and a plugin. Consider using a dedicated plugin or d3/plotly.' },
    treemap: { title: 'Treemap — placeholder', url: 'https://www.npmjs.com/search?q=chartjs-chart-treemap', body: 'Treemap requires chartjs-chart-treemap plugin.' },
    sankey: { title: 'Sankey Diagram — placeholder', url: 'https://www.npmjs.com/search?q=chartjs%20sankey', body: 'Sankey diagrams require a plugin or a different library (e.g., Google Charts Sankey or d3-sankey).' },
    sunburst: { title: 'Sunburst — placeholder', url: 'https://www.npmjs.com/search?q=sunburst%20chart', body: 'Sunburst charts are hierarchical and require specialized plotting libraries.' },
    funnel: { title: 'Funnel — placeholder', url: 'https://www.npmjs.com/search?q=funnel%20chart', body: 'Funnel charts are typically supported via plugins or specialized libraries.' },
    gauge: { title: 'Gauge / Dial — placeholder', url: 'https://www.npmjs.com/search?q=gauge%20chart', body: 'Gauges/dials are supported via specialized plugins or small libraries.' },
    candlestick: { title: 'Candlestick — placeholder', url: 'https://www.highcharts.com/docs/stock/chart-types/candlestick', body: 'Candlestick charts are financial charts — consider using trading libraries or Chart.js financial plugins.' },
    choropleth: { title: 'Choropleth Map — placeholder', url: 'https://leafletjs.com/examples/choropleth/', body: 'Choropleth maps are built on mapping libraries (Leaflet, Mapbox) and require geojson & region-to-value mapping.' }
  };

  const info = docs[type] || { title: type, url: 'https://www.google.com', body: 'This chart type requires additional libraries or pre-processing.' };
  chartInfoBody.innerHTML = `<p><strong>${escapeHtml(info.title)}</strong></p><p class="small text-muted">${escapeHtml(info.body)}</p><p class="mt-2"><em>Recommendation:</em> open the docs link below to see a recommended plugin / approach.</p>`;
  chartInfoDocs.href = info.url;
  chartInfoModal.show();
}

/* =========================
   Small utilities (reload)
   ========================= */
function tryReloadFromLocal(){
  try {
    const raw = localStorage.getItem('lastDatasetPreview');
    if (!raw) return;
    const p = JSON.parse(raw);
    console.info('Found saved dataset preview from previous session:', p.sheet);
  } catch(e){}
}

/* =========================
   Misc helpers
   ========================= */

/* escape in HTML used above */

/* =========================
   End of file
   ========================= */
