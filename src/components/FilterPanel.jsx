import React, { useMemo, useState, useEffect } from 'react'

export default function FilterPanel({ schema, data, onFilterChange }) {
  // dynamic filters: for each categorical column show multi-select; numeric show range slider
  const [localFilters, setLocalFilters] = useState({})

  useEffect(() => {
    onFilterChange(localFilters)
  }, [localFilters])

  if (!data || data.length === 0) {
    return <div className="card p-3">No data loaded</div>
  }

  function uniqueValues(field) {
    const s = new Set()
    data.forEach(r => {
      if (r[field] !== null && r[field] !== undefined) s.add(r[field])
    })
    return Array.from(s).slice(0, 50)
  }

  return (
    <div className="card p-3">
      <h3 className="font-semibold">Filters</h3>
      <div className="mt-2 space-y-3 max-h-96 overflow-auto">
        {Object.entries(schema || {}).map(([col, meta]) => {
          if (meta.type === 'categorical') {
            const vals = uniqueValues(col)
            return (
              <div key={col}>
                <label className="block text-sm font-medium">{col}</label>
                <select
                  multiple
                  className="w-full mt-1 p-1 rounded"
                  onChange={(e) => {
                    const sel = Array.from(e.target.selectedOptions).map(o => o.value)
                    setLocalFilters(f => ({ ...f, [col]: sel }))
                  }}
                >
                  {vals.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )
          } else if (meta.type === 'numeric') {
            const vals = data.map(d => Number(d[col]) || 0)
            const min = Math.min(...vals), max = Math.max(...vals)
            return (
              <div key={col}>
                <label className="block text-sm font-medium">{col} (numeric)</label>
                <div className="flex gap-2 mt-1">
                  <input type="number" placeholder={String(min)} className="p-1 rounded w-1/2"
                    onBlur={(e)=> setLocalFilters(f => ({ ...f, [col]: { ...f[col], min: Number(e.target.value) } }))} />
                  <input type="number" placeholder={String(max)} className="p-1 rounded w-1/2"
                    onBlur={(e)=> setLocalFilters(f => ({ ...f, [col]: { ...f[col], max: Number(e.target.value) } }))} />
                </div>
              </div>
            )
          } else if (meta.type === 'datetime') {
            return (
              <div key={col}>
                <label className="block text-sm font-medium">{col} (date)</label>
                <input type="date" className="p-1 mt-1 rounded w-full"
                  onChange={(e)=> setLocalFilters(f => ({ ...f, [col]: { date: e.target.value } }))} />
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}
