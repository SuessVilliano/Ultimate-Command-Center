import express from 'express'
import cors from 'cors'
import sqrRouter from './sqr.js'
import sqrLinksRouter from './sqr-links.js'
import {addEvent, claim, getScene, listScenes, saveScene} from './store.js'

const app=express(); const port=Number(process.env.AR_API_PORT||8787)
app.use(cors({origin:true})); app.use(express.json({limit:'2mb'}))
app.use('/api/sqr',sqrRouter); app.use('/api/sqr',sqrLinksRouter)

const SQR='https://sqr.co/api'
async function sqr(path,options={}){
  if(!process.env.SQR_API_KEY) throw Object.assign(new Error('SQR_API_KEY is not configured'),{status:503})
  const r=await fetch(`${SQR}${path}`,{...options,headers:{Authorization:`Bearer ${process.env.SQR_API_KEY}`,Accept:'application/json',...(options.headers||{})}})
  const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={raw:text}}
  if(!r.ok) throw Object.assign(new Error(`SQR ${r.status}`),{status:r.status,data})
  return data
}
function form(obj){ const f=new FormData(); for(const [k,v] of Object.entries(obj)) if(v!==undefined&&v!==null&&v!=='') f.set(k,String(v)); return f }

app.get('/api/ar/health',(_req,res)=>res.json({ok:true,sqrConfigured:Boolean(process.env.SQR_API_KEY),domainId:process.env.SQR_DOMAIN_ID||null,projectId:process.env.SQR_PROJECT_ID||null}))
app.get('/api/ar/scenes',(_req,res)=>res.json({data:listScenes()}))
app.get('/api/ar/scenes/:id',(req,res)=>{const s=getScene(req.params.id); if(!s)return res.status(404).json({error:'Scene not found'}); res.json({data:s})})
app.post('/api/ar/scenes',(req,res)=>res.json({data:saveScene(req.body||{})}))
app.post('/api/ar/events',(req,res)=>{const {sceneId,type,meta={}}=req.body||{}; if(!sceneId||!type)return res.status(400).json({error:'sceneId and type required'}); addEvent({sceneId,type,meta}); res.status(202).json({ok:true})})
app.post('/api/ar/scenes/:id/claim',(req,res)=>{const scene=getScene(req.params.id); if(!scene)return res.status(404).json({error:'Scene not found'}); const token=String(req.body?.token||'').slice(0,200); if(!token)return res.status(400).json({error:'token required'}); const result=claim(scene.id,token,Number(scene.claimLimit||0)); res.status(result.ok?200:409).json(result)})

app.post('/api/ar/publish',async(req,res)=>{
  try{
    const scene=req.body?.scene
    if(!scene?.title||!scene?.slug||!scene?.publicUrl) return res.status(400).json({error:'scene title, slug and publicUrl are required'})
    if(!/^https:\/\//i.test(scene.publicUrl)) return res.status(400).json({error:'publicUrl must be HTTPS'})
    const saved=saveScene({...scene,status:'publishing'})
    const linkBody={location_url:scene.publicUrl,url:scene.slug,domain_id:req.body.domainId??process.env.SQR_DOMAIN_ID,project_id:req.body.projectId??process.env.SQR_PROJECT_ID,utm_source:'liv8-ar',utm_medium:'qr',utm_campaign:scene.slug,http_status_code:302,forward_query_parameters_is_enabled:true}
    let link
    if(saved.sqr?.linkId){ link=await sqr(`/links/${encodeURIComponent(saved.sqr.linkId)}`,{method:'POST',body:form(linkBody)}) }
    else { link=await sqr('/links',{method:'POST',body:form(linkBody)}) }
    const linkData=link.data||link; const linkId=linkData.id||saved.sqr?.linkId
    const qrBody=new FormData(); qrBody.set('name',scene.title); qrBody.set('type','url'); qrBody.set('link_id',String(linkId)); qrBody.set('style',req.body.qrStyle||'rounded'); qrBody.set('foreground_type','color'); qrBody.set('foreground_color',req.body.foregroundColor||'#111827'); qrBody.set('background_color',req.body.backgroundColor||'#ffffff'); if(linkBody.project_id) qrBody.set('project_id',String(linkBody.project_id))
    const qr=await sqr('/qr-codes',{method:'POST',body:qrBody}); const qrData=qr.data||qr
    let qrDetail=qrData
    if(qrData.id){ try{const d=await sqr(`/qr-codes/${encodeURIComponent(qrData.id)}`); qrDetail=d.data||d}catch{} }
    const final=saveScene({...saved,status:'published',sqr:{linkId,qrId:qrData.id||null,shortUrl:linkData.short_url||linkData.url||null,qrUrl:qrDetail.qr_code||null,domainId:linkBody.domain_id||null,projectId:linkBody.project_id||null}})
    res.json({data:final})
  }catch(e){res.status(e.status||500).json(e.data||{error:e.message})}
})

app.use((err,_req,res,_next)=>res.status(500).json({error:err.message||'Server error'}))
app.listen(port,()=>console.log(`LIV8 AR Studio API listening on :${port}`))
