// pages/csv-import.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Clinic-facing tool: upload a CSV export from their existing system,
// Medsa parses it and inserts matched records automatically.
// No integration required from the clinic's software — just a file they
// already know how to export.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { parseCSV, importRecords } from '../lib/csvImport'

const C = {
  green:'#4a7c59', greenLight:'#e8f2ea', greenXLight:'#f2f8f4',
  beige:'#f0ede8', cream:'#faf8f5', card:'#f0ede8',
  text:'#1a1a1a', textSub:'#6b6560', textMuted:'#9c9690',
  border:'#e5e0d8', red:'#c0392b', redLight:'#fbeae8',
  amber:'#d4a017', amberLight:'#fbf3e0',
}

export default function CSVImportPage() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setResults(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { headers, rows } = parseCSV(ev.target.result)
        setPreview({ headers, rows, count: rows.length })
      } catch (err) {
        setError('Could not read this file. Make sure it is a valid CSV export.')
      }
    }
    reader.readAsText(f)
  }

  async function handleImport() {
    if (!preview) return
    setImporting(true)
    setError(null)
    try {
      const result = await importRecords(preview.rows)
      setResults(result)
    } catch (err) {
      setError('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.beige, padding:'24px 16px', maxWidth:600, margin:'0 auto', fontFamily:'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'20px', fontWeight:700, color:C.text, marginBottom:'6px' }}>Import records from your clinic system</h1>
        <p style={{ fontSize:'13px', color:C.textSub, lineHeight:1.6 }}>
          Export a CSV from your existing clinic software — no changes to your system required. Medsa reads the file and matches it to existing patient profiles automatically.
        </p>
      </div>

      <div style={{ background:C.greenXLight, border:`0.5px solid ${C.greenLight}`, borderRadius:'12px', padding:'14px 16px', marginBottom:'20px' }}>
        <div style={{ fontSize:'12px', fontWeight:600, color:C.green, marginBottom:'6px' }}>Expected columns (any order)</div>
        <div style={{ fontSize:'11px', color:C.textSub, lineHeight:1.7, fontFamily:'monospace' }}>
          patient_medsa_id (or patient_hkid, or patient_name + patient_dob)<br/>
          record_type · title · department · notes · diagnosis · date_of_record · institution_name
        </div>
      </div>

      <div style={{ background:C.cream, border:`1.5px dashed ${C.border}`, borderRadius:'14px', padding:'28px 20px', textAlign:'center', marginBottom:'16px' }}>
        <input type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }} id="csv-upload" />
        <label htmlFor="csv-upload" style={{ cursor:'pointer' }}>
          <div style={{ fontSize:'32px', color:C.green, marginBottom:'10px' }}>◈</div>
          <div style={{ fontSize:'14px', fontWeight:500, color:C.text, marginBottom:'4px' }}>
            {file ? file.name : 'Click to select CSV file'}
          </div>
          <div style={{ fontSize:'12px', color:C.textMuted }}>Or drag and drop</div>
        </label>
      </div>

      {error && (
        <div style={{ background:C.redLight, border:`0.5px solid ${C.red}`, borderRadius:'10px', padding:'12px 14px', marginBottom:'16px', fontSize:'13px', color:C.red }}>
          {error}
        </div>
      )}

      {preview && !results && (
        <div style={{ background:C.card, borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ fontSize:'13px', fontWeight:600, marginBottom:'10px' }}>
            Preview — {preview.count} row{preview.count !== 1 ? 's' : ''} found
          </div>
          <div style={{ fontSize:'11px', color:C.textSub, marginBottom:'10px' }}>
            Columns detected: {preview.headers.join(', ')}
          </div>
          <div style={{ overflowX:'auto', background:'#fff', borderRadius:'8px', border:`0.5px solid ${C.border}` }}>
            <table style={{ width:'100%', fontSize:'11px', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {preview.headers.map(h => (
                    <th key={h} style={{ padding:'6px 8px', textAlign:'left', borderBottom:`1px solid ${C.border}`, color:C.textSub, fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 3).map((row, i) => (
                  <tr key={i}>
                    {preview.headers.map(h => (
                      <td key={h} style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}`, whiteSpace:'nowrap', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis' }}>{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.count > 3 && (
            <div style={{ fontSize:'11px', color:C.textMuted, marginTop:'8px', textAlign:'center' }}>
              + {preview.count - 3} more rows
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              width:'100%', marginTop:'16px', padding:'12px', border:'none', borderRadius:'10px',
              background:C.green, color:'#fff', fontSize:'14px', fontWeight:600,
              cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1,
            }}
          >
            {importing ? 'Importing…' : `Import ${preview.count} records`}
          </button>
        </div>
      )}

      {results && (
        <div style={{ background: results.errors.length ? C.amberLight : C.greenXLight, border:`0.5px solid ${results.errors.length ? C.amber : C.green}`, borderRadius:'12px', padding:'16px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, marginBottom:'8px', color: results.errors.length ? C.amber : C.green }}>
            ✓ Import complete
          </div>
          <div style={{ fontSize:'13px', color:C.text, marginBottom:'10px' }}>
            {results.imported} of {results.total} records imported successfully.
            {results.skipped > 0 && ` ${results.skipped} skipped (patient not found in Medsa).`}
          </div>
          {results.errors.length > 0 && (
            <div style={{ background:'#fff', borderRadius:'8px', padding:'10px', maxHeight:150, overflowY:'auto' }}>
              {results.errors.map((err, i) => (
                <div key={i} style={{ fontSize:'11px', color:C.textSub, padding:'3px 0', borderBottom: i < results.errors.length - 1 ? `0.5px solid ${C.border}` : 'none' }}>
                  {err}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => { setFile(null); setPreview(null); setResults(null) }}
            style={{ width:'100%', marginTop:'14px', padding:'10px', border:`0.5px solid ${C.border}`, borderRadius:'10px', background:'#fff', fontSize:'13px', cursor:'pointer' }}
          >
            Import another file
          </button>
        </div>
      )}

      <div style={{ marginTop:'20px', fontSize:'11px', color:C.textMuted, lineHeight:1.6, textAlign:'center' }}>
        Records are matched to existing Medsa patient profiles by Medsa ID, HKID, or name + date of birth. Unmatched rows are skipped and listed above — no data is created for patients not already on Medsa.
      </div>
    </div>
  )
}
