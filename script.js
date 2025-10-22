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
        title: { display:true, text: `Di
