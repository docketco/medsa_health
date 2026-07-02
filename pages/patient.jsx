if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0ede8', gap:'16px' }}>
      <div style={{ width:48, height:48, border:'3px solid #ddeae1', borderTop:'3px solid #4a7c59', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
      <div style={{ fontSize:'14px', color:'#6b6560' }}>Loading your health passport…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0ede8', gap:'12px', padding:'24px' }}>
      <div style={{ fontSize:'32px' }}>◎</div>
      <div style={{ fontSize:'16px', fontWeight:600 }}>Connection error</div>
      <div style={{ fontSize:'13px', color:'#6b6560', textAlign:'center', lineHeight:1.6 }}>Could not connect to Medsa servers. Please check your connection and try again.</div>
      <button onClick={()=>window.location.reload()} style={{ background:'#4a7c59', color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontSize:'13px', cursor:'pointer' }}>Try again</button>
    </div>
  )

  return <PatientApp liveData={data} />
}
