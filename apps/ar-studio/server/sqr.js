import express from 'express'

const router = express.Router()
const SQR_BASE = 'https://sqr.co/api'

function requireKey(req, res, next) {
  if (!process.env.SQR_API_KEY) return res.status(503).json({error:'SQR_API_KEY is not configured'})
  next()
}

async function sqr(path, options = {}) {
  const response = await fetch(`${SQR_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.SQR_API_KEY}`,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  })
  const body = await response.text()
  let data
  try { data = JSON.parse(body) } catch { data = {raw: body} }
  if (!response.ok) {
    const err = new Error(`SQR ${response.status}`)
    err.status = response.status
    err.data = data
    throw err
  }
  return data
}

router.get('/health', (_req, res) => {
  res.json({configured: Boolean(process.env.SQR_API_KEY)})
})

router.get('/qr-codes', requireKey, async (req, res) => {
  try {
    const page = encodeURIComponent(req.query.page || '1')
    const per = encodeURIComponent(req.query.results_per_page || '25')
    res.json(await sqr(`/qr-codes/?page=${page}&results_per_page=${per}`))
  } catch (e) { res.status(e.status || 500).json(e.data || {error:e.message}) }
})

router.get('/links', requireKey, async (req, res) => {
  try {
    const page = encodeURIComponent(req.query.page || '1')
    const per = encodeURIComponent(req.query.results_per_page || '25')
    res.json(await sqr(`/links/?page=${page}&results_per_page=${per}`))
  } catch (e) { res.status(e.status || 500).json(e.data || {error:e.message}) }
})

router.post('/qr-codes', requireKey, express.json({limit:'1mb'}), async (req, res) => {
  try {
    const {name, url, link_id, project_id, style='rounded', foreground_color='#000000', background_color='#ffffff'} = req.body || {}
    if (!name || (!url && !link_id)) return res.status(400).json({error:'name and either url or link_id are required'})
    const form = new FormData()
    form.set('name', name)
    form.set('type', 'url')
    form.set('style', style)
    form.set('foreground_type', 'color')
    form.set('foreground_color', foreground_color)
    form.set('background_color', background_color)
    if (url) form.set('url', url)
    if (link_id) form.set('link_id', String(link_id))
    if (project_id) form.set('project_id', String(project_id))
    res.json(await sqr('/qr-codes', {method:'POST', body:form}))
  } catch (e) { res.status(e.status || 500).json(e.data || {error:e.message}) }
})

export default router
