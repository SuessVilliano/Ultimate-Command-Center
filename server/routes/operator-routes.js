import * as ollama from '../lib/ollama-provider.js';
import { getCommanderPrompt } from '../lib/system-prompt.js';
import { CAPABILITIES, SOURCE_OF_TRUTH } from '../lib/capability-registry.js';

const PORT = () => process.env.PORT || 3005;
const MAX_TOOL_CONTEXT = 18000;

const DOMAIN_PATTERNS = {
  health: /\b(health|oura|apple health|heart|bpm|heart rate|hrv|sleep|readiness|recovery|stress|steps|activity|exercise|workout|spo2|oxygen|respiratory|weight|body fat)\b/i,
  trading: /\b(trad(e|ing)|signal|mnq|nq|nasdaq|qqe|regime|market cause|broker|position|pnl|performance|journal|setup|stop loss|take profit|ctrader)\b/i,
  nifty: /\b(nifty|project|projects|task|tasks|team|teammate|inbox|blocker|blocked|owner|ownership|message|messages|conversation)\b/i,
  calendar: /\b(calendar|schedule|meeting|appointment|availability|free time|today's events|today events|commitment)\b/i,
  ghl: /\b(ghl|gohighlevel|highlevel|crm|contact|contacts|pipeline|opportunity|opportunities|affiliate|partner|workflow)\b/i,
  github: /\b(github|repo|repository|code|pull request|\bpr\b|branch|commit|deploy|deployment|ci)\b/i,
};

const WRITE_RE = /\b(send|reply|post|publish|delete|archive|remove|move|assign|complete|close|cancel|schedule|book|create|update|edit|enroll|merge|deploy|place|execute|modify)\b/i;
const READ_RE = /\b(check|show|tell|what|how|summarize|summary|review|analyze|analyse|compare|find|read|look|status|latest|current|today|why)\b/i;

function detectDomains(message = '') {
  return Object.entries(DOMAIN_PATTERNS)
    .filter(([, re]) => re.test(message))
    .map(([domain]) => domain);
}

function looksLikeExternalWrite(message = '') {
  if (/\b(preview|dry run|draft|propose|plan)\b/i.test(message)) return false;
  return WRITE_RE.test(message) && !READ_RE.test(message.replace(WRITE_RE, ''));
}

function symbolFrom(message = '') {
  const m = message.toUpperCase().match(/\b(MNQ|NQ|ES|MES|BTC|ETH|SOL|GOLD|XAUUSD|EURUSD|GBPUSD)\b/);
  return m?.[1] || 'MNQ';
}

function clip(value, max = 6000) {
  let text;
  try { text = JSON.stringify(value); } catch { text = String(value); }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function internal(path, { method = 'GET', body } = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  let data;
  try { data = await res.json(); } catch { data = { text: await res.text().catch(() => '') }; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function tool(name, fn) {
  const started = Date.now();
  try {
    const data = await fn();
    return { name, ok: true, ms: Date.now() - started, data };
  } catch (error) {
    return { name, ok: false, ms: Date.now() - started, error: error?.message || 'Tool failed' };
  }
}

async function collectHealth() {
  const date = new Date().toISOString().slice(0, 10);
  return Promise.all([
    tool('apple_health.status', () => internal('/api/hs/health/apple/status')),
    tool('oura.snapshot', () => internal('/api/hs/health/oura/snapshot')),
    tool('health_os.snapshot', () => internal('/api/hs/health/snapshot')),
    tool('health_os.today', () => internal(`/api/hs/health/daily?date=${date}`)),
  ]);
}

async function collectTrading(message) {
  const symbol = symbolFrom(message);
  const jobs = [
    tool('hybrid_journal.status', () => internal('/api/trading/hybrid-journal/status')),
  ];

  if (/\b(signal|trade|position|latest|sync|journal)\b/i.test(message)) {
    jobs.push(tool('hybrid_journal.snapshot', () => internal('/api/trading/hybrid-journal/snapshot?limit=100')));
  }
  if (/\b(qqe|brief|briefing|setup|trade plan)\b/i.test(message)) {
    jobs.push(tool('hybrid_journal.qqe', () => internal('/api/trading/hybrid-journal/briefing', { method: 'POST', body: { symbol, use_bible: true } })));
  }
  if (/\b(regime|market cause|driving|why.*market|market.*why)\b/i.test(message)) {
    jobs.push(tool('hybrid_journal.regime', () => internal('/api/trading/hybrid-journal/regime', { method: 'POST', body: { symbol, action: 'analyze' } })));
  }
  if (/\b(performance|weekly|history|last .*trade|compare.*trade|analy[sz]e.*trade)\b/i.test(message)) {
    jobs.push(tool('hybrid_journal.performance', () => internal('/api/trading/hybrid-journal/analyze', { method: 'POST', body: { analysisType: 'weekly_summary' } })));
  }
  return Promise.all(jobs);
}

async function collectNifty(message) {
  const out = await Promise.all([
    tool('nifty.status', () => internal('/api/nifty/mcp/status')),
    tool('nifty.chats', () => internal('/api/nifty/mcp/chats?limit=12')),
    tool('nifty.projects', () => internal('/api/nifty/projects')),
  ]);

  const chatsResult = out.find(x => x.name === 'nifty.chats' && x.ok)?.data;
  const chats = chatsResult?.chats || [];
  if (/\b(team|message|messages|conversation|inbox|said|reply)\b/i.test(message) && chats.length) {
    const messageReads = chats.slice(0, 4).map(c =>
      tool(`nifty.chat.${c.id}`, () => internal(`/api/nifty/mcp/chats/${encodeURIComponent(c.id)}/messages?limit=20`))
    );
    out.push(...await Promise.all(messageReads));
  }
  return out;
}

async function collectCalendar() {
  return Promise.all([
    tool('calendar.today', () => internal('/api/calendar/today')),
    tool('calendar.upcoming', () => internal('/api/calendar/upcoming?hours=48')),
  ]);
}

async function collectGhl(message) {
  const jobs = [tool('integrations.status', () => internal('/api/integrations/status'))];
  if (/\b(contact|contacts|lead|leads)\b/i.test(message)) jobs.push(tool('ghl.contacts', () => internal('/api/ghl/contacts?limit=25')));
  if (/\b(pipeline|opportunit|crm|affiliate|partner)\b/i.test(message)) {
    jobs.push(tool('ghl.pipelines', () => internal('/api/ghl/pipelines')));
    jobs.push(tool('ghl.opportunities', () => internal('/api/ghl/opportunities')));
  }
  return Promise.all(jobs);
}

async function collectGithub(message) {
  const repoMatch = message.match(/(?:repo|repository)\s+([A-Za-z0-9_.-]+)/i);
  if (repoMatch?.[1]) {
    return [tool('github.repo_focus', () => internal('/api/intent', { method: 'POST', body: { intent: 'repo_focus', params: { repo: repoMatch[1] } } }))];
  }
  return [tool('github.capability', async () => ({ note: 'GitHub is available to the DevOps agent. Name a repository for a live repo-focused read.' }))];
}

async function collectTools(message, domains) {
  const groups = [];
  if (domains.includes('health')) groups.push(collectHealth());
  if (domains.includes('trading')) groups.push(collectTrading(message));
  if (domains.includes('nifty')) groups.push(collectNifty(message));
  if (domains.includes('calendar')) groups.push(collectCalendar());
  if (domains.includes('ghl')) groups.push(collectGhl(message));
  if (domains.includes('github')) groups.push(collectGithub(message));
  const nested = await Promise.all(groups);
  return nested.flat();
}

function toolContext(results) {
  const blocks = results.map(r => r.ok
    ? `TOOL ${r.name} (confirmed result):\n${clip(r.data)}`
    : `TOOL ${r.name} (unavailable): ${r.error}`);
  return blocks.join('\n\n').slice(0, MAX_TOOL_CONTEXT);
}

async function synthesize(message, domains, results) {
  const context = toolContext(results);
  const prompt = getCommanderPrompt(`\nREAL TOOL RESULTS FOR THIS REQUEST:\n${context}`);
  const result = await ollama.chat([{ role: 'user', content: message }], {
    systemPrompt: `${prompt}\n\nOPERATOR RESPONSE RULES:\n- Answer from confirmed tool results above.\n- Say which source you checked naturally when useful.\n- If a tool failed or is not configured, say that clearly.\n- Never imply a write occurred.\n- Keep the answer operational: what matters, what needs attention, and the best next move.`,
    maxTokens: 1000,
    temperature: 0.35,
  });
  return { response: result.text, provider: result.provider, model: result.model, domains };
}

function approvalResponse(message, domains) {
  return {
    response: `I understand the action you want. I’m holding the external write for approval rather than acting silently. I can still inspect the source system first, show you exactly what will change, then execute through its gated route.`,
    approvalRequired: true,
    proposedAction: { request: message, domains, policy: domains.includes('trading') ? 'live trading uses the dedicated confirmation gate' : 'external write requires explicit confirmation' },
    toolsUsed: [],
    provider: 'operator',
  };
}

export async function operate(message) {
  const domains = detectDomains(message);
  if (!domains.length) return null;

  if (looksLikeExternalWrite(message)) return approvalResponse(message, domains);

  const results = await collectTools(message, domains);
  const synthesized = await synthesize(message, domains, results);
  return {
    ...synthesized,
    operated: true,
    toolsUsed: results.map(r => ({ name: r.name, ok: r.ok, ms: r.ms, error: r.error || null })),
  };
}

function findRoute(app, path) {
  const stack = app?._router?.stack || [];
  return stack.find(layer => layer?.route?.path === path && layer.route.methods?.post)?.route || null;
}

function patchChatRoute(app, path) {
  const route = findRoute(app, path);
  if (!route?.stack?.length) return false;
  const layer = route.stack[0];
  if (layer.handle?.__liv8OperatorWrapped) return true;
  const original = layer.handle;

  const wrapped = async function liv8OperatorChat(req, res, next) {
    const message = req.body?.message || req.body?.prompt || '';
    if (!message) return original(req, res, next);
    try {
      const result = await operate(message);
      if (!result) return original(req, res, next);
      return res.json(result);
    } catch (error) {
      console.warn('[Juno Operator] tool loop failed; using original chat route:', error?.message || 'unknown');
      return original(req, res, next);
    }
  };
  wrapped.__liv8OperatorWrapped = true;
  layer.handle = wrapped;
  return true;
}

export function registerOperatorRoutes(app) {
  app.get('/api/commander/tools/status', async (req, res) => {
    const local = await ollama.status();
    res.json({
      ok: true,
      localAI: local,
      sourceOfTruth: SOURCE_OF_TRUTH,
      capabilities: CAPABILITIES,
      chatInterception: ['/api/chat', '/api/commander/chat'],
      policy: { safeReads: 'automatic', writes: 'approval_gated', liveTrading: 'dedicated_confirmation_gate' },
    });
  });

  app.post('/api/commander/operate', async (req, res) => {
    try {
      const message = req.body?.message || '';
      if (!message) return res.status(400).json({ error: 'message is required' });
      const result = await operate(message);
      if (!result) {
        const ai = await ollama.chat([{ role: 'user', content: message }], { systemPrompt: getCommanderPrompt(), maxTokens: 900 });
        return res.json({ response: ai.text, provider: ai.provider, model: ai.model, operated: false, toolsUsed: [] });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error?.message || 'Operator failed' });
    }
  });

  // registerNiftyRoutes is mounted late in server startup. Defer one tick so all
  // legacy chat routes exist, then wrap them without duplicating frontend code.
  setImmediate(() => {
    const chat = patchChatRoute(app, '/api/chat');
    const commander = patchChatRoute(app, '/api/commander/chat');
    console.log(`Juno Operator: ${chat ? 'chat wired' : 'chat route not found'} · ${commander ? 'commander wired' : 'commander route not found'}`);
  });
}

export default registerOperatorRoutes;
