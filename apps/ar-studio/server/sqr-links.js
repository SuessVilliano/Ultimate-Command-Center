// Additional SQR dynamic-link routes for AR Studio.
// Import and mount this router under /api/sqr alongside sqr.js when ready.
import express from 'express'

const router = express.Router()
const BASE = 'https://sqr.co/api'

function key(req, res, next) {
  if (!process.env.SQR_API_KEY) return res.status(503).json({error:'SQR_API_KEY is not configured'})
  next()
}

async function call(path, options={}) {
  const r = await fetch(`${BASE}${path}`, {
    ...options,
    headers:{Authorization:`Bearer ${process.env.SQR_API_KEY}`, Accept:'application/json', ...(options.headers||{})}
  })
  const text = await r.text()
  let data
  try { data = JSON.parse(text) } catch { data = {raw:text} }
  if (!r.ok) return {error:true,status:r.status,data}
  return {error:false,status:r.status,data}
}

router.post('/links', key, express.json({limit:'1mb'}), async (req,res) => {
  const {location_url, url, domain_id, project_id, utm_source, utm_medium, utm_campaign, password} = req.body || {}
  if (!location_url) return res.status(400).json({error:'location_url is required'})
  const form = new FormData()
  form.set('location_url', location_url)
  if (url) form.set('url', url)
  if (domain_id !== undefined && domain_id !== null) form.set('domain_id', String(domain_id))
  if (project_id) form.set('project_id', String(project_id))
  if (utm_source) form.set('utm_source', utm_source)
  if (utm_medium) form.set('utm_medium', utm_medium)
  if (utm_campaign) form.set('utm_campaign', utm_campaign)
  if (password) form.set('password', password)
  const out = await call('/links', {method:'POST',body:form})
  return res.status(out.error ? out.status : 200).json(out.data)
})

router.post('/links/:id', key, express.json({limit:'1mb'}), async (req,res) => {
  const form = new FormData()
  for (const [k,v] of Object.entries(req.body || {})) if (v !== undefined && v !== null) form.set(k, String(v))
  const out = await call(`/links/${encodeURIComponent(req.params.id)}`, {method:'POST',body:form})
  return res.status(out.error ? out.status : 200).json(out.data)
})

router.get('/domains', key, async (_req,res) => {
  const out = await call('/domains/?results_per_page=100')
  return res.status(out.error ? out.status : 200).json(out.data)
})

export default router
