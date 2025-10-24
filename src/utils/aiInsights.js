// small client-side insights / heuristics (no external AI). Returns array of sentences.
export function summarizeInsights(data = [], schema = {}) {
  if (!data || data.length === 0) return ['No data loaded.']
  const insights = []
  // top numeric columns by variance
  const numericCols = Object.entries(schema).filter(([k,v])=>v.type === 'numeric').map(([k])=>k)
  if (numericCols.length > 0) {
    const variances = numericCols.map(c => {
      const vals = data.map(r => Number(r[c]) || 0)
      const mean = vals.reduce((a,b)=>a+b,0)/vals.length
      const varr = vals.reduce((a,b)=>a + (b-mean)*(b-mean),0)/vals.length
      return { c, varr }
    }).sort((a,b)=>b.varr-a.varr)
    insights.push(`Top metric by variability: ${variances[0].c}`)
  }
  // top states by capacity (if present)
  const stField = Object.keys(schema).find(k => k.toLowerCase().includes('state'))
  const capField = Object.keys(schema).find(k => k.toLowerCase().includes('capacity') || k.toLowerCase().includes('revenue'))
  if (stField && capField) {
    const agg = {}
    data.forEach(r => {
      const st = r[stField] || 'Unknown'
      const v = Number(r[capField]) || 0
      agg[st] = (agg[st] || 0) + v
    })
    const top = Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,3)
    insights.push(`Top states by ${capField}: ${top.map(t=>t[0]).join(', ')}`)
  }
  // count rows & missing data overall
  const missing = {}
  Object.keys(schema).forEach(c => {
    missing[c] = data.filter(r => r[c] === null || r[c] === undefined || r[c] === '').length
  })
  const totalMissing = Object.values(missing).reduce((a,b)=>a+b,0)
  insights.push(`Rows: ${data.length}. Total nulls across fields: ${totalMissing}.`)
  return insights
}
