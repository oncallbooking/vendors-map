/* Main script: loads vendors.json and creates interactive leaflet map
   Features:
   - Marker clustering
   - Category/subcategory hierarchical filtering
   - Search (name/city/state)
   - Popup with profile + modal for full profile
   - CSV export of currently visible vendors
*/

const DATA_FILE = 'vendors.json'; // replace with your file if different

let map, markerCluster, allMarkers = [], categoryLayers = {}, vendorsData = [];

function init() {
  map = L.map('map').setView([22.0, 80.0], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markerCluster = L.markerClusterGroup();
  map.addLayer(markerCluster);

  fetch(DATA_FILE)
    .then(r => r.json())
    .then(data => {
      vendorsData = data;
      buildFromData(data);
    })
    .catch(err => {
      console.error('Failed to load vendors.json', err);
      alert('Could not load vendor data. Check vendors.json is present.');
    });

  setupUIHandlers();
}

function buildFromData(vendors) {
  // Build categories
  const categories = {};
  vendors.forEach(v => {
    const cat = (v.category || 'Uncategorized').toString();
    const sub = (v.subcategory || '').toString();
    if (!categories[cat]) categories[cat] = {};
    if (sub) {
      categories[cat][sub] = categories[cat][sub] || [];
    } else {
      categories[cat]._list = categories[cat]._list || [];
    }
    // push placeholder - actual marker association happens later
  });

  buildCategoryTree(categories);

  // Add markers
  vendors.forEach((v, idx) => {
    const lat = parseFloat(v.latitude);
    const lon = parseFloat(v.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const marker = L.marker([lat, lon]);
      marker.vendor = v;
      marker.bindPopup(buildPopupHtml(v), { maxWidth: 420 });
      marker.on('popupopen', () => {
        // optional: highlight or track
      });
      markerCluster.addLayer(marker);
      allMarkers.push(marker);

      // category index
      const cat = v.category || 'Uncategorized';
      if (!categoryLayers[cat]) categoryLayers[cat] = [];
      categoryLayers[cat].push(marker);
    }
  });

  buildLegend(Object.keys(categories));
}

function buildPopupHtml(v){
  const p = v.profile || {};
  let html = '<div class="popup-card">';
  html += `<h3>${escapeHtml(v.name || 'Unnamed')}</h3>`;
  html += `<p><strong>Category:</strong> ${escapeHtml(v.category || '')}${v.subcategory ? ' → ' + escapeHtml(v.subcategory) : ''}</p>`;
  html += `<p><strong>Location:</strong> ${escapeHtml(v.city || '')}, ${escapeHtml(v.state || '')}</p>`;
  if (p.owner) html += `<p><strong>Owner:</strong> ${escapeHtml(p.owner)}</p>`;
  const phone = p.phone || p.contact || p.mobile;
  if (phone) html += `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>`;
  if (p.email) html += `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a></p>`;
  if (p.website) html += `<p><strong>Website:</strong> <a target="_blank" href="${escapeHtml(p.website)}">${escapeHtml(p.website)}</a></p>`;
  html += `<p><button onclick="openProfileModal(${JSON.stringify(escapeHtml(JSON.stringify(v))).replace(/"/g,'&quot;')})">View Full Profile</button></p>`;
  html += '</div>';
  return html;
}

// Modal: we pass a JSON string encoded above, decode it here and render nicely
function openProfileModal(encodedJson) {
  try {
    const jsonStr = decodeHtml(encodedJson);
    const vendor = JSON.parse(jsonStr);
    const part = renderFullProfile(vendor);
    document.getElementById('modalBody').innerHTML = part;
    document.getElementById('modal').classList.remove('hidden');
  } catch (e) { console.error(e); }
}
function closeProfileModal(){ document.getElementById('modal').classList.add('hidden'); }

// Render full profile HTML
function renderFullProfile(v) {
  const p = v.profile || {};
  let html = `<h2>${escapeHtml(v.name)}</h2>`;
  html += `<p><strong>Category:</strong> ${escapeHtml(v.category || '')}${v.subcategory ? ' → ' + escapeHtml(v.subcategory) : ''}</p>`;
  html += `<p><strong>Location:</strong> ${escapeHtml(v.city || '')}, ${escapeHtml(v.state || '')}</p>`;
  html += `<hr/>`;
  if (p.owner) html += `<p><strong>Owner:</strong> ${escapeHtml(p.owner)}</p>`;
  if (p.phone) html += `<p><strong>Phone:</strong> ${escapeHtml(p.phone)}</p>`;
  if (p.email) html += `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a></p>`;
  if (p.website) html += `<p><strong>Website:</strong> <a href="${escapeHtml(p.website)}" target="_blank">${escapeHtml(p.website)}</a></p>`;
  if (p.address) html += `<p><strong>Address:</strong> ${escapeHtml(p.address)}</p>`;
  if (p.description) html += `<p>${escapeHtml(p.description)}</p>`;
  // Add custom fields
  Object.keys(p).forEach(k => {
    if (!['owner','phone','email','website','address','description'].includes(k)){
      html += `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(p[k])}</p>`;
    }
  });
  return html;
}

function buildCategoryTree(categories) {
  const container = document.getElementById('categoryTree');
  container.innerHTML = '';
  Object.keys(categories).sort().forEach(cat => {
    const catDiv = document.createElement('div');
    catDiv.className = 'cat';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = true;
    chk.id = 'cat_' + slug(cat);
    chk.addEventListener('change', e => toggleCategory(cat, e.target.checked));
    const lbl = document.createElement('label');
    lbl.htmlFor = chk.id;
    lbl.innerText = cat;
    catDiv.appendChild(chk);
    catDiv.appendChild(lbl);

    const subs = Object.keys(categories[cat]).filter(k=>k!=='_list');
    if (subs.length) {
      const ul = document.createElement('ul');
      subs.forEach(sub => {
        const li = document.createElement('li');
        const subChk = document.createElement('input');
        subChk.type='checkbox';
        subChk.checked = true;
        subChk.id = 'sub_' + slug(cat) + '_' + slug(sub);
        subChk.addEventListener('change', e => toggleSubcategory(cat, sub, e.target.checked));
        const subLbl = document.createElement('label');
        subLbl.htmlFor = subChk.id;
        subLbl.innerText = sub;
        li.appendChild(subChk);
        li.appendChild(subLbl);
        ul.appendChild(li);
      });
      catDiv.appendChild(ul);
    }
    container.appendChild(catDiv);
  });
}

function toggleCategory(cat, visible) {
  const markers = categoryLayers[cat] || [];
  markers.forEach(m => {
    if (visible) markerCluster.addLayer(m);
    else markerCluster.removeLayer(m);
  });
}

function toggleSubcategory(cat, sub, visible) {
  allMarkers.forEach(m => {
    if ((m.vendor.category || '') === cat && (m.vendor.subcategory || '') === sub) {
      if (visible) markerCluster.addLayer(m);
      else markerCluster.removeLayer(m);
    }
  });
}

function buildLegend(categories) {
  const el = document.getElementById('legendItems');
  el.innerHTML = '';
  categories.slice(0, 12).forEach((c,i) => {
    const div = document.createElement('div');
    div.className = 'legend-item';
    const colorBox = document.createElement('span');
    colorBox.className = 'color-box';
    colorBox.style.background = getColorForIndex(i);
    const lbl = document.createElement('span');
    lbl.innerText = c;
    div.appendChild(colorBox);
    div.appendChild(lbl);
    el.appendChild(div);
  });
}

function getColorForIndex(i) {
  const palette = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
  return palette[i % palette.length];
}

// Search functionality
function setupUIHandlers(){
  document.getElementById('search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      // reset: show all markers present in markerCluster (respecting category toggles)
      markerCluster.clearLayers();
      allMarkers.forEach(m => {
        // show only if its category checkbox is checked
        const cat = m.vendor.category || 'Uncategorized';
        const catCheckbox = document.getElementById('cat_' + slug(cat));
        if (!catCheckbox || catCheckbox.checked) markerCluster.addLayer(m);
      });
      return;
    }
    // filter by query
    markerCluster.clearLayers();
    allMarkers.forEach(m => {
      const v = m.vendor;
      const hay = ((v.name||'') + ' ' + (v.city||'') + ' ' + (v.state||'') + ' ' + (v.category||'') + ' ' + (v.subcategory||'')).toLowerCase();
      if (hay.includes(q)) markerCluster.addLayer(m);
    });
  });

  document.getElementById('closeModal').addEventListener('click', closeProfileModal);
  document.getElementById('modal').addEventListener('click', (ev) => {
    if (ev.target.id === 'modal') closeProfileModal();
  });

  document.getElementById('exportCsv').addEventListener('click', () => {
    exportVisibleToCSV();
  });
}

function exportVisibleToCSV() {
  // Extract vendor data from markers currently in markerCluster
  const items = [];
  markerCluster.eachLayer(layer => {
    if (layer.vendor) items.push(layer.vendor);
  });
  if (items.length === 0) { alert('No visible vendors to export.'); return; }
  const cols = ['name','category','subcategory','city','state','latitude','longitude','owner','phone','email','website','address','description'];
  const rows = items.map(v => {
    const p = v.profile || {};
    return cols.map(c => {
      if (['owner','phone','email','website','address','description'].includes(c)) return escapeCsv((p[c] || ''));
      return escapeCsv(v[c] || '');
    }).join(',');
  });
  const csv = [cols.join(',')].concat(rows).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vendors_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(s){ if (s === null || s === undefined) return ''; return '"' + String(s).replace(/"/g,'""') + '"'; }

function slug(s) { return (s || '').toString().toLowerCase().replace(/\s+/g,'_').replace(/[^\w\-]/g,''); }
function escapeHtml(s){ if (s === null || s === undefined) return ''; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function decodeHtml(encoded){ const txt = document.createElement('textarea'); txt.innerHTML = encoded; return txt.value; }

// bootstrap
window.onload = init;
