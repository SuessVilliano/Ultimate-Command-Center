import React, {useEffect, useMemo, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import '@google/model-viewer'
import QRCode from 'qrcode'
import './styles.css'

const MAX_FILES = 20
const MAX_TOTAL_BYTES = 100 * 1024 * 1024

const defaultSettings = {
  scale: 1,
  yaw: 0,
  autoplay: true,
  autoRotate: false,
  shadow: 1,
  exposure: 1,
  arScale: 'auto',
}

function bytes(n) {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

function getSharedState() {
  const p = new URLSearchParams(location.search)
  const src = p.get('src')
  if (!src) return null
  return {
    src,
    name: p.get('name') || 'Shared AR object',
    settings: {
      scale: Number(p.get('scale') || 1),
      yaw: Number(p.get('yaw') || 0),
      autoplay: p.get('autoplay') !== '0',
      autoRotate: p.get('spin') === '1',
      shadow: Number(p.get('shadow') || 1),
      exposure: Number(p.get('exposure') || 1),
      arScale: p.get('arscale') || 'auto',
    }
  }
}

function App() {
  const shared = useMemo(getSharedState, [])
  const [assets, setAssets] = useState(shared ? [{name: shared.name, url: shared.src, remote: true, size: 0}] : [])
  const [activeIndex, setActiveIndex] = useState(0)
  const [remoteUrl, setRemoteUrl] = useState(shared?.src || '')
  const [settings, setSettings] = useState(shared?.settings || defaultSettings)
  const [qr, setQr] = useState('')
  const [notice, setNotice] = useState(shared ? 'Shared AR experience loaded.' : '')
  const viewerRef = useRef(null)
  const active = assets[activeIndex]

  useEffect(() => () => assets.forEach(a => { if (!a.remote && a.url?.startsWith('blob:')) URL.revokeObjectURL(a.url) }), [])

  const total = assets.reduce((sum, a) => sum + (a.size || 0), 0)

  async function makeQr(url) {
    setQr(await QRCode.toDataURL(url, {width: 360, margin: 1, errorCorrectionLevel: 'M'}))
  }

  function addFiles(fileList) {
    const incoming = [...fileList].filter(f => /\.(glb|gltf)$/i.test(f.name))
    const nextTotal = total + incoming.reduce((s, f) => s + f.size, 0)
    if (assets.length + incoming.length > MAX_FILES) {
      setNotice(`Limit is ${MAX_FILES} files per scene in this MVP.`)
      return
    }
    if (nextTotal > MAX_TOTAL_BYTES) {
      setNotice('Keep total local scene assets under 100 MB for reliable mobile AR performance.')
      return
    }
    const mapped = incoming.map(f => ({name: f.name, url: URL.createObjectURL(f), size: f.size, remote: false}))
    if (!mapped.length) {
      setNotice('Drop .GLB or .GLTF files for 3D AR. Video/image planes are next in the pipeline.')
      return
    }
    setAssets(prev => [...prev, ...mapped])
    setActiveIndex(assets.length)
    setNotice(`${mapped.length} model${mapped.length > 1 ? 's' : ''} added. Local uploads preview on this device; publish with a public HTTPS asset URL to make the QR shareable.`)
  }

  function addRemote() {
    try {
      const u = new URL(remoteUrl)
      if (u.protocol !== 'https:') throw new Error()
      const item = {name: u.pathname.split('/').pop() || 'Remote model', url: u.href, size: 0, remote: true}
      setAssets(prev => [...prev, item].slice(-MAX_FILES))
      setActiveIndex(Math.min(assets.length, MAX_FILES - 1))
      setNotice('Remote model added. This one can be shared by QR across devices.')
    } catch {
      setNotice('Use a public HTTPS URL that points directly to a .glb or .gltf file.')
    }
  }

  async function publishQr() {
    if (!active) return setNotice('Add a model first.')
    if (!active.remote) return setNotice('Local blob files cannot travel through a QR. Add the same model from a public HTTPS URL, or connect object storage in the production phase.')
    const url = new URL(location.origin + location.pathname)
    url.searchParams.set('src', active.url)
    url.searchParams.set('name', active.name)
    url.searchParams.set('scale', settings.scale)
    url.searchParams.set('yaw', settings.yaw)
    url.searchParams.set('autoplay', settings.autoplay ? '1' : '0')
    url.searchParams.set('spin', settings.autoRotate ? '1' : '0')
    url.searchParams.set('shadow', settings.shadow)
    url.searchParams.set('exposure', settings.exposure)
    url.searchParams.set('arscale', settings.arScale)
    await makeQr(url.toString())
    setNotice('QR generated. Scan it on a phone, then tap “View in AR.”')
  }

  function patch(key, value) { setSettings(s => ({...s, [key]: value})) }

  if (shared && innerWidth < 900) {
    return <main className="viewerOnly">
      <div className="viewerTop"><strong>{shared.name}</strong><span>Move your phone, then tap AR.</span></div>
      <model-viewer
        ref={viewerRef}
        src={shared.src}
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-scale={settings.arScale}
        camera-controls
        touch-action="pan-y"
        auto-rotate={settings.autoRotate || undefined}
        autoplay={settings.autoplay || undefined}
        shadow-intensity={settings.shadow}
        exposure={settings.exposure}
        orientation={`0deg ${settings.yaw}deg 0deg`}
        scale={`${settings.scale} ${settings.scale} ${settings.scale}`}
      >
        <button slot="ar-button" className="arButton">View in AR</button>
        <div className="hint">Drag to rotate • pinch to zoom • AR lets you place it in the room</div>
      </model-viewer>
    </main>
  }

  return <main className="app">
    <header>
      <div><span className="eyebrow">LIV8 LABS</span><h1>AR Studio</h1><p>Drop a 3D object, tune it, generate a QR, then place it in the real world from a phone.</p></div>
      <div className="badge">WebAR • No app required</div>
    </header>

    <section className="grid">
      <aside className="panel controls">
        <h2>1. Add assets</h2>
        <label className="drop" onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); addFiles(e.dataTransfer.files)}}>
          <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" multiple onChange={e => addFiles(e.target.files)} />
          <b>Drop GLB / GLTF here</b><span>Up to {MAX_FILES} files • {bytes(MAX_TOTAL_BYTES)} total</span>
        </label>
        <div className="or">or use a published model URL</div>
        <div className="row"><input value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="https://.../character.glb"/><button onClick={addRemote}>Add</button></div>

        <h2>2. Scene controls</h2>
        <Control label="Size" value={settings.scale} min=.1 max=5 step=.1 onChange={v => patch('scale', v)} />
        <Control label="Rotation" value={settings.yaw} min={-180} max={180} step={1} suffix="°" onChange={v => patch('yaw', v)} />
        <Control label="Shadow" value={settings.shadow} min={0} max={2} step=.1 onChange={v => patch('shadow', v)} />
        <Control label="Exposure" value={settings.exposure} min={.2} max={2} step=.1 onChange={v => patch('exposure', v)} />
        <label className="toggle"><input type="checkbox" checked={settings.autoRotate} onChange={e => patch('autoRotate', e.target.checked)}/><span>Auto spin</span></label>
        <label className="toggle"><input type="checkbox" checked={settings.autoplay} onChange={e => patch('autoplay', e.target.checked)}/><span>Play built-in animation</span></label>
        <label className="selectLabel">AR scaling<select value={settings.arScale} onChange={e => patch('arScale', e.target.value)}><option value="auto">Pinch resize allowed</option><option value="fixed">Lock real-world size</option></select></label>

        <h2>3. Publish</h2>
        <button className="primary" onClick={publishQr}>Generate scan-to-AR QR</button>
        {qr && <div className="qr"><img src={qr}/><span>Scan with the phone camera</span></div>}
        {notice && <div className="notice">{notice}</div>}
      </aside>

      <section className="panel stage">
        <div className="stageTop"><div><b>{active?.name || 'No model loaded'}</b><span>{active ? (active.remote ? 'Shareable URL' : `${bytes(active.size)} • local preview`) : 'Add a GLB to begin'}</span></div>{active && <button className="ghost" onClick={() => viewerRef.current?.activateAR?.()}>Open AR</button>}</div>
        {active ? <model-viewer ref={viewerRef} key={active.url} src={active.url} ar ar-modes="webxr scene-viewer quick-look" ar-scale={settings.arScale} camera-controls touch-action="pan-y" auto-rotate={settings.autoRotate || undefined} autoplay={settings.autoplay || undefined} shadow-intensity={settings.shadow} exposure={settings.exposure} orientation={`0deg ${settings.yaw}deg 0deg`} scale={`${settings.scale} ${settings.scale} ${settings.scale}`}>
          <button slot="ar-button" className="arButton">View in AR</button>
          <div className="hint">Drag to rotate • pinch to zoom • tap AR to place in your room</div>
        </model-viewer> : <div className="empty"><div className="cube">◈</div><h3>Your character goes here</h3><p>Roblox/Minecraft/Pokémon-style characters work best after export or conversion to GLB.</p></div>}
        {!!assets.length && <div className="assetStrip">{assets.map((a, i) => <button className={i === activeIndex ? 'active' : ''} key={a.url} onClick={() => setActiveIndex(i)}><span>{i + 1}</span>{a.name}</button>)}</div>}
      </section>
    </section>

    <section className="capabilities panel"><b>Platform direction:</b><span>QR launch</span><span>3D placement</span><span>drag / rotate / pinch scale</span><span>animation playback</span><span>location unlocks</span><span>image-target triggers</span><span>video memorials</span><span>collectibles / sweepstakes</span></section>
  </main>
}

function Control({label, value, min, max, step, suffix='', onChange}) {
  return <label className="control"><div><span>{label}</span><output>{value}{suffix}</output></div><input type="range" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))}/></label>
}

createRoot(document.getElementById('root')).render(<App />)
