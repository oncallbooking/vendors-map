import React, { useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { detectSchema } from '../utils/dataProcessor'

export default function UploadPanel({ onUpload, sampleCSV }) {
  const fileRef = useRef()

  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const name = f.name.toLowerCase()
    if (name.endsWith('.csv')) {
      Papa.parse(f, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (res) => {
          onUpload(res.data)
        }
      })
    } else if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
      const data = await f.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: null })
      onUpload(json)
    } else if (name.endsWith('.json')) {
      const text = await f.text()
      const parsed = JSON.parse(text)
      // array or keyed object
      onUpload(Array.isArray(parsed) ? parsed : [parsed])
    } else {
      alert('Unsupported file type. Use CSV, XLSX or JSON.')
    }
  }

  function loadSample() {
    // sampleCSV is raw text (imported)
    Papa.parse(sampleCSV, { header: true, dynamicTyping: true, complete: (res) => onUpload(res.data) })
  }

  return (
    <div className="card p-3">
      <h3 className="font-semibold">Upload Data</h3>
      <p className="text-sm text-slate-300">CSV, XLSX, JSON supported. We'll auto-detect types.</p>
      <div className="mt-3 space-y-2">
        <input ref={fileRef} type="file" onChange={handleFile} className="w-full" />
        <button className="w-full py-2 card rounded" onClick={loadSample}>Load Sample Data</button>
      </div>
    </div>
  )
}
