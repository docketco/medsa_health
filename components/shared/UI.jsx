import { useState } from 'react'
import C from './colours'

export function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base = { border:'none', borderRadius:'10px', padding:'10px 16px', fontSize:'13px', fontWeight:500, cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity:disabled?0.5:1, ...sx }
  const V = { primary:{background:C.green,color:'#fff'}, secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`}, danger:{background:C.red,color:'#fff'}, amber:{background:C.amber,color:'#fff'}, navy:{background:C.navy,color:'#fff'}, purple:{background:C.purple,color:'#fff'}, ghost:{background:'transparent',color:C.green,border:`0.5px solid ${C.green}`} }
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}

export function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{ background:C.cream, border:`0.5px solid ${C.border}`, borderRadius:'14px', margin:'0 16px 10px', overflow:'hidden', cursor:onClick?'pointer':'default', ...sx }}>{children}</div>
}

export function SecLabel({ children }) {
  return <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.9px', color:C.textMuted, padding:'16px 16px 8px' }}>{children}</div>
}

export function Toggle({ checked=false, onChange }) {
  const [on,setOn] = useState(checked)
  return (
    <div onClick={()=>{setOn(!on);onChange&&onChange(!on)}} style={{ width:34, height:18, borderRadius:20, background:on?C.green:C.border, cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:2, left:on?16:2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }}/>
    </div>
  )
}

export function InfoRow({ label, value, highlight=false, last=false }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'8px 0', borderBottom:last?'none':`0.5px solid ${C.border}`, fontSize:'13px' }}>
      <span style={{ color:C.textSub, flexShrink:0, marginRight:'12px' }}>{label}</span>
      <span style={{ fontWeight:500, color:highlight?C.red:C.text, textAlign:'right', maxWidth:'60%' }}>{value}</span>
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.cream, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:440, padding:'24px 24px 32px', maxHeight:'88vh', overflowY:'auto' }}>
        {title && <div style={{ fontSize:'17px', fontWeight:700, marginBottom:'16px', color:C.text }}>{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function Badge({ text, type }) {
  const map = { ok:[C.greenLight,C.green], due:[C.amberLight,C.amber], full:[C.redLight,C.red] }
  const [bg,fg] = map[type]||map.ok
  return <span style={{ fontSize:'10px', background:bg, color:fg, padding:'3px 9px', borderRadius:'20px', fontWeight:500 }}>{text}</span>
}

export function Tag({ children, color='green' }) {
  const map = { green:[C.greenLight,C.green], brown:[C.brownLight,C.brown], blue:[C.blueLight,C.blue], grey:[C.card,C.textSub] }
  const [bg,fg] = map[color]||map.green
  return <span style={{ fontSize:'10px', background:bg, color:fg, padding:'3px 9px', borderRadius:'20px', fontWeight:500, whiteSpace:'nowrap' }}>{children}</span>
}
