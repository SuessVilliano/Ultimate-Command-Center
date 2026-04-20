import React, { useState, useEffect, useRef } from 'react';
import {
  Play, FileText, Mic, Video, CheckCircle, AlertCircle, Clock,
  Plus, Trash2, Save, Edit3, X, Send, Bot, User, RefreshCw,
  TrendingUp, Calendar, Layers, Mail, Instagram, Youtube,
  Facebook, Linkedin, ChevronDown, ChevronUp, BookOpen,
  Target, Zap, BarChart3, MessageSquare, StickyNote, CheckSquare,
  Circle, Radio, Film, Music, Globe, ExternalLink, Copy, Check
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

// ─── Campaign Data ────────────────────────────────────────────────────────────
const CAMPAIGN_START = new Date('2026-04-15');
const CAMPAIGN_DAY = Math.floor((new Date() - CAMPAIGN_START) / 86400000) + 1;

const PILLARS = [
  { name: 'MINDSET',    days: '01–14', color: '#A855F7', bg: 'bg-purple-500/10 border-purple-500/30' },
  { name: 'DISCIPLINE', days: '15–28', color: '#00FFFF', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  { name: 'STRATEGY',   days: '29–42', color: '#22C55E', bg: 'bg-green-500/10 border-green-500/30' },
  { name: 'REALITY',    days: '43–56', color: '#F97316', bg: 'bg-orange-500/10 border-orange-500/30' },
];

const PIPELINE_STEPS = [
  { label: 'Script',    icon: FileText, detail: '90 days ready', status: 'live' },
  { label: 'Voice',     icon: Mic,      detail: 'VoxCPM · FREE', status: 'live' },
  { label: 'HeyGen',   icon: Video,    detail: '30 credits left', status: 'partial' },
  { label: 'B-Roll',   icon: Film,     detail: 'Veo 3 · live', status: 'live' },
  { label: 'Assemble', icon: Layers,   detail: 'ffmpeg · auto', status: 'live' },
  { label: 'Post',     icon: Globe,    detail: '8 channels', status: 'live' },
];

const SCRIPTS_MINDSET = [
  { day: 1,  topic: 'Mind is the leak — psychology costs more than losses' },
  { day: 2,  topic: 'The best trade you do not take — discipline of inaction' },
  { day: 3,  topic: 'Fear as information, not instruction' },
  { day: 4,  topic: 'Patience: fewest trades, most profit' },
  { day: 5,  topic: 'Trading as a psychological laboratory' },
  { day: 6,  topic: 'Evidence-based confidence: track record before belief' },
  { day: 7,  topic: 'The solo journey: work in silence, results speak' },
  { day: 8,  topic: 'Identity shift: trader who follows plan vs. needs money today' },
  { day: 9,  topic: 'Detachment from outcome: process score vs. P&L score' },
  { day: 10, topic: 'Pre-session ten minutes: sets the quality of everything after' },
  { day: 11, topic: 'The 20-minute rule after a loss' },
  { day: 12, topic: 'Why funded traders outlast solo traders: structure vs. willpower' },
  { day: 13, topic: 'Cost of one undisciplined session: how one bad day erases weeks' },
  { day: 14, topic: 'Consistency as the only real edge' },
];

const ACTION_ITEMS = [
  { id: 1, title: 'Approve daily drafts at localhost:4444',        priority: 'critical', note: 'Do this every day. Takes 5 min. Fires the whole chain.', done: false },
  { id: 2, title: 'Top up fal.ai for Seedance / Kling B-roll',    priority: 'high',     note: 'fal.ai/dashboard/billing — even $50 generates significant footage.', done: false },
  { id: 3, title: 'Set up Trade Hybrid Community PIT token',       priority: 'high',     note: 'GHL → Trade Hybrid → Settings → Private Integrations → New token → add to .env', done: false },
  { id: 4, title: 'Monitor HeyGen credits (30 left)',              priority: 'medium',   note: 'Top up at app.heygen.com before hitting zero. ~1 credit per video.', done: false },
  { id: 5, title: 'Activate email campaigns in GHL',               priority: 'medium',   note: 'Sunday Offer · Monday Brief · Wednesday Edge — all templates ready.', done: false },
  { id: 6, title: 'Build email list — lead magnet ready',          priority: 'medium',   note: 'hybridfunding.co/free-guide — 5-Day Funded Trader Mindset Guide.', done: false },
];

const EMAILS = [
  {
    day: 'Sunday · 5 PM EST',
    name: 'THE OFFER 🔥',
    purpose: 'Convert — weekly UNITY20 promo drop',
    subject: '🔥 UNITY20 — 20% Off Every Challenge. Tonight Only.',
    tone: 'Urgent but not desperate. Calm confidence. Limited window.',
    ghl: 'SV_Weekly_Offer',
    color: 'border-purple-500/40 bg-purple-500/5',
  },
  {
    day: 'Monday · 9 AM EST',
    name: 'THE BRIEF 📈',
    purpose: 'Value — market intelligence, SV take, economic calendar',
    subject: '📈 The Week Ahead: [market headline]',
    tone: 'Authoritative. Informative. SV mentor voice.',
    ghl: 'SV_Monday_Brief',
    color: 'border-cyan-500/40 bg-cyan-500/5',
  },
  {
    day: 'Wednesday · 10 AM EST',
    name: 'THE EDGE 🧠',
    purpose: 'Educate — one concept deep dive, trader spotlight',
    subject: '🧠 The Edge #N: [concept title]',
    tone: 'Teacher mode. Practical, not theoretical. SV voice.',
    ghl: 'SV_Wednesday_Edge',
    color: 'border-green-500/40 bg-green-500/5',
  },
];

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#A855F7' }) {
  return (
    <div className="bg-[#1A1A2E] border border-white/10 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────────
function ProgressBar({ label, value, max, color = 'from-purple-600 to-cyan-500' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="text-white font-medium">{value} / {max}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────────
function OverviewTab({ isDark }) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Campaign Day"  value={`Day ${CAMPAIGN_DAY}`} sub="of 90" color="#00FFFF" />
        <StatCard label="Days Scripted" value="90"  sub="all complete" color="#22C55E" />
        <StatCard label="Videos Ready"  value="37"  sub="assembled" color="#A855F7" />
        <StatCard label="Voice Files"   value="71"  sub="generated" color="#A855F7" />
        <StatCard label="B-Roll Clips"  value="40+" sub="in library" color="#F97316" />
      </div>

      {/* Progress */}
      <div className="bg-[#1A1A2E] border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" /> Campaign Progress
        </h3>
        <ProgressBar label="Scripts written"   value={90} max={90} />
        <ProgressBar label="Voice generated"   value={71} max={90} color="from-cyan-600 to-cyan-400" />
        <ProgressBar label="Videos assembled"  value={37} max={90} color="from-purple-600 to-purple-400" />
        <ProgressBar label="Approved by you"   value={7}  max={90} color="from-green-600 to-green-400" />
        <ProgressBar label="Posted"            value={4}  max={90} color="from-orange-600 to-orange-400" />
      </div>

      {/* Pillars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PILLARS.map(p => (
          <div key={p.name} className={`border rounded-xl p-4 ${p.bg}`}>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: p.color }}>{p.name}</div>
            <div className="text-xs text-gray-400">Days {p.days}</div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-[#1A1A2E] border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" /> Production Pipeline
        </h3>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const colors = {
              live:    'border-green-500/40 bg-green-500/10 text-green-400',
              partial: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
              blocked: 'border-red-500/40 bg-red-500/10 text-red-400',
            };
            return (
              <div key={i} className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-xs font-medium ${colors[step.status]}`}>
                <Icon className="w-3.5 h-3.5" />
                <span>{step.label}</span>
                <span className="text-gray-500 hidden sm:inline">· {step.detail}</span>
                {i < PIPELINE_STEPS.length - 1 && <span className="text-gray-600 ml-1">→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Brands */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            name: 'Hybrid Funding', color: '#A855F7',
            desc: 'Challenge passes · UNITY20 · Funded traders',
            channels: ['Facebook', 'TikTok @hybridfunding'],
            url: 'https://hybridfunding.co',
          },
          {
            name: 'Trade Hybrid', color: '#22C55E',
            desc: 'Community · Chronicles · Education',
            channels: ['Facebook', 'YouTube @tradehybrid', 'Google Biz'],
            url: 'https://tradehybrid.club',
          },
          {
            name: 'SV · Suess Villiano', color: '#F97316',
            desc: 'Personal brand · AI Avatar · Mentor identity',
            channels: ['@smartsystems_ IG', '@suessvilliano YT', 'LinkedIn'],
            url: 'https://hybridfunding.co',
          },
        ].map(brand => (
          <div key={brand.name} className="bg-[#1A1A2E] border border-white/10 rounded-xl p-4">
            <div className="font-bold text-sm mb-1" style={{ color: brand.color }}>{brand.name}</div>
            <p className="text-xs text-gray-400 mb-3">{brand.desc}</p>
            <div className="space-y-1">
              {brand.channels.map(c => (
                <div key={c} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-gray-600" />{c}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scripts Tab ────────────────────────────────────────────────────────────────
function ScriptsTab({ isDark }) {
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState(null);

  const copyDay = (day) => {
    const script = SCRIPTS_MINDSET.find(s => s.day === day);
    if (script) {
      navigator.clipboard.writeText(`Day ${String(day).padStart(2,'0')} — ${script.topic}`);
      setCopied(day);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">90-Day Script Library</h3>
          <p className="text-xs text-gray-500 mt-0.5">All scripts in /SV_Content_Engine/scripts/</p>
        </div>
        <span className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
          90 / 90 ✓
        </span>
      </div>

      {/* Mindset Pillar Detail */}
      <div className="bg-[#1A1A2E] border border-purple-500/20 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-400">MINDSET — Days 01–14</span>
          <span className="text-xs text-gray-500">Current Pillar</span>
        </div>
        <div className="divide-y divide-white/5">
          {SCRIPTS_MINDSET.map(s => (
            <div
              key={s.day}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors ${s.day === CAMPAIGN_DAY ? 'bg-purple-500/10' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                ${s.day < CAMPAIGN_DAY ? 'bg-green-500/20 text-green-400' :
                  s.day === CAMPAIGN_DAY ? 'bg-purple-500/30 text-purple-300' :
                  'bg-white/5 text-gray-500'}`}>
                {String(s.day).padStart(2,'0')}
              </div>
              <span className={`text-sm flex-1 ${s.day === CAMPAIGN_DAY ? 'text-white font-medium' : 'text-gray-400'}`}>
                {s.topic}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {s.day < CAMPAIGN_DAY && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                {s.day === CAMPAIGN_DAY && <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
                <button onClick={() => copyDay(s.day)} className="text-gray-600 hover:text-gray-300 transition-colors">
                  {copied === s.day ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Other pillars collapsed */}
      {[
        { name: 'DISCIPLINE', days: '15–28', range: '15–28', color: 'cyan',   border: 'border-cyan-500/20',   accent: 'text-cyan-400' },
        { name: 'STRATEGY',   days: '29–42', range: '29–42', color: 'green',  border: 'border-green-500/20',  accent: 'text-green-400' },
        { name: 'REALITY',    days: '43–56', range: '43–56', color: 'orange', border: 'border-orange-500/20', accent: 'text-orange-400' },
        { name: 'MINDSET II', days: '57–70', range: '57–70', color: 'purple', border: 'border-purple-500/20', accent: 'text-purple-400' },
        { name: 'DISCIPLINE II', days: '71–84', range: '71–84', color: 'cyan', border: 'border-cyan-500/20', accent: 'text-cyan-400' },
        { name: 'STRATEGY II',  days: '85–90', range: '85–90', color: 'green', border: 'border-green-500/20', accent: 'text-green-400' },
      ].map(p => (
        <div key={p.name} className={`bg-[#1A1A2E] border rounded-xl ${p.border}`}>
          <button
            onClick={() => setExpanded(expanded === p.name ? null : p.name)}
            className="w-full px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold uppercase tracking-widest ${p.accent}`}>{p.name}</span>
              <span className="text-xs text-gray-500">Days {p.days}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-400">14 scripts ✓</span>
              {expanded === p.name ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
            </div>
          </button>
          {expanded === p.name && (
            <div className="px-4 pb-3 border-t border-white/5 pt-3">
              <p className="text-xs text-gray-500">Scripts located at <span className="text-cyan-400 font-mono">/SV_Content_Engine/scripts/day_{p.range.split('–')[0]}_* through day_{p.range.split('–')[1]}_*</span></p>
              <p className="text-xs text-gray-600 mt-1">5 files per day: vox_ready · short · long · social · broll_prompts</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Email Tab ──────────────────────────────────────────────────────────────────
function EmailTab({ isDark }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Weekly Email Schedule</h3>
        <p className="text-xs text-gray-500 mt-0.5">3 emails/week · From: sv@hybridfunding.co · Via GHL</p>
      </div>

      {EMAILS.map(email => (
        <div key={email.name} className={`border rounded-xl overflow-hidden ${email.color}`}>
          <div className="px-4 py-3 border-b border-white/5">
            <div className="text-xs text-gray-500 mb-1">{email.day}</div>
            <div className="font-bold text-white">{email.name}</div>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex gap-3 text-xs"><span className="text-gray-500 w-16 shrink-0">Purpose</span><span className="text-gray-300">{email.purpose}</span></div>
            <div className="flex gap-3 text-xs"><span className="text-gray-500 w-16 shrink-0">Subject</span><span className="text-gray-300">{email.subject}</span></div>
            <div className="flex gap-3 text-xs"><span className="text-gray-500 w-16 shrink-0">Tone</span><span className="text-gray-300">{email.tone}</span></div>
            <div className="flex gap-3 text-xs"><span className="text-gray-500 w-16 shrink-0">GHL</span><span className="text-cyan-400 font-mono">{email.ghl}</span></div>
          </div>
        </div>
      ))}

      {/* Welcome Sequence */}
      <div className="bg-[#1A1A2E] border border-white/10 rounded-xl p-4">
        <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-purple-400" /> Welcome Sequence (Auto on Signup)
        </h4>
        <div className="space-y-2">
          {[
            ['Day 0', 'Welcome + Free Guide Delivery — immediate'],
            ['Day 1', 'Who SV is + What Hybrid Funding stands for'],
            ['Day 3', 'Your First Challenge — what to expect'],
            ['Day 5', 'UNITY20 intro — first soft pitch'],
            ['Day 7', 'First issue of The Edge — now on weekly schedule'],
          ].map(([day, text]) => (
            <div key={day} className="flex gap-3 text-xs">
              <span className="text-purple-400 font-bold w-12 shrink-0">{day}</span>
              <span className="text-gray-400">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Notes Tab ──────────────────────────────────────────────────────────────────
function NotesTab({ isDark }) {
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sv_engine_notes') || '[]'); }
    catch { return []; }
  });
  const [editing, setEditing] = useState(null); // null = list, 'new' = new note, id = edit
  const [form, setForm] = useState({ title: '', body: '', tag: 'general' });

  const saveNotes = (updated) => {
    setNotes(updated);
    localStorage.setItem('sv_engine_notes', JSON.stringify(updated));
  };

  const startNew = () => {
    setForm({ title: '', body: '', tag: 'general' });
    setEditing('new');
  };

  const startEdit = (note) => {
    setForm({ title: note.title, body: note.body, tag: note.tag || 'general' });
    setEditing(note.id);
  };

  const saveNote = () => {
    if (!form.title.trim()) return;
    if (editing === 'new') {
      const newNote = { id: Date.now(), title: form.title, body: form.body, tag: form.tag, created: new Date().toLocaleDateString() };
      saveNotes([newNote, ...notes]);
    } else {
      saveNotes(notes.map(n => n.id === editing ? { ...n, title: form.title, body: form.body, tag: form.tag } : n));
    }
    setEditing(null);
  };

  const deleteNote = (id) => saveNotes(notes.filter(n => n.id !== id));

  const TAGS = ['general', 'idea', 'content', 'campaign', 'technical', 'urgent'];
  const TAG_COLORS = {
    general: 'text-gray-400 bg-gray-500/20', idea: 'text-yellow-400 bg-yellow-500/20',
    content: 'text-purple-400 bg-purple-500/20', campaign: 'text-cyan-400 bg-cyan-500/20',
    technical: 'text-blue-400 bg-blue-500/20', urgent: 'text-red-400 bg-red-500/20',
  };

  if (editing !== null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{editing === 'new' ? 'New Note' : 'Edit Note'}</h3>
          <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Note title..."
          className="w-full bg-[#1A1A2E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
        />
        <div className="flex flex-wrap gap-2">
          {TAGS.map(t => (
            <button
              key={t}
              onClick={() => setForm(f => ({ ...f, tag: t }))}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                form.tag === t ? TAG_COLORS[t] + ' border-current' : 'text-gray-600 bg-white/5 border-white/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <textarea
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          placeholder="Write your note here..."
          rows={10}
          className="w-full bg-[#1A1A2E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none"
        />
        <button
          onClick={saveNote}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" /> Save Note
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Notes</h3>
          <p className="text-xs text-gray-500 mt-0.5">{notes.length} saved · stored locally on this device</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="bg-[#1A1A2E] border border-white/10 rounded-xl p-8 text-center">
          <StickyNote className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No notes yet.</p>
          <p className="text-gray-600 text-xs mt-1">Tap "New Note" to save ideas, reminders, or anything you want to come back to.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="bg-[#1A1A2E] border border-white/10 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${TAG_COLORS[note.tag] || TAG_COLORS.general}`}>{note.tag}</span>
                  <span className="text-white font-medium text-sm truncate">{note.title}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(note)} className="text-gray-600 hover:text-gray-300 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteNote(note.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {note.body && (
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 whitespace-pre-wrap">{note.body}</p>
              )}
              <p className="text-xs text-gray-600 mt-2">{note.created}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Actions Tab ────────────────────────────────────────────────────────────────
function ActionsTab({ isDark }) {
  const [items, setItems] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sv_engine_actions') || 'null');
      return stored || ACTION_ITEMS;
    } catch { return ACTION_ITEMS; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', note: '', priority: 'medium' });

  const saveItems = (updated) => {
    setItems(updated);
    localStorage.setItem('sv_engine_actions', JSON.stringify(updated));
  };

  const toggleDone = (id) => saveItems(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const deleteItem = (id) => saveItems(items.filter(i => i.id !== id));

  const addItem = () => {
    if (!form.title.trim()) return;
    const newItem = { id: Date.now(), title: form.title, note: form.note, priority: form.priority, done: false };
    saveItems([...items, newItem]);
    setForm({ title: '', note: '', priority: 'medium' });
    setShowAdd(false);
  };

  const PRIORITY_STYLE = {
    critical: 'border-l-red-500 bg-red-500/5',
    high:     'border-l-yellow-500 bg-yellow-500/5',
    medium:   'border-l-purple-500 bg-purple-500/5',
    low:      'border-l-gray-500 bg-white/3',
  };
  const PRIORITY_LABEL = {
    critical: 'text-red-400', high: 'text-yellow-400', medium: 'text-purple-400', low: 'text-gray-500',
  };

  const pending = items.filter(i => !i.done);
  const done    = items.filter(i => i.done);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Action Items</h3>
          <p className="text-xs text-gray-500 mt-0.5">{pending.length} pending · {done.length} done</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#1A1A2E] border border-purple-500/30 rounded-xl p-4 space-y-3">
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Task title..."
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
          <input
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="Notes / details (optional)..."
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
          <div className="flex gap-2">
            {['critical','high','medium','low'].map(p => (
              <button
                key={p}
                onClick={() => setForm(f => ({ ...f, priority: p }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize
                  ${form.priority === p ? `${PRIORITY_LABEL[p]} border-current bg-white/5` : 'text-gray-600 border-white/10'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addItem} className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors">Save</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-xs transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {pending.map(item => (
          <div key={item.id} className={`border border-l-4 rounded-xl p-4 ${PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.medium}`}>
            <div className="flex items-start gap-3">
              <button onClick={() => toggleDone(item.id)} className="mt-0.5 shrink-0 text-gray-600 hover:text-green-400 transition-colors">
                <Circle className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{item.title}</span>
                  <span className={`text-xs uppercase tracking-wide font-bold ${PRIORITY_LABEL[item.priority]}`}>{item.priority}</span>
                </div>
                {item.note && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.note}</p>}
              </div>
              <button onClick={() => deleteItem(item.id)} className="shrink-0 text-gray-700 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Completed</p>
          <div className="space-y-2">
            {done.map(item => (
              <div key={item.id} className="border border-white/5 rounded-xl p-3 opacity-50">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleDone(item.id)} className="shrink-0 text-green-500">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-500 line-through flex-1">{item.title}</span>
                  <button onClick={() => deleteItem(item.id)} className="shrink-0 text-gray-700 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ContentEngine Page ────────────────────────────────────────────────────
export default function ContentEngine() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState('overview');

  const TABS = [
    { id: 'overview', label: 'Overview',   icon: BarChart3 },
    { id: 'scripts',  label: 'Scripts',    icon: FileText },
    { id: 'email',    label: 'Email',      icon: Mail },
    { id: 'notes',    label: 'Notes',      icon: StickyNote },
    { id: 'actions',  label: 'Actions',    icon: CheckSquare },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs text-cyan-400 font-medium uppercase tracking-widest">Live · Campaign Day {CAMPAIGN_DAY}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Content Engine</h1>
          <p className="text-gray-500 text-sm mt-0.5">SV · Hybrid Funding · 90-Day Campaign</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="http://localhost:4444"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl text-xs font-semibold transition-colors"
          >
            <Play className="w-3.5 h-3.5" /> Approve Drafts
          </a>
          <a
            href="https://github.com/SuessVilliano/sv-content-engine"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> GitHub
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1A1A2E] border border-white/10 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-1 justify-center
                ${isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab isDark={isDark} />}
      {tab === 'scripts'  && <ScriptsTab  isDark={isDark} />}
      {tab === 'email'    && <EmailTab    isDark={isDark} />}
      {tab === 'notes'    && <NotesTab    isDark={isDark} />}
      {tab === 'actions'  && <ActionsTab  isDark={isDark} />}
    </div>
  );
}
