import * as journal from '../lib/life-journal-db.js';

const RULES = [
  ['food', /\b(i (ate|had|drank|eaten)|breakfast|lunch|dinner|snack|meal|calorie|protein|carbs|fat grams?)\b/i],
  ['mood', /\b(i feel|feeling|mood|sad|down|happy|great|angry|irritable|anxious|overwhelmed|calm|lonely|excited)\b/i],
  ['stress', /\b(stress|stressed|pressure|overwhelmed|tense)\b/i],
  ['energy', /\b(tired|exhausted|drained|energy|energized|fatigue|sleepy)\b/i],
  ['movement', /\b(worked out|workout|exercise|rode|ride|cycling|bike|walked|walk|ran|run|gym|lifted|training)\b/i],
  ['sleep', /\b(slept|sleep was|bad sleep|good sleep|nap|woke up|bed late|bed early)\b/i],
  ['family', /\b(with my son|with my kids|with the kids|family time|jovi|jionni|justis|family)\b/i],
  ['trading', /\b(my trade|i traded|took a trade|revenge trade|overtraded|followed my setup|broke my rule)\b/i],
  ['win', /\b(i'm proud|i am proud|big win|won today|accomplished|finished|got it done|crushed it)\b/i],
  ['friction', /\b(struggled|hard time|frustrated|procrastinated|distracted|stuck|avoided|couldn't focus|could not focus)\b/i],
  ['work', /\b(work was|at work|affiliate|client call|customer|support ticket|meeting went|project progress)\b/i],
];

function numberNear(text, re) {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function scoreNear(text, word) {
  const direct = text.match(new RegExp(`${word}\\s*(?:is|was|at|=|:)??\\s*(\\d+(?:\\.\\d+)?)\\s*(?:/\\s*10)?`, 'i'));
  if (direct) return Math.max(0, Math.min(10, Number(direct[1])));
  return null;
}

export function classifyLifeObservation(text = '') {
  const clean = String(text).trim();
  if (!clean || clean.length < 4) return null;
  const hits = RULES.filter(([, re]) => re.test(clean)).map(([category]) => category);
  if (!hits.length) return null;

  // Prefer concrete event types over emotional adjectives when multiple rules hit.
  const priority = ['food','movement','sleep','trading','family','work','stress','energy','mood','win','friction'];
  const category = priority.find(x => hits.includes(x)) || hits[0];
  const calories = numberNear(clean, /(\d+(?:\.\d+)?)\s*(?:cal|cals|calories|kcal)\b/i);
  const protein_g = numberNear(clean, /(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:of\s*)?protein\b/i) ?? numberNear(clean, /protein\s*(?:was|is|:|=)?\s*(\d+(?:\.\d+)?)\s*g?/i);
  const hydration_oz = numberNear(clean, /(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\s*(?:of\s*)?(?:water|fluid)/i);
  const duration_min = numberNear(clean, /(\d+(?:\.\d+)?)\s*(?:min|mins|minutes)\b/i);

  return {
    category,
    text: clean,
    mood: scoreNear(clean, 'mood'),
    energy: scoreNear(clean, 'energy'),
    stress: scoreNear(clean, 'stress'),
    calories,
    protein_g,
    hydration_oz,
    duration_min,
    source: 'juno_chat',
    tags: hits,
  };
}

function findPostRoute(app, path) {
  const stack = app?._router?.stack || [];
  return stack.find(layer => layer?.route?.path === path && layer.route.methods?.post)?.route || null;
}

function wrapChat(app, path) {
  const route = findPostRoute(app, path);
  if (!route?.stack?.length) return false;
  const layer = route.stack[0];
  if (layer.handle?.__liv8LifeJournalWrapped) return true;
  const original = layer.handle;

  const wrapped = async function lifeJournalChat(req, res, next) {
    const text = req.body?.message || req.body?.prompt || '';
    const observation = classifyLifeObservation(text);
    let saved = null;
    if (observation) {
      try { saved = journal.addEntry(observation); }
      catch (e) { console.warn('[Life Journal] capture failed:', e?.message || e); }
    }

    if (!saved) return original(req, res, next);

    const json = res.json.bind(res);
    res.json = (payload) => {
      if (payload && typeof payload === 'object') {
        const response = typeof payload.response === 'string'
          ? `${payload.response}\n\n✓ Logged to Life Journal · ${saved.category}`
          : payload.response;
        return json({ ...payload, response, lifeLogged: { id: saved.id, category: saved.category, ts: saved.ts } });
      }
      return json(payload);
    };
    return original(req, res, next);
  };
  wrapped.__liv8LifeJournalWrapped = true;
  layer.handle = wrapped;
  return true;
}

export function registerLifeJournalRoutes(app) {
  journal.initLifeJournalTables();

  app.get('/api/life/journal', (req, res) => {
    try { res.json({ ok: true, entries: journal.listEntries({ days: req.query.days || 30, category: req.query.category, limit: +(req.query.limit || 300) }) }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/life/journal', (req, res) => {
    try { res.json({ ok: true, entry: journal.addEntry(req.body || {}) }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/life/scoreboard', (req, res) => {
    try { res.json({ ok: true, scoreboard: journal.scoreboard({ days: +(req.query.days || 7) }) }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  setImmediate(() => {
    const chat = wrapChat(app, '/api/chat');
    const commander = wrapChat(app, '/api/commander/chat');
    console.log(`Life Journal: ${chat ? 'chat capture wired' : 'chat route not found'} · ${commander ? 'commander capture wired' : 'commander route not found'}`);
  });
}

export default registerLifeJournalRoutes;
