// ===== Sachida's Dashboard JS =====
let workbookData = {};
let currentSheetName = null;
let chartInstance = null;

// DOM shortcuts
const fileInput = document.getElementById("fileInput");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const openUploadBtn = document.getElementById("openUploadBtn");
const loadFileBtn = document.getElementById("loadFileBtn");
const sheetSelect = document.getElementById("sheetSelect");
const refreshChartsBtn = document.getElementById("refreshCharts");
const mainChartCanvas = document.getElementById("mainChart");
const previewTableWrapper = document.getElementById("previewTableWrapper");
const previewTableContainer = document.getElementById("previewTableContainer");
const exportCsvBtn = document.getElementById("exportCsvBtn");

// Bootstrap modal
const uploadModal = new bootstrap.Modal(document.getElementById("uploadModal"));

chooseFileBtn.onclick = () => fileInput.click();
openUploadBtn.onclick = () => uploadModal.show();

fileInput.addEventListener("change", handleFileSelect);

function handleFileSelect(evt) {
  const file = evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  const isCSV = file.name.endsWith(".csv");

  reader.onload = e => {
    if (isCSV) {
      const csvData = Papa.parse(e.target.result, { header: true });
      workbookData = { "CSV Data": csvData.data };
      populateSheetList(["CSV Data"]);
    } else {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      workbookData = {};
      workbook.SheetNames.forEach(sheet => {
        workbookData[sheet] = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: "" });
      });
      populateSheetList(workbook.SheetNames);
    }
  };

  if (isCSV) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function populateSheetList(sheets) {
  sheetSelect.innerHTML = "";
  sheets.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sheetSelect.appendChild(opt);
  });
  sheetSelect.disabled = false;
  loadFileBtn.disabled = false;
}

loadFileBtn.onclick = () => {
  currentSheetName = sheetSelect.value;
  uploadModal.hide();
  renderTable();
  renderChart();
  exportCsvBtn.disabled = false;
};

function renderTable() {
  const data = workbookData[currentSheetName];
  if (!data || !data.length) return;

  let html = "<table class='table table-sm'>";
  html += "<thead><tr>";
  Object.keys(data[0]).forEach(h => (html += `<th>${h}</th>`));
  html += "</tr></thead><tbody>";
  data.forEach(row => {
    html += "<tr>";
    Object.values(row).forEach(val => (html += `<td>${val}</td>`));
    html += "</tr>";
  });
  html += "</tbody></table>";
  document.getElementById("dataTableContainer").innerHTML = html;

  previewTableWrapper.style.display = "block";
  previewTableContainer.innerHTML = html;
}

function renderChart() {
  const data = workbookData[currentSheetName];
  if (!data || !data.length) return;

  // Simple auto bar chart using first two columns
  const keys = Object.keys(data[0]);
  if (keys.length < 2) return alert("Need at least two columns to plot!");

  const labels = data.map(r => r[keys[0]]);
  const values = data.map(r => parseFloat(r[keys[1]]) || 0);

  const ctx = mainChartCanvas.getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: `${keys[1]} vs ${keys[0]}`,
          data: values,
          backgroundColor: "rgba(54,162,235,0.5)",
          borderColor: "rgb(54,162,235)",
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Enable chart refresh
refreshChartsBtn.onclick = renderChart;

// Map (Leaflet) setup
const map = L.map("map").setView([22.9734, 78.6569], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap"
}).addTo(map);
L.marker([28.6139, 77.2090]).addTo(map).bindPopup("Example marker: New Delhi");
