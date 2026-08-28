// Machine-readable guardrails distilled from the user's MNQ Trading Bible and QQE framework.
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

export function evaluateGuardian(input = {}) {
  const reasons = [];
  let posture = 'GREEN';
  const lower = p => { if (p === 'RED') posture = 'RED'; else if (p === 'YELLOW' && posture === 'GREEN') posture = 'YELLOW'; };
  const session = sessionForEt(input.now ? new Date(input.now) : new Date());
  lower(session.posture === 'PRIMARY' || session.posture === 'SETUP' ? 'GREEN' : session.posture === 'RED' ? 'RED' : 'YELLOW');
  reasons.push(`${session.label}: ${session.note}`);

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
    qqe,
    vix,
    reasons,
    sourceRules: 'MNQ Trading Bible + QQE Framework',
    executionAllowed: false,
    note: 'Guardian is advisory. Live execution remains separately confirmation-gated.'
  };
}
