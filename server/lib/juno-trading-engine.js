import * as hs from './highest-self-db.js';
import { sessionForEt } from './trading-guardian-rules.js';

const PLAN_KEY = 'juno_trading_plan_v1';
const PAPER_LOG_KEY = 'juno_paper_orders_v1';

const asNum = v => Number.isFinite(Number(v)) ? Number(v) : null;
const upper = v => v == null ? null : String(v).trim().toUpperCase();

export function normalizeRichAlert(body = {}, parsed = {}) {
  const src = body.alert && typeof body.alert === 'object' ? body.alert : body;
  const directionRaw = src.direction || src.side || src.action || parsed.side;
  const direction = ['BUY','LONG'].includes(upper(directionRaw)) ? 'BUY' : ['SELL','SHORT'].includes(upper(directionRaw)) ? 'SELL' : null;
  const score = asNum(src.score ?? src.confidence ?? src.confidence_score);
  const grade = upper(src.grade || src.signal_grade) || (score == null ? null : score >= 80 ? 'A+' : score >= 65 ? 'A' : score >= 50 ? 'B' : 'C');
  return {
    signalId: src.signal_id || src.signalId || `${src.ticker || src.symbol || parsed.symbol || 'UNKNOWN'}-${src.tf || src.timeframe || parsed.timeframe || 'NA'}-${Date.now()}`,
    strategyId: src.strategy_id || src.strategy || src.source || 'hybrid_ai',
    strategyVersion: src.strategy_version || src.version || null,
    symbol: upper(src.symbol || src.ticker || parsed.symbol) || 'MNQ',
    timeframe: String(src.timeframe || src.tf || parsed.timeframe || ''),
    direction,
    price: asNum(src.price ?? src.entry ?? src.close ?? parsed.price),
    entry: asNum(src.entry ?? src.price ?? src.close ?? parsed.price),
    sl: asNum(src.sl ?? src.stop ?? src.stop_loss),
    tp1: asNum(src.tp1 ?? src.takeProfit1 ?? src.take_profit_1),
    tp2: asNum(src.tp2 ?? src.takeProfit2 ?? src.take_profit_2),
    tp3: asNum(src.tp3 ?? src.takeProfit3 ?? src.take_profit_3),
    score,
    grade,
    adx: asNum(src.adx),
    tenkan: asNum(src.tenkan),
    kijun: asNum(src.kijun),
    sma: asNum(src.sma),
    atr: asNum(src.atr),
    regime: upper(src.regime),
    cloud: upper(src.cloud || src.cloud_state),
    mtf: upper(src.mtf || src.mtf_state),
    volumeOk: src.volume_ok ?? src.volume_pass ?? null,
    confirmed: src.confirmed ?? src.bar_confirmed ?? true,
    receivedAt: new Date().toISOString(),
    raw: src,
  };
}

function defaultPlan() {
  return {
    id: 'default',
    name: 'Juno paper trading plan',
    mode: 'PAPER',
    enabled: false,
    waitForOrb: true,
    orbEndsEt: '10:00',
    direction: 'BOTH',
    allowedSymbols: ['MNQ'],
    allowedStrategies: ['hybrid_ai','hybrid_supercator','auto_hybrid_ai','ah_ai_qqe'],
    targetAccounts: ['JUNO_DEMO'],
    minScore: 65,
    minGrade: 'A',
    maxRiskPct: 0.25,
    requireConfirmedBar: true,
    onePositionPerSymbol: true,
    notes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getTradingPlan() {
  try {
    const raw = hs.getSetting(PLAN_KEY, '');
    return raw ? { ...defaultPlan(), ...JSON.parse(raw) } : defaultPlan();
  } catch { return defaultPlan(); }
}

export function saveTradingPlan(plan = {}) {
  const next = { ...getTradingPlan(), ...plan, updatedAt: new Date().toISOString() };
  hs.setSetting(PLAN_KEY, JSON.stringify(next));
  return next;
}

export function compileTradingInstruction(text = '') {
  const t = String(text || '').trim();
  const low = t.toLowerCase();
  const patch = {};
  const notes = [];

  if (/wait\s+(for\s+)?(the\s+)?orb|after\s+orb|opening range/.test(low)) { patch.waitForOrb = true; notes.push('Wait for the 09:30–10:00 ET opening range to complete.'); }
  if (/trade\s+(before|during)\s+orb/.test(low)) { patch.waitForOrb = false; notes.push('ORB wait disabled by explicit instruction.'); }
  if (/above\s+or\s+below|both\s+directions|long\s+or\s+short|buy\s+or\s+sell/.test(low)) patch.direction = 'BOTH';
  else if (/\blong(s)?\b|\bbuy(s)?\b/.test(low) && !/\bshort(s)?\b|\bsell(s)?\b/.test(low)) patch.direction = 'BUY';
  else if (/\bshort(s)?\b|\bsell(s)?\b/.test(low) && !/\blong(s)?\b|\bbuy(s)?\b/.test(low)) patch.direction = 'SELL';

  if (/paper|demo|simulat/.test(low)) patch.mode = 'PAPER';
  if (/\barm\b|turn\s+on|enable/.test(low)) patch.enabled = true;
  if (/\bdisarm\b|turn\s+off|disable|stop trading/.test(low)) patch.enabled = false;

  const selectedAccounts = [];
  if (/juno\s*(demo|paper)|internal\s*(demo|paper)/.test(low)) selectedAccounts.push('JUNO_DEMO');
  if (/kraken.*(demo|paper)|(demo|paper).*kraken/.test(low)) selectedAccounts.push('KRAKEN_FUTURES_DEMO');
  if (/tradovate.*(demo|paper)|(demo|paper).*tradovate/.test(low)) selectedAccounts.push('TRADOVATE_DEMO');
  if (/dx\s*trade.*(demo|paper)|(demo|paper).*dx\s*trade|dxtrade.*(demo|paper)|(demo|paper).*dxtrade/.test(low)) selectedAccounts.push('DXTRADE_DEMO');
  if (/all\s+(demo|paper)\s+accounts|all\s+demos/.test(low)) selectedAccounts.push('JUNO_DEMO','KRAKEN_FUTURES_DEMO','TRADOVATE_DEMO','DXTRADE_DEMO');
  if (selectedAccounts.length) patch.targetAccounts = [...new Set(selectedAccounts)];

  const risk = low.match(/(?:risk|max risk)\s*(?:of|=|:)?\s*(0?\.\d+|\d+(?:\.\d+)?)\s*%/);
  if (risk) patch.maxRiskPct = Number(risk[1]);
  const score = low.match(/(?:score|min score|confidence)\s*(?:of|=|:|at least)?\s*(\d{2,3})/);
  if (score) patch.minScore = Number(score[1]);
  const grade = low.match(/(?:grade|only)\s*(a\+|a|b|c)\b/i);
  if (grade) patch.minGrade = grade[1].toUpperCase();
  const symbols = [...t.matchAll(/\b(MNQ|NQ|MES|ES|MGC|GC|BTC|ETH)\b/gi)].map(m => m[1].toUpperCase());
  if (symbols.length) patch.allowedSymbols = [...new Set(symbols)];

  patch.notes = [...(getTradingPlan().notes || []), ...notes, t].slice(-20);
  return { instruction: t, patch, plan: { ...getTradingPlan(), ...patch } };
}

const gradeRank = g => ({ 'A+': 4, 'A': 3, 'B': 2, 'C': 1, 'F': 0 }[upper(g)] ?? -1);

export function evaluatePlanForAlert(alert, plan = getTradingPlan(), now = new Date()) {
  const reasons = [];
  let eligible = true;
  const block = reason => { eligible = false; reasons.push(reason); };
  const session = sessionForEt(now);

  if (!plan.enabled) block('Trading plan is not armed.');
  if (upper(plan.mode) !== 'PAPER') block('Only PAPER/DEMO execution is enabled in this engine.');
  if (plan.waitForOrb && session.id === 'orb') block('Waiting for ORB to finish at 10:00 ET.');
  if (plan.waitForOrb && session.hour < 10 && session.hour >= 9.5) block('ORB is still forming.');
  if (plan.allowedSymbols?.length && !plan.allowedSymbols.includes(alert.symbol)) block(`${alert.symbol} is not enabled for this plan.`);
  if (plan.allowedStrategies?.length && alert.strategyId && !plan.allowedStrategies.includes(alert.strategyId)) reasons.push(`Strategy ${alert.strategyId} is not in the preferred strategy list; signal remains visible for review.`);
  if (plan.direction === 'BUY' && alert.direction !== 'BUY') block('Plan is long-only.');
  if (plan.direction === 'SELL' && alert.direction !== 'SELL') block('Plan is short-only.');
  if (!alert.direction) block('Alert has no executable direction.');
  if (plan.requireConfirmedBar && alert.confirmed === false) block('Signal bar is not confirmed.');
  if (alert.score != null && Number(alert.score) < Number(plan.minScore || 0)) block(`Score ${alert.score} is below plan minimum ${plan.minScore}.`);
  if (alert.grade && gradeRank(alert.grade) < gradeRank(plan.minGrade)) block(`Grade ${alert.grade} is below plan minimum ${plan.minGrade}.`);
  if (alert.entry == null) block('No entry price supplied.');
  if (alert.sl == null) reasons.push('No stop supplied; paper order can be logged but risk cannot be computed.');
  if (alert.tp1 == null) reasons.push('No TP1 supplied.');
  if (!Array.isArray(plan.targetAccounts) || plan.targetAccounts.length === 0) block('No demo target accounts are selected.');

  if (eligible) reasons.push(`Eligible for ${plan.mode} routing after deterministic plan checks.`);
  return { eligible, reasons, session, planId: plan.id, mode: plan.mode, targetAccounts: plan.targetAccounts || [] };
}

function readPaperOrders() {
  try { return JSON.parse(hs.getSetting(PAPER_LOG_KEY, '[]')); } catch { return []; }
}
function writePaperOrders(rows) { hs.setSetting(PAPER_LOG_KEY, JSON.stringify(rows.slice(-500))); }

export function listPaperOrders(limit = 100) { return readPaperOrders().slice(-Math.max(1, Number(limit) || 100)).reverse(); }

export function createPaperOrder(alert, plan = getTradingPlan(), evaluation = evaluatePlanForAlert(alert, plan)) {
  if (!evaluation.eligible) return { placed: false, evaluation };
  const orders = readPaperOrders();
  if (plan.onePositionPerSymbol && orders.some(o => o.status === 'OPEN' && o.symbol === alert.symbol)) {
    return { placed: false, evaluation: { ...evaluation, eligible: false, reasons: [...evaluation.reasons, `An OPEN ${alert.symbol} paper position already exists.`] } };
  }
  const order = {
    id: `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    signalId: alert.signalId,
    strategyId: alert.strategyId,
    symbol: alert.symbol,
    timeframe: alert.timeframe,
    side: alert.direction,
    entry: alert.entry,
    sl: alert.sl,
    tp1: alert.tp1,
    tp2: alert.tp2,
    tp3: alert.tp3,
    score: alert.score,
    grade: alert.grade,
    riskPctCap: plan.maxRiskPct,
    status: 'OPEN',
    account: 'JUNO_DEMO',
    routedAccounts: plan.targetAccounts || ['JUNO_DEMO'],
    openedAt: new Date().toISOString(),
    source: 'juno-trading-engine',
  };
  orders.push(order);
  writePaperOrders(orders);
  try {
    hs.addTrade({
      symbol: order.symbol,
      direction: order.side,
      entry: order.entry,
      size: 0,
      pnl: 0,
      setup_type: order.strategyId,
      on_setup: 1,
      followed_plan: 1,
      journal_ref: order.id,
      notes: `PAPER/DEMO order from ${order.strategyId}; grade=${order.grade || 'n/a'} score=${order.score ?? 'n/a'} SL=${order.sl ?? 'n/a'} TP1=${order.tp1 ?? 'n/a'} TP2=${order.tp2 ?? 'n/a'} TP3=${order.tp3 ?? 'n/a'} targets=${(order.routedAccounts || []).join(',')}`,
    });
  } catch {}
  return { placed: true, order, evaluation };
}

export function closePaperOrder(id, { exit, pnl, status = 'CLOSED', reason = '' } = {}) {
  const orders = readPaperOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx < 0) return null;
  orders[idx] = { ...orders[idx], exit: asNum(exit), pnl: asNum(pnl), status, closeReason: reason, closedAt: new Date().toISOString() };
  writePaperOrders(orders);
  return orders[idx];
}
