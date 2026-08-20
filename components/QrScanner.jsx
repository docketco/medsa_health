import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import C from '../shared/colours'

// Real QR scanner - requests camera access, continuously captures frames
// to a hidden canvas, and decodes each one. Calls onScan(text) once with
// whatever the QR encodes, then stops. Requires `npm install jsqr`.
export default function QrScanner({ onScan, onCancel }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let rafId
    let stopped = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        tick()
      } catch (e) {
        setError('Could not access the camera. Check your browser permissions and try again.')
      }
    }

    function tick() {
      if (stopped) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code && code.data) {
          stopped = true
          streamRef.current?.getTracks().forEach(t => t.stop())
          onScan(code.data)
          return
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    start()
    return () => {
      stopped = true
      if (rafId) cancelAnimationFrame(rafId)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [onScan])

  return (
    <div style={{textAlign:'center'}}>
      {error ? (
        <div style={{color:C.red,fontSize:'13px',marginBottom:'14px'}}>{error}</div>
      ) : (
        <video ref={videoRef} muted playsInline style={{width:'100%',maxWidth:320,borderRadius:'12px',background:'#000'}}/>
      )}
      <canvas ref={canvasRef} style={{display:'none'}}/>
      <div style={{fontSize:'12px',color:C.textSub,marginTop:'10px'}}>Point the camera at the patient's Medsa QR code.</div>
      <button onClick={onCancel} style={{marginTop:'14px',fontSize:'13px',color:C.textSub,background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Cancel</button>
    </div>
  )
}
