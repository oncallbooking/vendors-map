// main.js
document.addEventListener("DOMContentLoaded", () => {
  // Initialize map
  const map = L.map('map').setView([20.5937, 78.9629], 5); // India center

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Load vendors
  fetch('assets/js/vendors.json')
    .then(res => res.json())
    .then(data => {
      data.forEach(vendor => {
        L.marker([vendor.lat, vendor.lng])
          .addTo(map)
          .bindPopup(`<b>${vendor.name}</b><br>${vendor.service}`);
      });
    });
});
