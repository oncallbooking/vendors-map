// simple data processor: parse schema, detect numeric/categorical/datetime/geo
export function detectSchema(rows = []) {
  if (!rows || rows.length === 0) return {}
  const cols = Object.keys(rows[0])
  const schema = {}
  cols.forEach(col => {
    let numeric = 0, date = 0, text = 0, latlon = 0
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const v = rows[i][col]
      if (v === null || v === undefined) continue
      if (typeof v === 'number') numeric++
      else if (typeof v === 'string') {
        const s = v.trim()
        if (!isNaN(Number(s))) numeric++
        else if (Date.parse(s)) date++
        else text++
        if (col.toLowerCase().includes('lat') || col.toLowerCase().includes('lon')) latlon++
      }
    }
    if (latlon > 0 || col.toLowerCase().includes('latitude') || col.toLowerCase().includes('longitude')) {
      schema[col] = { type: 'geo' }
    } else if (numeric > text && numeric > date) schema[col] = { type: 'numeric' }
    else if (date > numeric && date > text) schema[col] = { type: 'datetime' }
    else schema[col] = { type: 'categorical' }
  })
  return schema
}

// helper used to parse sample csv loaded via raw import
import Papa from 'papaparse'
export function parseSampleCSV(raw) {
  return new Promise((resolve)=> {
    Papa.parse(raw, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data)
    })
  })
}
