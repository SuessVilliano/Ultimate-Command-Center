import crypto from 'node:crypto';

const pending = new Map();
const waiting = [];
let lastHeartbeat = null;
let worker = null;

const token = () => process.env.LIV8_MAC_BRIDGE_TOKEN || '';
const enabled = () => Boolean(token());
const authorized = req => {
  const auth = String(req.headers.authorization || '');
  return enabled() && (auth === `Bearer ${token()}` || String(req.headers['x-liv8-bridge-token'] || '') === token());
};

function dispatch(job) {
  const waiter = waiting.shift();
  if (waiter) waiter(job);
  else pending.set(job.id, job);
}

export function relayStatus() {
  const ageMs = lastHeartbeat ? Date.now() - new Date(lastHeartbeat).getTime() : null;
  return { configured: enabled(), connected: ageMs != null && ageMs < 30_000, lastHeartbeat, worker, pending: pending.size };
}

export function relayChat(payload, timeoutMs = 120_000) {
  if (!enabled()) throw new Error('LIV8_MAC_BRIDGE_TOKEN is not configured');
  if (!relayStatus().connected) throw new Error('Mac relay worker is offline');
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Mac relay timed out')); }, timeoutMs);
    dispatch({ id, type: 'chat', payload, createdAt: new Date().toISOString(), resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
  });
}

export function registerMacAiRelayRoutes(app) {
  app.post('/api/ai/mac-relay/heartbeat', (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    lastHeartbeat = new Date().toISOString(); worker = req.body?.worker || 'mac-mini';
    res.json({ ok: true, connected: true, serverTime: lastHeartbeat });
  });
  app.get('/api/ai/mac-relay/status', (_req, res) => res.json({ ok: true, ...relayStatus() }));
  app.get('/api/ai/mac-relay/claim', async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    lastHeartbeat = new Date().toISOString(); worker = req.headers['x-liv8-worker'] || 'mac-mini';
    const existing = [...pending.values()].find(x => !x.claimedAt);
    if (existing) { existing.claimedAt = new Date().toISOString(); return res.json({ job: { ...existing, resolve: undefined, reject: undefined } }); }
    const job = await new Promise(resolve => {
      const waiter=value=>{clearTimeout(timer);resolve(value)};
      const timer=setTimeout(()=>{const i=waiting.indexOf(waiter);if(i>=0)waiting.splice(i,1);resolve(null)},20_000);
      waiting.push(waiter);
    });
    if (job) { pending.set(job.id, job); job.claimedAt = new Date().toISOString(); }
    res.json({ job: job ? { ...job, resolve: undefined, reject: undefined } : null });
  });
  app.post('/api/ai/mac-relay/jobs/:id/complete', (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    const job = pending.get(req.params.id); if (!job) return res.status(404).json({ error: 'Job not found or expired' });
    pending.delete(req.params.id);
    if (req.body?.ok === false) job.reject(new Error(req.body?.error || 'Mac worker failed')); else job.resolve(req.body?.result || {});
    res.json({ ok: true });
  });
}
