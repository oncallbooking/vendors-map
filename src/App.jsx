import React, { useEffect, useState, useRef } from 'react'
import UploadPanel from './components/UploadPanel'
import ChartBuilder from './components/ChartBuilder'
import MapPanel from './components/MapPanel'
import FilterPanel from './components/FilterPanel'
import InsightPanel from './components/InsightPanel'
import { parseSampleCSV, detectSchema } from './utils/dataProcessor'
import sampleCSV from '../public/sample_vendors.csv?raw'

function App() {
  // app state
  const [data, setData] = useState([]) // array of objects
  const [schema, setSchema] = useState({})
  const [selectedColumns, setSelectedColumns] = useState({})
  const [filters, setFilters] = useState({})
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
  const [panels, setPanels] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dash_panels')) || []
    } catch { return [] }
  })
  const containerRef = useRef()

  useEffect(() => {
    // load sample dataset on start
    (async () => {
      const parsed = await parseSampleCSV(sampleCSV)
      setData(parsed)
      const s = detectSchema(parsed)
      setSchema(s)
    })()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('dash_panels', JSON.stringify(panels))
  }, [panels])

  function handleUpload(parsedData) {
    setData(parsedData)
    setSchema(detectSchema(parsedData))
    setPanels([]) // reset panels on new data
  }

  function addPanel(panelDef) {
    setPanels((p) => [...p, { id: Date.now(), ...panelDef }])
  }

  function updatePanel(id, patch) {
    setPanels((ps) => ps.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  function removePanel(id) {
    setPanels((ps) => ps.filter(p => p.id !== id))
  }

  return (
    <div className="min-h-screen p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 card flex items-center justify-center">
            <div className="text-xl header-neon">DI</div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Data Intelligence Dashboard</h1>
            <p className="text-sm text-slate-300">Neo-futuristic, client-side analytics — upload, explore, export.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            className="px-3 py-2 card rounded-md"
            onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
          >
            Theme: {theme}
          </button>
          <button className="px-3 py-2 card rounded-md" onClick={() => {
            // quick export current dashboard as PNG
            const el = containerRef.current
            if (!el) return
            import('html2canvas').then(h2c => h2c.default(el)).then(canvas => {
              canvas.toBlob((blob) => {
                import('file-saver').then(fs => fs.saveAs(blob, 'dashboard.png'))
              })
            })
          }}>Export PNG</button>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-6">
        <aside className="col-span-3 space-y-4">
          <UploadPanel onUpload={handleUpload} sampleCSV={sampleCSV} />
          <FilterPanel schema={schema} data={data} onFilterChange={setFilters} />
          <InsightPanel data={data} schema={schema} />
          <div className="card p-3">
            <h3 className="font-semibold">Add Panel</h3>
            <div className="mt-2 grid gap-2">
              <button
                className="py-2 card rounded-md"
                onClick={() => addPanel({ type: 'chart', config: null })}
              >Add Chart</button>
              <button
                className="py-2 card rounded-md"
                onClick={() => addPanel({ type: 'map', config: null })}
              >Add India Map</button>
            </div>
          </div>
        </aside>

        <section className="col-span-9" ref={containerRef}>
          <div className="grid grid-cols-2 gap-4">
            {panels.length === 0 && (
              <div className="col-span-2 card p-6 text-center">
                <h3 className="text-xl font-semibold">No panels yet</h3>
                <p className="text-sm text-slate-300 mt-2">Use the left panel to upload data, add charts or maps. Sample data is preloaded.</p>
              </div>
            )}

            {panels.map(panel => (
              <div key={panel.id} className="card p-3">
                <div className="flex justify-between items-center mb-2">
                  <strong>{panel.type.toUpperCase()}</strong>
                  <div className="flex items-center gap-2">
                    <button className="text-sm px-2 py-1 card rounded" onClick={() => removePanel(panel.id)}>Remove</button>
                    <button className="text-sm px-2 py-1 card rounded" onClick={() => updatePanel(panel.id, { fullscreen: true })}>Fullscreen</button>
                  </div>
                </div>

                {panel.type === 'chart' && (
                  <ChartBuilder
                    data={data}
                    schema={schema}
                    panel={panel}
                    onSave={(config) => updatePanel(panel.id, { config })}
                  />
                )}

                {panel.type === 'map' && (
                  <MapPanel
                    data={data}
                    schema={schema}
                    geoJsonUrl="/india.geojson"
                    panel={panel}
                    onSave={(config) => updatePanel(panel.id, { config })}
                  />
                )}

                {panel.fullscreen && (
                  <div className="fullscreen-modal" onClick={() => updatePanel(panel.id, { fullscreen: false })}>
                    <div className="w-11/12 h-5/6 card p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-center">
                        <h3>{panel.type.toUpperCase()} — Fullscreen</h3>
                        <button className="card px-3 py-1" onClick={() => updatePanel(panel.id, { fullscreen: false })}>Close</button>
                      </div>
                      <div className="mt-4">
                        {panel.type === 'chart' && <ChartBuilder data={data} schema={schema} panel={panel} onSave={(c)=>updatePanel(panel.id, {config:c})} fullscreen />}
                        {panel.type === 'map' && <MapPanel data={data} schema={schema} geoJsonUrl="/india.geojson" panel={panel} onSave={(c)=>updatePanel(panel.id,{config:c})} fullscreen />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
