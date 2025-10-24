import React, { useMemo } from 'react'
import { summarizeInsights } from '../utils/aiInsights'

export default function InsightPanel({ data, schema }) {
  const insights = useMemo(() => summarizeInsights(data, schema), [data, schema])

  return (
    <div className="card p-3">
      <h3 className="font-semibold">AI Insights (client-side)</h3>
      <div className="mt-2 space-y-2 text-sm text-slate-300">
        {insights.map((t, i) => <div key={i}>• {t}</div>)}
      </div>
    </div>
  )
}
