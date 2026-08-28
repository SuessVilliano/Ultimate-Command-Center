// Machine-readable guardrails distilled from the user's MNQ Trading Bible,
// QQE framework, and the actual Auto Hybrid AI Pine strategy supplied by the user.
// These rules advise/score only. They never place or modify a live order.

export const SESSION_WINDOWS_ET = [
  { id: 'evening', start: 18, end: 22, label: 'Evening', posture: 'WATCH', note: 'Mark the range; do not force entries.' },
  { id: 'late_night', start: 22, end: 26, label: 'Late Night', posture: 'SETUP', note: 'Sweep/reversal setup window.' },
  { id: 'asian', start: 2, end: 6, label: 'Asian', posture: 'SETUP', note: 'Extension/liquidity-hunt window.' },
  { id: 'euro', start: 6, end: 8, label: 'Euro', posture: 'PRIMARY', note: 'Primary sweep/reversal entry window.' },
  { id: 'preopen', start: 8, end: 9.5, label: 'Pre-Open', posture: 'SECONDARY', note: 'Secondary entry window; volatility is rising.' },
  { id: 'orb', start: 9.5, end: 10, label: 'ORB Formation', posture: 'RED', note: 'Do not trade. Let the 9:30–10:00 opening range form.' },
  { id: 'rth_morning', start: 10, end: 12, label: 'RTH Morning', posture: 'PRIMARY', note: 'Primary RTH trade window after ORB confirmation.' },
  { id: 'lunch', start: 12, end: 14, label: 'RTH Lunch', posture: 'RED', note: 'Avoid: choppy, low-volume window associated with losses.' },
  { id: 'afternoon', start: 14, end: 16, label: 'RTH Afternoon', posture: 'SELECTIVE', note: 'Selective only; often retests morning levels.' },
];

export const QQE_FACTORS = [
  'session type', 'sweep occurred', 'reversal quality', 'VIX regime', 'day of week',
  'consecutive direction days', 'gap alignment', 'range vs average', 'volume confirmation',
  'time of sweep', 'DXY', 'yields', 'event proximity', 'prior session outcome'
];

export const AUTO_HYBRID_AI = {
  version: 'Pine v5',
  name: 'Auto Hybrid AI',
  entryEngine: {
    ichimoku: { conversion: 9, base: 26, leadingSpan: 52 },
    adx: { length: 14, min: 25 },
    smaFilter: { enabledByDefault: true, length: 50 },
    buy: 'Tenkan crosses above Kijun + ADX > min ADX + close above SMA when SMA filter is enabled',
    sell: 'Tenkan crosses below Kijun + ADX > min ADX + close below SMA when SMA filter is enabled',
  },
  riskEngine: {
    atrLength: 14,
    initialStopAtr: 1.5,
    trailingStopAtrDefault: 1.0,
    breakEvenAtrDefault: 1.5,
    timeLimitBarsDefault: 50,
  },
  fib: {
    lookbackBars: 100,
    percents: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0],
  },
};

export const HYBRID_AI_ALERT_TYPES = [
  'AUTO_BUY_CANDIDATE', 'AUTO_SELL_CANDIDATE', 'FIB_100_REACHED',
  'TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'STOP_LOSS_HIT', 'UNKNOWN'
];

/**
 * Parse both structured webhook payloads and legacy/free-text TradingView alerts.
 * The user's supplied Auto Hybrid AI strategy itself has no explicit BUY/SELL
 * alertcondition() calls, so ENTRY events should preferably be sent as JSON from
 * TradingView using strategy order-fill alert_message values or added alert() calls.
 */
export function parseHybridAiAlert(message = '') {
  if (message && typeof message === 'object') {
    const type = String(message.type || message.event || '').toUpperCase();
    const side = String(message.side || '').toUpperCase();
    if (type || side) return {
      type: type || (side === 'BUY' || side === 'LONG' ? 'AUTO_BUY_CANDIDATE' : side === 'SELL' || side === 'SHORT' ? 'AUTO_SELL_CANDIDATE' : 'UNKNOWN'),
      side: side === 'LONG' ? 'BUY' : side === 'SHORT' ? 'SELL' : side || undefined,
      symbol: String(message.symbol || message.ticker || '').toUpperCase() || undefined,
      timeframe: message.timeframe || message.tf,
      price: Number.isFinite(Number(message.price ?? message.close)) ? Number(message.price ?? message.close) : undefined,
      adx: Number.isFinite(Number(message.adx)) ? Number(message.adx) : undefined,
      tenkan: Number.isFinite(Number(message.tenkan)) ? Number(message.tenkan) : undefined,
      kijun: Number.isFinite(Number(message.kijun)) ? Number(message.kijun) : undefined,
      sma: Number.isFinite(Number(message.sma)) ? Number(message.sma) : undefined,
      atr: Number.isFinite(Number(message.atr)) ? Number(message.atr) : undefined,
      raw: message,
    };
  }

  const text = String(message || '').trim();
  let m = text.match(/^BUY ENTRY\s+([^\s]+)\s+@\s+(-?\d+(?:\.\d+)?)$/i);
  if (m) return { type: 'AUTO_BUY_CANDIDATE', side: 'BUY', symbol: m[1].toUpperCase(), price: Number(m[2]), raw: text };
  m = text.match(/^SELL ENTRY\s+([^\s]+)\s+@\s+(-?\d+(?:\.\d+)?)$/i);
  if (m) return { type: 'AUTO_SELL_CANDIDATE', side: 'SELL', symbol: m[1].toUpperCase(), price: Number(m[2]), raw: text };
  m = text.match(/^(?:Symbol:\s*)?([^\s]+).*?(?:timeframe\s+)?([^\s]+)?\s*.*?Fibonacci level 100%/i);
  if (m) return { type: 'FIB_100_REACHED', symbol: m[1]?.toUpperCase(), timeframe: m[2], raw: text };
  m = text.match(/^TP([123]) HIT\s+([^\s]+)$/i);
  if (m) return { type: `TP${m[1]}_HIT`, symbol: m[2].toUpperCase(), raw: text };
  m = text.match(/^STOP LOSS HIT\s+([^\s]+)$/i);
  if (m) return { type: 'STOP_LOSS_HIT', symbol: m[1].toUpperCase(), raw: text };
  return { type: 'UNKNOWN', raw: text };
}

export function qqeGrade(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return { grade: null, posture: 'YELLOW', note: 'QQE score unavailable.' };
  if (s >= 11) return { grade: 'A', posture: 'GREEN', note: 'High-conviction QQE range.' };
  if (s >= 8) return { grade: 'B', posture: 'YELLOW', note: 'Standard/selective QQE range.' };
  if (s >= 5) return { grade: 'C', posture: 'YELLOW', note: 'Half-size or skip range.' };
  return { grade: 'F', posture: 'RED', note: 'Do not trade by QQE framework.' };
}

export function vixRegime(vix) {
  const v = Number(vix);
  if (!Number.isFinite(v)) return { posture: 'YELLOW', label: 'unknown', note: 'VIX unavailable.' };
  if (v >= 35) return { posture: 'RED', label: 'panic', note: 'VIX 35+: do not trade sweep systems.' };
  if (v >= 30) return { posture: 'YELLOW', label: 'extreme fear', note: 'Reduce size; conditions are extreme.' };
  if (v >= 25) return { posture: 'YELLOW', label: 'very high', note: 'Only selective A+ setups.' };
  if (v >= 20) return { posture: 'YELLOW', label: 'high', note: 'Elevated risk; require stronger confluence.' };
  if (v >= 16) return { posture: 'GREEN', label: 'elevated', note: 'Elevated but within normal framework.' };
  if (v >= 12) return { posture: 'GREEN', label: 'normal', note: 'Normal volatility regime.' };
  return { posture: 'YELLOW', label: 'extreme complacency', note: 'Very low volatility; be selective.' };
}

export function sessionForEt(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  const h = hour + minute / 60;
  const adjusted = h < 2 ? h + 24 : h;
  const session = SESSION_WINDOWS_ET.find(x => adjusted >= x.start && adjusted < x.end) || { id: 'off_window', label: 'Off-window', posture: 'YELLOW', note: 'No primary Bible window is active.' };
  return { ...session, hour: h, weekday };
}

function checkAutoHybridCandidate(alert, input, reasons, lower) {
  if (!alert?.type?.startsWith('AUTO_')) return;
  const adx = Number(alert.adx ?? input.adx);
  const price = Number(alert.price ?? input.price);
  const sma = Number(alert.sma ?? input.sma);
  const tenkan = Number(alert.tenkan ?? input.tenkan);
  const kijun = Number(alert.kijun ?? input.kijun);

  reasons.push(`Auto Hybrid AI ${alert.side || ''} candidate: Ichimoku Tenkan/Kijun crossover + ADX trend filter + optional SMA-50 direction filter.`);
  if (Number.isFinite(adx)) {
    if (adx <= 25) { lower('RED'); reasons.push(`ADX ${adx.toFixed(1)} does not clear the strategy's default >25 trend threshold.`); }
    else reasons.push(`ADX ${adx.toFixed(1)} clears the default >25 trend threshold.`);
  } else { lower('YELLOW'); reasons.push('ADX value was not included in the alert payload; candidate cannot be independently validated.'); }

  if (Number.isFinite(price) && Number.isFinite(sma)) {
    if (alert.side === 'BUY' && price <= sma) { lower('RED'); reasons.push('BUY candidate is not above SMA-50; it conflicts with the default SMA filter.'); }
    if (alert.side === 'SELL' && price >= sma) { lower('RED'); reasons.push('SELL candidate is not below SMA-50; it conflicts with the default SMA filter.'); }
  } else { lower('YELLOW'); reasons.push('Price/SMA-50 were not both supplied; SMA-filter conformance is unverified.'); }

  if (Number.isFinite(tenkan) && Number.isFinite(kijun)) {
    if (alert.side === 'BUY' && tenkan <= kijun) { lower('RED'); reasons.push('BUY candidate no longer has Tenkan above Kijun at evaluation time.'); }
    if (alert.side === 'SELL' && tenkan >= kijun) { lower('RED'); reasons.push('SELL candidate no longer has Tenkan below Kijun at evaluation time.'); }
  } else { lower('YELLOW'); reasons.push('Tenkan/Kijun values were not supplied; crossover state is trusted from TradingView but not independently verified.'); }
}

export function evaluateGuardian(input = {}) {
  const reasons = [];
  let posture = 'GREEN';
  const lower = p => { if (p === 'RED') posture = 'RED'; else if (p === 'YELLOW' && posture === 'GREEN') posture = 'YELLOW'; };
  const session = sessionForEt(input.now ? new Date(input.now) : new Date());
  lower(session.posture === 'PRIMARY' || session.posture === 'SETUP' ? 'GREEN' : session.posture === 'RED' ? 'RED' : 'YELLOW');
  reasons.push(`${session.label}: ${session.note}`);

  const alert = typeof input.alert === 'string' ? parseHybridAiAlert(input.alert) : input.alert;
  if (alert?.type && alert.type !== 'UNKNOWN') {
    if (alert.type === 'AUTO_BUY_CANDIDATE' || alert.type === 'AUTO_SELL_CANDIDATE') {
      lower('YELLOW');
      checkAutoHybridCandidate(alert, input, reasons, lower);
      reasons.push('Auto Hybrid AI is the technical candidate generator; Bible + QQE + risk still determine whether conditions are worth trading.');
    } else if (alert.type === 'FIB_100_REACHED') {
      reasons.push('100% Fibonacci level reached is a target/context event, not a fresh entry approval.');
    } else if (alert.type.startsWith('TP')) {
      reasons.push(`${alert.type.replaceAll('_', ' ')} is a lifecycle/management alert, not a new-entry signal.`);
    } else if (alert.type === 'STOP_LOSS_HIT') {
      reasons.push('Stop-loss lifecycle alert recorded; do not reinterpret it as a reversal entry without a fresh qualified setup.');
    }
  }

  const day = session.weekday;
  if (day === 'Sun' && session.id === 'evening') { lower('RED'); reasons.push('Sunday evening is a Bible no-trade condition.'); }

  const signalGrade = String(input.signalGrade || '').toUpperCase();
  const confidence = Number(input.confidence);
  if (signalGrade && signalGrade !== 'A+') { lower('RED'); reasons.push(`Signal grade ${signalGrade}: Bible permits only A+ signals.`); }
  if (Number.isFinite(confidence) && confidence < 80) { lower('RED'); reasons.push(`Confidence ${confidence}% is below the 80% minimum.`); }
  if (!signalGrade || !Number.isFinite(confidence)) { lower('YELLOW'); reasons.push('Signal grade/confidence incomplete; do not treat the setup as qualified yet.'); }

  if (input.sweepOccurred === false && ['late_night','asian','euro'].includes(session.id)) { lower('YELLOW'); reasons.push('No confirmed liquidity sweep yet; framework says wait, do not anticipate.'); }
  if (input.reversalConfirmed === false && ['late_night','euro'].includes(session.id)) { lower('YELLOW'); reasons.push('Reversal confirmation is missing.'); }

  const qqe = qqeGrade(input.qqeScore); lower(qqe.posture); reasons.push(`QQE ${qqe.grade || '—'}: ${qqe.note}`);
  const vix = vixRegime(input.vix); lower(vix.posture); reasons.push(`VIX ${vix.label}: ${vix.note}`);

  const bias = String(input.bias || '').toUpperCase();
  if (bias === 'NEUTRAL') { lower('RED'); reasons.push('QQE directional bias is NEUTRAL: sit out.'); }
  if (!bias) { lower('YELLOW'); reasons.push('Directional bias is unavailable.'); }
  if (alert?.side && ['LONG','SHORT','BUY','SELL'].includes(bias)) {
    const normalizedBias = bias === 'LONG' ? 'BUY' : bias === 'SHORT' ? 'SELL' : bias;
    if (normalizedBias !== alert.side) { lower('RED'); reasons.push(`Auto Hybrid AI side ${alert.side} conflicts with QQE bias ${bias}.`); }
  }

  const riskPct = Number(input.riskPct);
  if (Number.isFinite(riskPct) && riskPct > 0.4) { lower('RED'); reasons.push(`Planned risk ${riskPct}% exceeds the 0.4% survival rule.`); }
  const losses = Number(input.consecutiveLosses || 0);
  if (losses >= 3) { lower('YELLOW'); reasons.push('3+ consecutive losses: cut size in half for the next 3 trades.'); }
  const tradesToday = Number(input.tradesToday || 0);
  if (tradesToday >= 3) { lower('RED'); reasons.push('Daily quality-trade limit reached; Bible warns against over-trading beyond 2–3 setups.'); }

  const eventMinutes = Number(input.minutesToHighImpactEvent);
  if (Number.isFinite(eventMinutes) && Math.abs(eventMinutes) <= 30) { lower('YELLOW'); reasons.push('High-impact event is within 30 minutes; event proximity is a QQE risk factor.'); }

  return {
    posture,
    label: posture === 'GREEN' ? 'TRADE WINDOW QUALIFIED' : posture === 'YELLOW' ? 'WAIT / SELECTIVE' : 'DO NOT TRADE',
    session,
    alert: alert?.type ? alert : undefined,
    autoHybridAi: AUTO_HYBRID_AI,
    qqe,
    vix,
    reasons,
    sourceRules: 'Auto Hybrid AI + MNQ Trading Bible + QQE Framework + Hybrid Journal',
    executionAllowed: false,
    note: 'Guardian is advisory. Live execution remains separately confirmation-gated.'
  };
}
