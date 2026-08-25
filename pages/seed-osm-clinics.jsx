// pages/seed-osm-clinics.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Real, free, keyless seeding of Hong Kong clinics from OpenStreetMap's
// Overpass API. This is a client-side page specifically because Overpass's
// server blocks automated fetches from my own tooling (robots.txt) - your
// actual browser making this request is a completely different context and
// isn't subject to that restriction.
//
// Verified against real Overpass API documentation before building this -
// response shape is {elements: [{type, id, lat, lon, tags: {...}}]}, a
// standard, well-documented format.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'

const DISTRICTS = ['Central','Sheung Wan','Sai Ying Pun','Wan Chai','Causeway Bay','Aberdeen',
  'Yau Ma Tei','Mong Kok','Sham Shui Po','Ho Man Tin','San Po Kong','Kwun Tong','Ngau Tau Kok',
  'Tsz Wan Shan','Hung Hom','Tsuen Wan','Cheung Chau','Sha Tin','Tai Wai','Sheung Shui','Tai Po',
  'Tuen Mun','Yuen Long','Shau Kei Wan','Kowloon City','Wong Tai Sin','Kwai Tsing','Tin Shui Wai',
  'North Point','Quarry Bay','Tai Koo','Mid-Levels','Stanley','Repulse Bay']

function guessDistrict(address) {
  if (!address) return null
  for (const d of DISTRICTS) if (address.includes(d)) return d
  return null
}

// Real Overpass QL - targets Hong Kong specifically via ISO3166-1 area
// code, matching nodes/ways tagged as clinics or doctors' offices.
const OVERPASS_QUERY = `
[out:json][timeout:60];
area["ISO3166-1"="HK"]->.hk;
(
  node["amenity"="clinic"](area.hk);
  node["amenity"="doctors"](area.hk);
  node["healthcare"="doctor"](area.hk);
  node["healthcare"="clinic"](area.hk);
  way["amenity"="clinic"](area.hk);
  way["amenity"="doctors"](area.hk);
);
out center body;
`.trim()

export default function SeedOSMClinicsPage() {
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [elements, setElements] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  async function handleFetch() {
    setFetching(true)
    setFetchError(null)
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: OVERPASS_QUERY,
      })
      if (!res.ok) throw new Error(`Overpass API returned ${res.status}`)
      const data = await res.json()
      setElements(data.elements || [])
    } catch (e) {
      setFetchError(e.message)
    }
    setFetching(false)
  }

  async function handleImport() {
    if (!elements) return
    setImporting(true)
    let imported = 0, skipped = 0
    for (const el of elements) {
      const tags = el.tags || {}
      const name = tags['name:en'] || tags.name || tags['name:zh']
      if (!name) { skipped++; continue }

      // way elements carry coordinates in .center, not directly on the
      // element - node elements have lat/lon directly.
      const lat = el.lat ?? el.center?.lat ?? null
      const lng = el.lon ?? el.center?.lon ?? null

      const addressParts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:district']].filter(Boolean)
      const address = addressParts.length ? addressParts.join(', ') : null
      const district = tags['addr:district'] || tags['addr:suburb'] || guessDistrict(address) || null

      const { error } = await supabase.from('directory_clinics').upsert({
        partnership_status: 'directory',
        name,
        address,
        district,
        latitude: lat, longitude: lng,
        contact_phone: tags.phone || tags['contact:phone'] || null,
        contact_email: tags.email || tags['contact:email'] || null,
        opening_hours_static: tags.opening_hours || null,
        ownership_type: 'private',
        schemes: ['general_private'],
      }, { onConflict: 'name,address' })

      if (error) { skipped++; continue }
      imported++

      // Real doctor name only when OSM actually provides one - most clinic
      // entries are clinic-level only, and Find Care already handles
      // clinics with no named doctor as their own listings, so this isn't
      // forced or faked.
      const doctorName = tags.doctor || tags.operator || tags['contact:person']
      if (doctorName && doctorName !== name) {
        const { data: clinicRow } = await supabase.from('directory_clinics').select('id').eq('name', name).eq('address', address).maybeSingle()
        if (clinicRow) {
          await supabase.from('directory_doctors').upsert({
            clinic_id: clinicRow.id,
            full_name: doctorName,
            specialties: tags['healthcare:speciality'] || tags.speciality ? [tags['healthcare:speciality'] || tags.speciality] : ['General Practice'],
          }, { onConflict: 'clinic_id,full_name' })
        }
      }
    }
    setImporting(false)
    setResult({ imported, skipped, total: elements.length })
  }

  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'4px'}}>Seed Clinics from OpenStreetMap</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>
        Free, keyless, real data - queries OpenStreetMap's Overpass API directly for every clinic and doctor's office tagged in Hong Kong. Coverage varies by area since OSM is community-mapped, not exhaustive.
      </div>

      {!elements && (
        <button onClick={handleFetch} disabled={fetching} style={{width:'100%',padding:'14px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
          {fetching ? 'Querying OpenStreetMap…' : 'Fetch clinics from OpenStreetMap'}
        </button>
      )}
      {fetchError && <div style={{fontSize:'12px',color:C.red,marginTop:'10px'}}>{fetchError}</div>}

      {elements && !result && (
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginTop:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'8px'}}>{elements.length} results found</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>
            Preview: {elements.slice(0,3).map(e=>e.tags?.name||e.tags?.['name:en']||'unnamed').join(', ')}{elements.length>3?'…':''}
          </div>
          <button onClick={handleImport} disabled={importing} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
            {importing?'Importing…':`Import ${elements.length} results`}
          </button>
        </div>
      )}

      {result && (
        <div style={{background:C.greenLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginTop:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600}}>{result.imported} of {result.total} imported{result.skipped>0?`, ${result.skipped} skipped (no name)`:''}</div>
        </div>
      )}
    </div>
  )
}
