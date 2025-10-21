// script.js
// Loads vendors.json and creates interactive India map with category hierarchy and popups.
// If lat/lon missing it attempts geocoding via Nominatim (best-effort).

const VENDORS_JSON = 'vendors.json';
let map, markersGroup, markerCluster;
let allMarkers = [];
let vendors = [];
let categoryLayers = {}; // category -> array of markers
let stateCounts = {}; // for choropleth mode (if used)

init();

function init(){
  map = L.map('map').setView([22.0, 80.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markerCluster = L.markerClusterGroup();
  markersGroup = L.layerGroup().addTo(map);
  markerCluster.addTo(map);

  fetch(VENDORS_JSON)
    .then(r => r.json())
    .then(data => {
      vendors = data;
      prepareDataAndRender(vendors);
      attachUiHandlers();
    })
    .catch(err => {
      console.error('Failed to load', VENDORS_JSON, err);
      alert('Failed to load vendors.json — check console.');
    });
}

async function prepareDataAndRender(vendorsList){
  // First pass: check coords; queue geocode for missing ones
  const geocodeQueue = [];
  vendorsList.forEach((v, i) => {
    if (v.latitude != null && v.longitude != null) {
      // ok
    } else {
      // try to extract city/state
      let city = v.city || v.City || '';
      let state = v.state || v.State || '';
      if (city || state) geocodeQueue.push({vendor:v, idx:i, city, state});
    }
  });

  // Process geocoding sequentially (Nominatim rate-limit friendly)
  for (let i=0;i<geocodeQueue.length;i++){
    const {vendor, city, state} = geocodeQueue[i];
    try {
      const coords = await geocodeCityState(city, state);
      if (coords) {
        vendor.latitude = coords.lat;
        vendor.longitude = coords.lon;
      }
    } catch(err){
      console.warn('Geocode failed for', city, state, err);
    }
    // small delay to avoid server rate-limit
    await sleep(450);
  }

  // Build markers and category tree
  vendorsList.forEach(v => {
    if (v.latitude == null || v.longitude == null) return; // skip if still missing coords
    const m = L.marker([v.latitude, v.longitude]);
    m.vendor = v;
    m.bindPopup(buildPopupHtml(v), {maxWidth:420});
    markerCluster.addLayer(m);
    allMarkers.push(m);

    // category map
    const cat = (v.category || v.Category || 'Uncategorized');
    if (!categoryLayers[cat]) categoryLayers[cat] = [];
    categoryLayers[cat].push(m);

    // state counts
    const state = (v.state || v.State || v.state_name || v.Region || 'Unknown');
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  });

  document.getElementById('categoryTree').innerHTML = '';
  buildCategoryTree(categoryLayers);
  // Fit bounds if markers exist
  if (allMarkers.length) {
    const group = L.featureGroup(allMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

function buildPopupHtml(v){
  const p = v.profile || v.profile || {};
  const html = [];
  html.push('<div class="popup-card">');
  html.push('<h3>' + esc(v.name || v.Name || 'Unknown Vendor') + '</h3>');
  html.push('<p><strong>Category:</strong> ' + esc(v.category || v.Category || '') + (v.subcategory ? ' → ' + esc(v.subcategory) : '') + '</p>');
  html.push('<p><strong>Location:</strong> ' + esc(v.city || v.City || '') + ', ' + esc(v.state || v.State || '') + '</p>');
  const phone = p.phone || p.contact || p.mobile || v.Contact || v.Phone;
  if (phone) html.push('<p><strong>Phone:</strong> ' + esc(phone) + '</p>');
  const email = p.email || v.Email;
  if (email) html.push('<p><strong>Email:</strong> <a href="mailto:' + esc(email) + '">' + esc(email) + '</a></p>');
  const site = p.website || v.Website || v.website;
  if (site) html.push('<p><strong>Website:</strong> <a target="_blank" href="' + esc(site) + '">' + esc(site) + '</a></p>');
  if (p.address || v.Address) html.push('<p>' + esc(p.address || v.Address) + '</p>');
  // Add a little 'view profile' button placeholder
  html.push('<p style="margin-top:8px;"><a target="_blank" href="' + (v.website || '#') + '">Open full profile</a></p>');
  html.push('</div>');
  return html.join('');
}

function buildCategoryTree(catMap){
  const container = document.getElementById('categoryTree');
  container.innerHTML = '';
  Object.keys(catMap).sort().forEach(cat => {
    const div = document.createElement('div');
    div.className = 'cat';
    const id = 'cat_' + sanitizeId(cat);
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = true;
    chk.id = id;
    chk.addEventListener('change', (e)=> toggleCategory(cat, e.target.checked));
    const lbl = document.createElement('label');
    lbl.htmlFor = id;
    lbl.innerText = cat + ` (${catMap[cat].length})`;
    div.appendChild(chk);
    div.appendChild(lbl);
    container.appendChild(div);
  });
}

function toggleCategory(cat, show){
  const markers = categoryLayers[cat] || [];
  markers.forEach(m => {
    if (show) markerCluster.addLayer(m); else markerCluster.removeLayer(m);
  });
}

function attachUiHandlers(){
  document.getElementById('fitAll').addEventListener('click', ()=>{
    if (!allMarkers.length) return alert('No markers to fit.');
    map.fitBounds(L.featureGroup(allMarkers).getBounds().pad(0.12));
  });

  document.getElementById('downloadJson').addEventListener('click', ()=>{
    const a = document.createElement('a');
    a.href = VENDORS_JSON;
    a.download = 'vendors.json';
    a.click();
  });

  document.getElementById('search').addEventListener('input', (e)=>{
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      // show all markers
      allMarkers.forEach(m=> markerCluster.hasLayer(m) || markerCluster.addLayer(m));
      return;
    }
    allMarkers.forEach(m=>{
      const v = m.vendor || {};
      const hay = ((v.name||v.Name||'') + ' ' + (v.city||v.City||'') + ' ' + (v.state||v.State||'') + ' ' + (v.category||v.Category||'') + ' ' + (v.subcategory||'')).toLowerCase();
      if (hay.includes(q)) {
        if (!markerCluster.hasLayer(m)) markerCluster.addLayer(m);
      } else {
        if (markerCluster.hasLayer(m)) markerCluster.removeLayer(m);
      }
    });
  });

  // display mode toggle
  document.querySelectorAll('input[name="displayMode"]').forEach(r=>{
    r.addEventListener('change', (e)=>{
      if (e.target.value === 'chorople
