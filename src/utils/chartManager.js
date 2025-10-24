// simple chart recommender based on schema
export function recommendChart(schema, data) {
  // find two numeric columns
  const numerics = Object.entries(schema).filter(([k,v])=>v.type === 'numeric').map(([k])=>k)
  const cats = Object.entries(schema).filter(([k,v])=>v.type === 'categorical').map(([k])=>k)
  const dates = Object.entries(schema).filter(([k,v])=>v.type === 'datetime').map(([k])=>k)
  if (numerics.length >= 2) return { type: 'scatter', x: numerics[0], y: numerics[1] }
  if (numerics.length >=1 && cats.length >=1) return { type: 'bar', x: cats[0], y: numerics[0] }
  if (dates.length >=1 && numerics.length >=1) return { type: 'line', x: dates[0], y: numerics[0] }
  // fallback
  return { type: 'bar', x: Object.keys(schema)[0], y: Object.keys(schema)[1] || Object.keys(schema)[0] }
}
