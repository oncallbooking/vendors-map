import React, { useEffect, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { recommendChart } from '../utils/chartManager'

// Simple ChartBuilder: user chooses X and Y, picks type (or suggested), renders Chart.js chart
export default function ChartBuilder({ data, schema, panel, onSave, fullscreen }) {
  const canvasRef = useRef()
  const chartRef = useRef()
  const [xCol, setXCol] = useState(null)
  const [yCol, setYCol] = useState(null)
  const [chartType, setChartType] = useState('bar')

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
      }
    }
  }, [])

  function renderChart() {
    if (!xCol || !yCol || !data) return
    const labels = data.map(r => String(r[xCol]))
    const values = data.map(r => Number(r[yCol]) || 0)
    const cfg = {
      type: chartType,
      data: {
        labels,
        datasets: [{
          label: `${yCol} vs ${xCol}`,
          data: values,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        interaction: { mode: 'index' },
        animation: { duration: 600 }
      }
    }
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, cfg)
    onSave({ xCol, yCol, chartType })
  }

  function suggest() {
    const rec = recommendChart(schema, data)
    if (rec.x) setXCol(rec.x)
    if (rec.y) setYCol(rec.y)
    if (rec.type) setChartType(rec.type)
    setTimeout(renderChart, 50)
  }

  return (
    <div className={`${fullscreen ? 'h-[70vh]' : 'h-80'} flex flex-col`}>
      <div className="flex gap-2 mb-2">
        <select onChange={e => setXCol(e.target.value)} value={xCol || ''} className="p-1 rounded flex-1">
          <option value="">Select X</option>
          {Object.keys(schema).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select onChange={e => setYCol(e.target.value)} value={yCol || ''} className="p-1 rounded flex-1">
          <option value="">Select Y</option>
          {Object.keys(schema).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select onChange={e => setChartType(e.target.value)} value={chartType} className="p-1 rounded">
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="pie">Pie</option>
          <option value="scatter">Scatter</option>
        </select>
        <button className="card px-3" onClick={renderChart}>Draw</button>
        <button className="card px-3" onClick={suggest}>Suggest</button>
      </div>

      <div className="flex-1">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  )
}
