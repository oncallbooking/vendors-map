import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buildGeoIndex } from '../utils/geoUtils'

export default function MapPanel({ data, schema, geoJsonUrl, panel, onSave, fullscreen }) {
  const mapRef = useRef()
  const containerRef = useRef()

  useEffect(() => {
    if (!containerRef.current) return
    // initialize
    const map = L.map(containerRef.current, { center: [22.0, 79.0], zoom: 5, minZoom: 4 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OSM'
    }).addTo(map)

    // add geojson
    fetch(geoJsonUrl).then(r => r.json()).then(geojson => {
      L.geoJSON(geojson, {
        style: () => ({ weight: 1, color: '#ffffff22', fillOpacity: 0.05 })
      }).addTo(map)

      // build small index to get centroids if only state names available
      const idx = buildGeoIndex(geojson)

      // plot vendor bubbles
      const group = L.layerGroup().addTo(map)
      data.forEach(v => {
        let lat = parseFloat(v.latitude)
        let lon = parseFloat(v.longitude)
        if ((!lat || !lon) && v.state) {
          const c = idx[v.state]
          if (c) { lat = c[0]; lon = c[1] }
        }
        if (!lat || !lon) return
        const size = (Number(v.capacity) || 100) / 50 + 6
        const color = v.category === 'Large' ? '#ff7b7b' : v.category === 'Medium' ? '#ffd57b' : '#7be3ff'
        const circle = L.circleMarker([lat, lon], {
          radius: size, fillColor: color, color: '#00000022', weight: 1, fillOpacity: 0.9
        })
        circle.bindTooltip(`<strong>${v.name}</strong><br/>${v.city || ''}, ${v.state || ''}<br/>Capacity: ${v.capacity}`)
        circle.on('click', () => {
          const content = `
            <div style="min-width:200px">
              <h3>${v.name}</h3>
              <p>${v.city || ''}, ${v.state || ''}</p>
              <p>Category: ${v.category}</p>
              <p>Capacity: ${v.capacity}</p>
              <p>Revenue: ${v.revenue}</p>
            </div>
          `
          L.popup({ maxWidth: 300 }).setLatLng([lat, lon]).setContent(content).openOn(map)
        })
        circle.addTo(group)
      })

    })

    mapRef.current = map
    return () => map.remove()
  }, [data])

  return (
    <div className={`${fullscreen ? 'h-[64vh]' : 'h-80'} w-full card p-1`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
