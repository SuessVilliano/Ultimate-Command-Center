import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, Rocket, Star, TrendingUp, Zap, AlertTriangle, FileText,
  Brain, RefreshCw, Settings, Search, X, ChevronRight, Award, DollarSign,
  Link2, ExternalLink, Sparkles, Check, Copy, Clock, Megaphone, ArrowRight,
  Mail, MessageSquare, Instagram, Facebook, Send, Phone, Activity as ActivityIcon
} from 'lucide-react';
import { API_URL } from '../../config';
import OutboundQueue from './OutboundQueue';

// ─────────────────────────────────────────────────────────────
// Affiliate lifecycle — the "process" the AI buttons move people along.
// Ordered stages form the growth pipeline; at_risk is a side state.
// ─────────────────────────────────────────────────────────────
const STAGES = [
  { id: 'prospect',   label: 'Prospect',      color: 'gray',   icon: UserPlus,      desc: 'Identified — not yet applied' },
  { id: 'applied',    label: 'Applied',       color: 'blue',   icon: FileText,      desc: 'Signed up via First Promoters' },
  { id: 'onboarding', label: 'Onboarding',    color: 'cyan',   icon: Rocket,        desc: 'Approved — getting set up' },
  { id: 'activated',  label: 'Activated',     color: 'purple', icon: Zap,           desc: 'First referral / sale made' },
  { id: 'growing',    label: 'Growing',       color: 'green',  icon: TrendingUp,    desc: 'Producing & recruiting sub-affiliates' },
  { id: 'top',        label: 'Top Performer', color: 'yellow', icon: Star,          desc: 'High value — retain & reward' },
  { id: 'at_risk',    label: 'At Risk',       color: 'red',    icon: AlertTriangle, desc: 'Declining — re-engage now' }
];
const STAGE_ORDER = ['prospect', 'applied', 'onboarding', 'activated', 'growing', 'top'];
const stageById = (id) => STAGES.find(s => s.id === id) || STAGES[0];
const nextStage = (id) => {
  const i = STAGE_ORDER.indexOf(id);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : id;
};

const CHANNELS = [
  { id: 'email',     label: 'Email',        icon: Mail },
  { id: 'sms',       label: 'SMS',          icon: MessageSquare },
  { id: 'instagram', label: 'Instagram DM', icon: Instagram },
  { id: 'facebook',  label: 'Facebook DM',  icon: Facebook },
  { id: 'whatsapp',  label: 'WhatsApp',     icon: MessageSquare },
  { id: 'ghl',       label: 'GHL Broadcast', icon: Send }
];

// Sample roster so the console is alive before GHL / First Promoters is connected.
const SAMPLE_AFFILIATES = [
  { id: 's1', name: 'Marcus Bell', email: 'marcus@growthlabs.io', phone: '+13055551201', tier: 'Gold', stage: 'top', source: 'First Promoters', referrals: 42, subAffiliates: 9, revenue: 18400, conversions: 63, clicks: 2100, lastActivity: '2026-08-25', joined: '2025-11-02',
    activity: [{ t: '2026-08-25', ch: 'email', dir: 'out', text: 'Sent Q3 bonus tier update.' }, { t: '2026-08-24', ch: 'sms', dir: 'in', text: 'Two of my recruits just went live 🎉' }] },
  { id: 's2', name: 'Priya Nair', email: 'priya.nair@mail.com', phone: '+447700900123', tier: 'Silver', stage: 'growing', source: 'First Promoters', referrals: 18, subAffiliates: 4, revenue: 6200, conversions: 24, clicks: 890, lastActivity: '2026-08-23', joined: '2026-01-14',
    activity: [{ t: '2026-08-23', ch: 'instagram', dir: 'in', text: 'Can I get more creatives for reels?' }] },
  { id: 's3', name: 'Diego Ramos', email: 'diego@rampartners.co', phone: '+5215555550199', tier: 'Silver', stage: 'activated', source: 'First Promoters', referrals: 5, subAffiliates: 1, revenue: 1450, conversions: 6, clicks: 320, lastActivity: '2026-08-20', joined: '2026-05-30',
    activity: [{ t: '2026-08-20', ch: 'email', dir: 'out', text: 'Shared the affiliate playbook + swipe file.' }] },
  { id: 's4', name: 'Chloe Winters', email: 'chloe.w@creators.tv', phone: '+13105550147', tier: 'Bronze', stage: 'onboarding', source: 'First Promoters', referrals: 0, subAffiliates: 0, revenue: 0, conversions: 0, clicks: 40, lastActivity: '2026-08-24', joined: '2026-08-18',
    activity: [{ t: '2026-08-24', ch: 'whatsapp', dir: 'out', text: 'Welcome! Here is your link + tracking guide.' }] },
  { id: 's5', name: 'Sam Okoye', email: 'sam.okoye@ventures.africa', phone: '+2348030000000', tier: 'Bronze', stage: 'applied', source: 'First Promoters', referrals: 0, subAffiliates: 0, revenue: 0, conversions: 0, clicks: 0, lastActivity: '2026-08-26', joined: '2026-08-26',
    activity: [{ t: '2026-08-26', ch: 'email', dir: 'in', text: 'Just applied — excited to promote!' }] },
  { id: 's6', name: 'Hannah Lee', email: 'hannah@leemedia.com', phone: '+821000000000', tier: 'Gold', stage: 'at_risk', source: 'First Promoters', referrals: 27, subAffiliates: 6, revenue: 9100, conversions: 31, clicks: 1500, lastActivity: '2026-07-12', joined: '2025-09-10',
    activity: [{ t: '2026-07-12', ch: 'sms', dir: 'out', text: 'Checking in — haven\'t seen activity in a few weeks.' }] },
  { id: 's7', name: 'Tobias Fenn', email: 'tobias@fennreach.io', phone: '+491700000000', tier: 'Prospect', stage: 'prospect', source: 'Outreach', referrals: 0, subAffiliates: 0, revenue: 0, conversions: 0, clicks: 0, lastActivity: '2026-08-19', joined: '—',
    activity: [{ t: '2026-08-19', ch: 'instagram', dir: 'out', text: 'DM\'d about the affiliate program.' }] }
];

const TIER_COLORS = {
  Gold: 'text-yellow-400 bg-yellow-500/15',
  Silver: 'text-gray-300 bg-gray-400/15',
  Bronze: 'text-orange-400 bg-orange-500/15',
  Prospect: 'text-purple-300 bg-purple-500/15'
};

const FIRST_PROMOTERS_URL = 'https://firstpromoter.com/login';
const GHL_APP_URL = 'https://app.gohighlevel.com/';

function fmtMoney(n) {
  if (n == null) return '$0';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
}
function daysSince(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Map a GHL contact into our affiliate shape (best-effort; GHL schemas vary by account).
function contactToAffiliate(c) {
  const tags = c.tags || [];
  const tagStr = tags.join(' ').toLowerCase();
  let stage = 'prospect';
  if (tagStr.includes('top')) stage = 'top';
  else if (tagStr.includes('at-risk') || tagStr.includes('at_risk') || tagStr.includes('dormant')) stage = 'at_risk';
  else if (tagStr.includes('growing') || tagStr.includes('active-affiliate')) stage = 'growing';
  else if (tagStr.includes('activated')) stage = 'activated';
  else if (tagStr.includes('onboarding')) stage = 'onboarding';
  else if (tagStr.includes('applied') || tagStr.includes('affiliate')) stage = 'applied';
  const tier = tagStr.includes('gold') ? 'Gold' : tagStr.includes('silver') ? 'Silver' : tagStr.includes('bronze') ? 'Bronze' : 'Prospect';
  return {
    id: c.id || c._id || c.contactId,
    ghlId: c.id || c._id || c.contactId,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.contactName || c.name || c.email || 'Unknown',
    email: c.email || '',
    phone: c.phone || '',
    tier,
    stage,
    source: 'GoHighLevel',
    referrals: c.referrals || 0, subAffiliates: 0, revenue: c.revenue || 0, conversions: 0, clicks: 0,
    lastActivity: c.dateUpdated || c.dateAdded || '',
    joined: c.dateAdded || '',
    tags,
    activity: []
  };
}

export default function AffiliateHub({ isDark, currentUser, aiServerStatus, onOpenSettings }) {
  const [affiliates, setAffiliates] = useState([]);
  const [usingSample, setUsingSample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [detailTab, setDetailTab] = useState('activity'); // activity | insights | compose

  // AI state
  const [insights, setInsights] = useState({});          // affiliateId -> analysis object
  const [analyzingId, setAnalyzingId] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, label: '' });
  const [portfolio, setPortfolio] = useState(null);       // proactive summary

  // Composer state
  const [channel, setChannel] = useState('email');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeIntent, setComposeIntent] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [queueBump, setQueueBump] = useState(0);          // force OutboundQueue refresh key
  const [notes, setNotes] = useState({});                 // affiliateId -> [{t,text}]
  const [noteDraft, setNoteDraft] = useState('');
  const [toast, setToast] = useState('');

  const aiOnline = aiServerStatus === 'online';

  // ── Load affiliates (GHL contacts → fallback sample) ──
  const loadAffiliates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/ghl/contacts?limit=100`);
      if (res.ok) {
        const data = await res.json();
        const raw = data.contacts || data.contact || (Array.isArray(data) ? data : []);
        const mapped = (raw || []).map(contactToAffiliate).filter(a => a.id);
        if (mapped.length > 0) {
          setAffiliates(mapped);
          setUsingSample(false);
          setLoading(false);
          return;
        }
      }
      // No live data → sample roster.
      setAffiliates(SAMPLE_AFFILIATES);
      setUsingSample(true);
    } catch (e) {
      setAffiliates(SAMPLE_AFFILIATES);
      setUsingSample(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAffiliates(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); } }, [toast]);

  const selected = affiliates.find(a => a.id === selectedId) || null;

  // ── Derived counts + filtering ──
  const counts = useMemo(() => {
    const c = { all: affiliates.length };
    STAGES.forEach(s => { c[s.id] = affiliates.filter(a => a.stage === s.id).length; });
    return c;
  }, [affiliates]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return affiliates.filter(a => {
      if (stageFilter !== 'all' && a.stage !== stageFilter) return false;
      if (!q) return true;
      return [a.name, a.email, a.tier, a.source, (a.tags || []).join(' ')].join(' ').toLowerCase().includes(q);
    });
  }, [affiliates, stageFilter, searchQuery]);

  const totalRevenue = useMemo(() => affiliates.reduce((s, a) => s + (a.revenue || 0), 0), [affiliates]);
  const totalRecruits = useMemo(() => affiliates.reduce((s, a) => s + (a.subAffiliates || 0), 0), [affiliates]);

  // ── AI helpers (generic /api/chat with JSON contract) ──
  async function chatJSON(systemPrompt, userMessage) {
    const res = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, systemPrompt })
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'AI request failed');
    const data = await res.json();
    const text = data.response || '';
    const match = text.match(/\{[\s\S]*\}/);
    try { return JSON.parse(match ? match[0] : text); } catch { return { summary: text }; }
  }

  function affiliateContext(a) {
    const ins = insights[a.id];
    return `Affiliate: ${a.name} (${a.tier} tier, source: ${a.source})
Stage: ${stageById(a.stage).label} — ${stageById(a.stage).desc}
Metrics: ${a.referrals} referrals, ${a.subAffiliates} sub-affiliates, ${a.conversions} conversions, ${fmtMoney(a.revenue)} revenue, ${a.clicks} clicks
Last activity: ${a.lastActivity || 'unknown'}${daysSince(a.lastActivity) != null ? ` (${daysSince(a.lastActivity)} days ago)` : ''}
Recent messages: ${(a.activity || []).map(x => `[${x.ch}/${x.dir}] ${x.text}`).join(' | ') || 'none'}${ins ? `\nPrior AI note: ${ins.summary}` : ''}`;
  }

  const analyzeAffiliate = async (a) => {
    if (!aiOnline) { setError('AI is offline. Configure a provider in Settings.'); return null; }
    setAnalyzingId(a.id);
    try {
      const sys = `You are an elite affiliate program manager. Analyze one affiliate and reply with ONLY strict JSON:
{"healthScore":0-100,"status":"thriving|steady|at_risk|dormant","summary":"one line","nextBestAction":"specific action","talkingPoints":["..."],"riskFlags":["..."],"recommendedStage":"prospect|applied|onboarding|activated|growing|top|at_risk"}`;
      const analysis = await chatJSON(sys, affiliateContext(a));
      setInsights(prev => ({ ...prev, [a.id]: analysis }));
      return analysis;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setAnalyzingId(null);
    }
  };

  const runAnalyzeAll = async () => {
    if (!aiOnline) { setError('AI is offline. Configure a provider in Settings.'); return; }
    setBatchRunning(true);
    const list = filtered.length ? filtered : affiliates;
    setBatchProgress({ done: 0, total: list.length, label: 'Analyzing affiliates' });
    for (let i = 0; i < list.length; i++) {
      await analyzeAffiliate(list[i]);
      setBatchProgress({ done: i + 1, total: list.length, label: 'Analyzing affiliates' });
    }
    setBatchRunning(false);
    setToast('Analysis complete for ' + list.length + ' affiliates');
  };

  const runProactive = async () => {
    if (!aiOnline) { setError('AI is offline. Configure a provider in Settings.'); return; }
    setBatchRunning(true);
    setBatchProgress({ done: 0, total: 1, label: 'Building portfolio brief' });
    try {
      const roster = affiliates.map(a => `- ${a.name} | ${stageById(a.stage).label} | ${a.tier} | ${fmtMoney(a.revenue)} | ${a.subAffiliates} recruits | last active ${a.lastActivity || '?'}`).join('\n');
      const sys = `You are the strategist for an affiliate manager. Given the roster, reply with ONLY strict JSON:
{"summary":"2-3 sentences on the state of the portfolio","focusToday":"the single highest-leverage action","priorities":["ordered actions"],"atRisk":["names needing re-engagement"],"opportunities":["names/segments to grow or upsell"]}`;
      const p = await chatJSON(sys, `Roster (${affiliates.length} affiliates):\n${roster}`);
      setPortfolio(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setBatchRunning(false);
    }
  };

  // Pipeline All — analyze each affiliate, advance recommended stage, and queue an
  // outreach draft for anyone flagged at-risk / dormant so nobody stalls.
  const runPipelineAll = async () => {
    if (!aiOnline) { setError('AI is offline. Configure a provider in Settings.'); return; }
    setBatchRunning(true);
    const list = filtered.length ? filtered : affiliates;
    setBatchProgress({ done: 0, total: list.length, label: 'Running growth pipeline' });
    let queued = 0;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const analysis = insights[a.id] || await analyzeAffiliate(a);
      if (analysis) {
        // Apply recommended stage advancement.
        if (analysis.recommendedStage && analysis.recommendedStage !== a.stage) {
          setAffiliates(prev => prev.map(x => x.id === a.id ? { ...x, stage: analysis.recommendedStage } : x));
        }
        // Queue outreach for at-risk / dormant.
        if (['at_risk', 'dormant'].includes(analysis.status) || a.stage === 'at_risk') {
          const msg = await generateMessage(a, 'email', analysis.nextBestAction || 're-engage this affiliate warmly and offer help');
          if (msg) { await queueDraft(a, 'email', `Re-engage ${a.name}`, msg, false); queued++; }
        }
      }
      setBatchProgress({ done: i + 1, total: list.length, label: 'Running growth pipeline' });
    }
    setBatchRunning(false);
    setQueueBump(n => n + 1);
    setToast(`Pipeline complete · ${queued} outreach draft${queued === 1 ? '' : 's'} queued`);
  };

  // ── Message generation + outbound ──
  async function generateMessage(a, ch, intent) {
    const sys = `You write high-converting, warm, concise affiliate outreach for ${CHANNELS.find(c => c.id === ch)?.label || ch}.
Match the channel: SMS/DM = short and casual, Email = subject-worthy and structured. Sign as ${currentUser?.name || 'the affiliate team'}. Return ONLY the message text, no preamble.`;
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `${affiliateContext(a)}\n\nGoal: ${intent || 'check in and encourage growth'}`, systemPrompt: sys })
      });
      if (!res.ok) throw new Error('generation failed');
      return (await res.json()).response || '';
    } catch (e) { return ''; }
  }

  const handleAiDraft = async () => {
    if (!selected) return;
    if (!aiOnline) { setError('AI is offline. Configure a provider in Settings.'); return; }
    setDrafting(true);
    const text = await generateMessage(selected, channel, composeIntent);
    if (text) {
      setComposeBody(text);
      if (channel === 'email' && !composeSubject) setComposeSubject(`A quick note for you, ${selected.name.split(' ')[0]}`);
    } else {
      setError('Could not generate a draft.');
    }
    setDrafting(false);
  };

  async function queueDraft(a, ch, subject, body, notify = true) {
    try {
      await fetch(`${API_URL}/api/drafts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: String(a.id),
          ticket_subject: subject || `${CHANNELS.find(c => c.id === ch)?.label || ch} → ${a.name}`,
          draft_text: body,
          status: 'PENDING_REVIEW',
          pipeline_metadata: { channel: ch, affiliateName: a.name, affiliateId: a.id, kind: ch === 'content' ? 'content' : 'affiliate_message' },
          created_by: 'affiliate-hub'
        })
      });
      if (notify) { setQueueBump(n => n + 1); setToast('Queued for review'); }
      return true;
    } catch (e) { setError('Failed to queue message.'); return false; }
  }

  const handleQueue = async () => {
    if (!selected || !composeBody.trim()) return;
    await queueDraft(selected, channel, channel === 'email' ? composeSubject : `${CHANNELS.find(c => c.id === channel)?.label} → ${selected.name}`, composeBody, true);
    setComposeBody(''); setComposeSubject(''); setComposeIntent('');
  };

  const handleSendNow = async () => {
    if (!selected || !composeBody.trim()) return;
    if (!selected.ghlId) { setToast('No GHL id — queued instead'); return handleQueue(); }
    setSending(true);
    try {
      if (channel === 'sms') {
        await fetch(`${API_URL}/api/ghl/sms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: selected.ghlId, message: composeBody }) });
      } else if (channel === 'email') {
        await fetch(`${API_URL}/api/ghl/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: selected.ghlId, subject: composeSubject || 'A note from the team', body: composeBody }) });
      } else {
        setToast(`${CHANNELS.find(c => c.id === channel)?.label} isn't wired to auto-send — queued instead`);
        setSending(false); return handleQueue();
      }
      // Record it as sent in the queue for the paper trail.
      await queueDraft(selected, channel, `${channel === 'email' ? composeSubject : CHANNELS.find(c => c.id === channel)?.label} → ${selected.name}`, composeBody, false);
      setComposeBody(''); setComposeSubject(''); setComposeIntent('');
      setQueueBump(n => n + 1);
      setToast(`Sent via GHL (${channel.toUpperCase()})`);
    } catch (e) {
      setError('Send failed — check GHL connection. Draft kept.');
    } finally {
      setSending(false);
    }
  };

  const advanceStage = (a) => {
    const ns = a.stage === 'at_risk' ? 'growing' : nextStage(a.stage);
    setAffiliates(prev => prev.map(x => x.id === a.id ? { ...x, stage: ns } : x));
    setToast(`${a.name} → ${stageById(ns).label}`);
  };

  const addNote = () => {
    if (!selected || !noteDraft.trim()) return;
    setNotes(prev => ({ ...prev, [selected.id]: [{ t: new Date().toISOString(), text: noteDraft.trim() }, ...(prev[selected.id] || [])] }));
    setNoteDraft('');
  };

  const selectAffiliate = (a) => { setSelectedId(a.id); setDetailTab('activity'); setComposeBody(''); setComposeSubject(''); setComposeIntent(''); };

  const btn = (active, base) => `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${active ? base : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`;

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-green-600 text-white text-sm shadow-lg flex items-center gap-2">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
            aiOnline ? 'bg-green-500/20 text-green-400' : aiServerStatus === 'no-key' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${aiOnline ? 'bg-green-500' : aiServerStatus === 'no-key' ? 'bg-yellow-500' : 'bg-red-500'}`} />
            {aiOnline ? 'AI Online' : aiServerStatus === 'no-key' ? 'No API Key' : 'AI Offline'}
          </div>
          {usingSample && (
            <span className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
              Sample roster — connect GHL / First Promoters in Settings
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runProactive} disabled={!aiOnline || batchRunning} className={btn(aiOnline && !batchRunning, 'bg-cyan-600 hover:bg-cyan-700 text-white')}>
            <TrendingUp className="w-4 h-4" /> Proactive
          </button>
          <button onClick={runAnalyzeAll} disabled={!aiOnline || batchRunning} className={btn(aiOnline && !batchRunning, 'bg-purple-600 hover:bg-purple-700 text-white')}>
            {batchRunning && batchProgress.label === 'Analyzing affiliates' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />} Analyze All
          </button>
          <button onClick={runPipelineAll} disabled={!aiOnline || batchRunning} className={btn(aiOnline && !batchRunning, 'bg-cyan-600 hover:bg-cyan-700 text-white')} title="Analyze, advance stages, and queue outreach for anyone at risk">
            {batchRunning && batchProgress.label === 'Running growth pipeline' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Pipeline All
          </button>
          <button onClick={loadAffiliates} disabled={loading} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={onOpenSettings} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`} title="Settings — SOPs, signature, AI">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Batch progress */}
      {batchRunning && (
        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
          <span className="text-sm">{batchProgress.label}... {batchProgress.done}/{batchProgress.total}</span>
          <div className="flex-1 h-1.5 bg-cyan-500/20 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${batchProgress.total ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0"><AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span className="break-words">{error}</span></div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/20 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Portfolio brief (Proactive) */}
      {portfolio && (
        <div className={`p-4 rounded-xl border ${isDark ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className={`font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Portfolio Brief</h3>
            <button onClick={() => setPortfolio(null)} className={`ml-auto text-xs px-2 py-1 rounded ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-white hover:bg-gray-100'}`}>Dismiss</button>
          </div>
          <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{portfolio.summary}</p>
          {portfolio.focusToday && (
            <div className={`text-sm mb-3 p-2 rounded-lg ${isDark ? 'bg-white/5 text-cyan-200' : 'bg-white text-cyan-800'}`}>
              <span className="font-semibold">Focus today: </span>{portfolio.focusToday}
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-3">
            {['priorities', 'atRisk', 'opportunities'].map(k => Array.isArray(portfolio[k]) && portfolio[k].length > 0 && (
              <div key={k}>
                <h4 className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{k === 'atRisk' ? 'At Risk' : k}</h4>
                <ul className="space-y-1">
                  {portfolio[k].map((it, i) => <li key={i} className={`text-sm flex items-start gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><ArrowRight className="w-3 h-3 mt-1 flex-shrink-0" />{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Affiliates', value: affiliates.length, icon: Users, color: 'purple' },
          { label: 'Revenue (roster)', value: fmtMoney(totalRevenue), icon: DollarSign, color: 'green' },
          { label: 'Sub-affiliates', value: totalRecruits, icon: Link2, color: 'cyan' },
          { label: 'At Risk', value: counts.at_risk || 0, icon: AlertTriangle, color: 'red' }
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`p-4 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 text-${k.color}-500`} />
                <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{k.value}</span>
              </div>
              <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Stage filter pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStageFilter('all')} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${stageFilter === 'all' ? 'bg-purple-600 text-white' : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          All ({counts.all})
        </button>
        {STAGES.map(s => (
          <button key={s.id} onClick={() => setStageFilter(stageFilter === s.id ? 'all' : s.id)} title={s.desc}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
              stageFilter === s.id ? `bg-${s.color}-500/20 text-${s.color}-400 border border-${s.color}-500/40` : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <s.icon className="w-3.5 h-3.5" /> {s.label} ({counts[s.id] || 0})
          </button>
        ))}
      </div>

      {/* Outbound Queue */}
      <OutboundQueue key={queueBump} isDark={isDark} onReuse={(d) => {
        const meta = (() => { try { return typeof d.pipeline_metadata === 'string' ? JSON.parse(d.pipeline_metadata) : d.pipeline_metadata; } catch { return null; } })();
        const a = affiliates.find(x => String(x.id) === String(d.ticket_id) || x.id === meta?.affiliateId);
        if (a) { selectAffiliate(a); setDetailTab('compose'); setComposeBody(d.draft_text); if (meta?.channel) setChannel(meta.channel); }
      }} />

      {/* Search */}
      <div className={`p-3 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search affiliates by name, email, tier, source..."
            className={`w-full pl-10 pr-9 py-2 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
          {searchQuery && <button onClick={() => setSearchQuery('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {/* Main: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className={`lg:col-span-2 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
          <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Affiliates ({filtered.length})</h3>
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Click to open · track · interact</span>
          </div>
          <div className="divide-y divide-purple-900/10 max-h-[620px] overflow-y-auto">
            {loading && affiliates.length === 0 ? (
              <div className="p-8 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" /><p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading affiliates...</p></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center"><Users className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} /><p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No affiliates match this view</p></div>
            ) : filtered.map(a => {
              const st = stageById(a.stage);
              const ins = insights[a.id];
              const dsince = daysSince(a.lastActivity);
              return (
                <div key={a.id} onClick={() => selectAffiliate(a)}
                  className={`p-4 cursor-pointer transition-colors ${selectedId === a.id ? (isDark ? 'bg-purple-600/20' : 'bg-purple-50') : (isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50')}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-gradient-to-br from-purple-500 to-cyan-500`}>
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{a.name}</h4>
                          <span className={`px-1.5 py-0.5 text-[10px] rounded ${TIER_COLORS[a.tier] || TIER_COLORS.Prospect}`}>{a.tier}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 bg-${st.color}-500/20 text-${st.color}-400`}><st.icon className="w-3 h-3" />{st.label}</span>
                        </div>
                        <p className={`text-xs mt-1 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{a.email || 'no email'} · {a.source}</p>
                        <div className={`flex items-center gap-3 mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span className="flex items-center gap-1"><Link2 className="w-3 h-3" />{a.referrals} refs</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{a.subAffiliates} recruits</span>
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmtMoney(a.revenue)}</span>
                          {dsince != null && <span className={`flex items-center gap-1 ${dsince > 21 ? 'text-red-400' : ''}`}><Clock className="w-3 h-3" />{dsince}d</span>}
                        </div>
                        {ins && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ins.healthScore >= 70 ? 'bg-green-500/20 text-green-400' : ins.healthScore >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>Health {ins.healthScore}</span>
                            <span className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ins.nextBestAction}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {analyzingId === a.id ? <RefreshCw className="w-4 h-4 animate-spin text-purple-500" /> : !ins ? (
                        <button onClick={(e) => { e.stopPropagation(); analyzeAffiliate(a); }} className="p-1 rounded hover:bg-purple-500/20" title="Analyze with AI"><Brain className="w-4 h-4 text-purple-400" /></button>
                      ) : null}
                      <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail / interaction panel */}
        <div className={`rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
          {selected ? (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-purple-500 to-cyan-500 flex-shrink-0">{selected.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{selected.name}</h3>
                    <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selected.email}{selected.phone ? ` · ${selected.phone}` : ''}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${TIER_COLORS[selected.tier] || TIER_COLORS.Prospect}`}>{selected.tier}</span>
                      {(() => { const st = stageById(selected.stage); return <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 bg-${st.color}-500/20 text-${st.color}-400`}><st.icon className="w-3 h-3" />{st.label}</span>; })()}
                    </div>
                  </div>
                </div>
                {/* mini stats */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[['Refs', selected.referrals], ['Recruits', selected.subAffiliates], ['Conv', selected.conversions], ['Rev', fmtMoney(selected.revenue)]].map(([l, v]) => (
                    <div key={l} className={`rounded-lg p-2 text-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{v}</div>
                      <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{l}</div>
                    </div>
                  ))}
                </div>
                {/* inner tabs */}
                <div className="flex gap-1 mt-3">
                  {[['activity', 'Activity', ActivityIcon], ['insights', 'AI Insights', Brain], ['compose', 'Compose', Send]].map(([id, label, Icon]) => (
                    <button key={id} onClick={() => setDetailTab(id)} className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${detailTab === id ? 'bg-purple-600 text-white' : isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[520px]">
                {/* ACTIVITY */}
                {detailTab === 'activity' && (
                  <>
                    <div className="flex gap-2">
                      <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="Log a note or update..."
                        className={`flex-1 px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-white/5 border-purple-900/30 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                      <button onClick={addNote} className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm">Add</button>
                    </div>
                    <div className="space-y-2">
                      {[...(notes[selected.id] || []).map(n => ({ t: n.t, ch: 'note', dir: 'note', text: n.text })), ...(selected.activity || [])].length === 0 ? (
                        <p className={`text-sm p-3 rounded-lg ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>No activity yet. Log a note or send a message.</p>
                      ) : [...(notes[selected.id] || []).map(n => ({ t: n.t, ch: 'note', dir: 'note', text: n.text })), ...(selected.activity || [])].map((ev, i) => {
                        const isOut = ev.dir === 'out';
                        const isNote = ev.dir === 'note';
                        return (
                          <div key={i} className={`p-3 rounded-lg border-l-2 ${isNote ? (isDark ? 'bg-yellow-900/10 border-l-yellow-500' : 'bg-yellow-50 border-l-yellow-500') : isOut ? (isDark ? 'bg-green-900/10 border-l-green-500' : 'bg-green-50 border-l-green-500') : (isDark ? 'bg-white/5 border-l-blue-500' : 'bg-gray-50 border-l-blue-500')}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-semibold ${isNote ? 'text-yellow-400' : isOut ? 'text-green-400' : 'text-blue-400'}`}>
                                {isNote ? 'Note' : isOut ? 'You' : selected.name} {!isNote && `· ${ev.ch}`}
                              </span>
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{ev.t ? new Date(ev.t).toLocaleString() : ''}</span>
                            </div>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{ev.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* INSIGHTS */}
                {detailTab === 'insights' && (
                  insights[selected.id] ? (() => {
                    const ins = insights[selected.id];
                    return (
                      <div className="space-y-3">
                        <div className={`p-3 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10' : 'border-purple-200 bg-purple-50'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Health</span>
                            <span className={`text-lg font-bold ${ins.healthScore >= 70 ? 'text-green-400' : ins.healthScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{ins.healthScore}/100</span>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{ins.summary}</p>
                        </div>
                        {ins.nextBestAction && (
                          <div className={`p-3 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                            <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Next Best Action</p>
                            <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{ins.nextBestAction}</p>
                            <button onClick={() => { setDetailTab('compose'); setComposeIntent(ins.nextBestAction); }} className="mt-2 text-xs px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-1"><Send className="w-3 h-3" /> Draft this</button>
                          </div>
                        )}
                        {Array.isArray(ins.talkingPoints) && ins.talkingPoints.length > 0 && (
                          <div>
                            <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Talking Points</p>
                            <ul className="space-y-1">{ins.talkingPoints.map((t, i) => <li key={i} className={`text-sm flex items-start gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><span className="text-purple-400">•</span>{t}</li>)}</ul>
                          </div>
                        )}
                        {Array.isArray(ins.riskFlags) && ins.riskFlags.length > 0 && (
                          <div>
                            <p className={`text-xs font-semibold uppercase mb-1 text-red-400`}>Risk Flags</p>
                            <ul className="space-y-1">{ins.riskFlags.map((t, i) => <li key={i} className={`text-sm flex items-start gap-2 ${isDark ? 'text-red-300' : 'text-red-600'}`}><AlertTriangle className="w-3 h-3 mt-1 flex-shrink-0" />{t}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="text-center py-8">
                      <Brain className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                      <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No AI analysis yet.</p>
                      <button onClick={() => analyzeAffiliate(selected)} disabled={!aiOnline || analyzingId === selected.id} className={btn(aiOnline && analyzingId !== selected.id, 'bg-purple-600 hover:bg-purple-700 text-white') + ' mx-auto'}>
                        {analyzingId === selected.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />} Analyze
                      </button>
                    </div>
                  )
                )}

                {/* COMPOSE */}
                {detailTab === 'compose' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {CHANNELS.map(c => (
                        <button key={c.id} onClick={() => setChannel(c.id)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${channel === c.id ? 'bg-purple-600 text-white' : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          <c.icon className="w-3.5 h-3.5" /> {c.label}
                        </button>
                      ))}
                    </div>
                    <input value={composeIntent} onChange={e => setComposeIntent(e.target.value)} placeholder="What's the goal? e.g. invite to Q3 bonus tier"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-white/5 border-purple-900/30 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                    {channel === 'email' && (
                      <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject"
                        className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-white/5 border-purple-900/30 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                    )}
                    <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={7} placeholder={`Write your ${CHANNELS.find(c => c.id === channel)?.label} message, or hit AI Draft...`}
                      className={`w-full px-3 py-2 rounded-lg border text-sm resize-y ${isDark ? 'bg-white/5 border-purple-900/30 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleAiDraft} disabled={drafting || !aiOnline} className={btn(!drafting && aiOnline, 'bg-purple-600 hover:bg-purple-700 text-white')}>
                        {drafting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Draft
                      </button>
                      <button onClick={handleQueue} disabled={!composeBody.trim()} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${composeBody.trim() ? (isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900') : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>
                        <FileText className="w-4 h-4" /> Queue for Review
                      </button>
                      <button onClick={handleSendNow} disabled={sending || !composeBody.trim()} className={btn(!sending && !!composeBody.trim(), 'bg-green-600 hover:bg-green-700 text-white')}>
                        {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Now
                      </button>
                    </div>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Email & SMS send through GHL when the contact is linked. DMs and content queue for you to post. Everything lands in the Outbound Queue for a paper trail.</p>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className={`p-4 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'} space-y-2`}>
                <div className="flex gap-2">
                  <button onClick={() => advanceStage(selected)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm">
                    <ArrowRight className="w-4 h-4" /> Advance Stage
                  </button>
                  <button onClick={() => analyzeAffiliate(selected)} disabled={!aiOnline || analyzingId === selected.id} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm ${aiOnline ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`} title="Re-run AI analysis">
                    {analyzingId === selected.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <a href={FIRST_PROMOTERS_URL} target="_blank" rel="noopener noreferrer" className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>
                    <Award className="w-3.5 h-3.5" /> First Promoters <ExternalLink className="w-3 h-3" />
                  </a>
                  <a href={GHL_APP_URL} target="_blank" rel="noopener noreferrer" className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>
                    <ExternalLink className="w-3.5 h-3.5" /> Open in GHL
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <Users className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Select an affiliate to view their profile, track updates, and reach out</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
