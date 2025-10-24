// construct quick centroid index from geojson features keyed by STATE_NAME
export function buildGeoIndex(geojson) {
  const idx = {}
  geojson.features.forEach(f => {
    const key = (f.properties.STATE_NAME || f.properties.st_name || f.properties.NAME || '').trim()
    if (!key) return
    const geom = f.geometry
    // crude centroid:
    let coords = []
    if (geom.type === 'Polygon') coords = geom.coordinates[0]
    else if (geom.type === 'MultiPolygon') coords = geom.coordinates[0][0]
    if (!coords || coords.length === 0) return
    let sx = 0, sy = 0
    coords.forEach(c => { sx += c[1]; sy += c[0] })
    const lat = sx / coords.length
    const lon = sy / coords.length
    idx[key] = [lat, lon]
    idx[key.toLowerCase()] = [lat, lon]
  })
  return idx
}
