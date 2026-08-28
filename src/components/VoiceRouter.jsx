import React, { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Copy, Save, X, Wand2, FileText, Check, RefreshCw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

const DESTINATIONS = [
  { id: 'auto', label: 'Auto Route', hint: 'LIV8 decides where this belongs' },
  { id: 'juno', label: 'Juno', hint: 'Ask or tell your AI assistant' },
  { id: 'journal', label: 'Life Journal', hint: 'Food, mood, stress, sleep, wins, life' },
  { id: 'note', label: 'Note', hint: 'Keep a quick private note' },
  { id: 'memory', label: 'Memory', hint: 'Save context, decisions and things to remember' },
  { id: 'task', label: 'Task', hint: 'Route action items through Juno' },
  { id: 'trading', label: 'Trading', hint: 'Route trading notes to the Trading OS' },
];

function classifyJournalCategory(text = '') {
  const t = text.toLowerCase();
  if (/\b(ate|eaten|breakfast|lunch|dinner|snack|meal|protein|calorie|drank)\b/.test(t)) return 'food';
  if (/\b(stress|stressed|overwhelmed|pressure|tense)\b/.test(t)) return 'stress';
  if (/\b(tired|drained|energy|fatigue|sleepy|energized)\b/.test(t)) return 'energy';
  if (/\b(slept|sleep|nap|woke up)\b/.test(t)) return 'sleep';
  if (/\b(workout|worked out|exercise|walked|walk|bike|ride|gym|training)\b/.test(t)) return 'movement';
  if (/\b(jovi|jionni|justis|family|kids|son)\b/.test(t)) return 'family';
  if (/\b(trade|traded|overtraded|revenge trade|setup)\b/.test(t)) return 'trading';
  if (/\b(proud|win|accomplished|finished|crushed it)\b/.test(t)) return 'win';
  if (/\b(frustrated|struggled|stuck|procrastinated|distracted)\b/.test(t)) return 'friction';
  if (/\b(feel|feeling|mood|happy|sad|down|anxious|calm|excited)\b/.test(t)) return 'mood';
  return 'note';
}

function autoDestination(text = '') {
  const t = text.toLowerCase().trim();
  if (/^(log|journal|record|save this to my journal|life journal)\b/.test(t)) return 'journal';
  if (/^(remember|save this memory|memory|don't forget|do not forget)\b/.test(t)) return 'memory';
  if (/\b(i feel|feeling|stress|stressed|tired|drained|slept|sleep|ate|breakfast|lunch|dinner|workout|worked out|family time|proud of|frustrated)\b/.test(t)) return 'journal';
  if (/\b(task|todo|to-do|remind me|i need to|need to do|follow up|follow-up)\b/.test(t)) return 'task';
  if (/\b(mnq|nq|es|futures|trade|trading|entry|stop loss|take profit|qqe|order block|market)\b/.test(t)) return 'trading';
  if (/\b(remember|decision|decided|context|important|idea for later|preference)\b/.test(t)) return 'memory';
  return 'juno';
}

function noteStore(text) {
  const key = 'voice_notes';
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  const note = { id: Date.now().toString(), text, createdAt: new Date().toISOString(), source: 'voice_router' };
  localStorage.setItem(key, JSON.stringify([note, ...rows]));
  return note;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

export default function VoiceRouter({ isOpen, onClose, onNavigate }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [destination, setDestination] = useState('auto');
  const [language, setLanguage] = useState('en-US');
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [speakReply, setSpeakReply] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.onresult = (event) => {
      let nextInterim = '';
      let nextFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) nextFinal += `${event.results[i][0].transcript} `;
        else nextInterim += event.results[i][0].transcript;
      }
      if (nextFinal) setTranscript(prev => `${prev}${nextFinal}`);
      setInterim(nextInterim);
    };
    recognition.onend = () => {
      if (recognitionRef.current?._shouldContinue) {
        try { recognition.start(); } catch {}
      } else setIsListening(false);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') setReceipt({ ok: false, title: 'Mic error', message: event.error });
    };
    recognitionRef.current = recognition;
    return () => {
      recognition._shouldContinue = false;
      try { recognition.stop(); } catch {}
    };
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setReceipt({ ok: false, title: 'Voice unavailable', message: 'This browser does not expose speech recognition.' });
      return;
    }
    if (isListening) {
      recognitionRef.current._shouldContinue = false;
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
      return;
    }
    setReceipt(null);
    recognitionRef.current._shouldContinue = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {}
  };

  const speak = (text) => {
    if (!speakReply || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    window.speechSynthesis.speak(u);
  };

  const sendToJuno = async (text, context = 'general') => {
    const prefix = context === 'task'
      ? 'VOICE ROUTE: Treat the following as a task/action request. Use available tools and preserve approval gates for external writes. '
      : context === 'trading'
        ? 'VOICE ROUTE: Treat the following as trading context. Use Hybrid Journal/Trading OS tools when appropriate. Do not place a live trade without explicit confirmation. '
        : 'VOICE ROUTE: Respond as Juno, the LIV8 Commander. ';
    const data = await postJson(`${API_URL}/api/commander/chat`, { message: `${prefix}\n\n${text}` });
    return data.response || data.text || 'Done.';
  };

  const routeTranscript = async (forcedDestination = destination) => {
    const text = transcript.trim();
    if (!text || sending) return;
    const target = forcedDestination === 'auto' ? autoDestination(text) : forcedDestination;
    setSending(true);
    setReceipt({ ok: true, pending: true, title: `Routing to ${DESTINATIONS.find(x => x.id === target)?.label || target}…`, message: 'Turning your words into structured context.' });
    try {
      let responseText = '';
      if (target === 'note') {
        noteStore(text);
        responseText = 'Saved to your private notes.';
      } else if (target === 'journal') {
        const category = classifyJournalCategory(text);
        await postJson(`${API_URL}/api/life/journal`, { text, category, source: 'voice_router', tags: ['voice'] });
        responseText = `Logged to your Life Journal as ${category}.`;
      } else if (target === 'memory') {
        await postJson(`${API_URL}/api/memory/vault`, {
          content: text,
          summary: text.length > 180 ? `${text.slice(0, 177)}…` : text,
          title: 'Voice memory',
          source: 'voice_router',
          agent: 'Juno',
          domain: 'personal',
          item_type: 'observation',
          importance: 6,
          tags: ['voice'],
        });
        responseText = 'Saved to your Memory Vault.';
      } else if (target === 'task') {
        responseText = await sendToJuno(text, 'task');
      } else if (target === 'trading') {
        responseText = await sendToJuno(text, 'trading');
      } else {
        responseText = await sendToJuno(text, 'general');
      }
      setReceipt({ ok: true, title: `Sent to ${DESTINATIONS.find(x => x.id === target)?.label || target}`, message: responseText, target });
      if (['juno', 'task', 'trading'].includes(target)) speak(responseText);
    } catch (error) {
      setReceipt({ ok: false, title: 'Route failed', message: error?.message || 'Could not send transcript.' });
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = async () => {
    const text = transcript.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#090a10] border border-purple-900/40' : 'bg-white border border-gray-200'}`} style={{ maxHeight: '92vh' }}>
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-cyan-500"><Mic className="w-5 h-5 text-white" /></div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>LIV8 Voice Router</h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Speak once. Route it anywhere in your life OS.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={language} onChange={e => setLanguage(e.target.value)} className={`text-xs rounded-lg px-2 py-1 border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`}>
              <option value="en-US">EN-US</option><option value="es-ES">ES</option>
            </select>
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 70px)' }}>
          <div className="flex flex-col items-center mb-4">
            <button onClick={toggleListening} className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,.45)] animate-pulse' : 'bg-gradient-to-br from-green-500 to-cyan-500 hover:scale-105'}`}>
              {isListening ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
            </button>
            <p className={`mt-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{isListening ? 'Listening… tap to stop' : 'Tap and talk naturally'}</p>
          </div>

          <textarea value={`${transcript}${interim}`} onChange={e => { setTranscript(e.target.value); setInterim(''); }} rows={6} placeholder="Your transcript appears here…" className={`w-full px-4 py-3 rounded-xl border text-sm resize-none ${isDark ? 'bg-white/5 border-purple-900/30 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Send transcript to</div>
              <label className={`text-xs flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <input type="checkbox" checked={speakReply} onChange={e => setSpeakReply(e.target.checked)} /> Speak Juno reply
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {DESTINATIONS.map(item => (
                <button key={item.id} onClick={() => setDestination(item.id)} title={item.hint} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${destination === item.id ? 'bg-purple-600 border-purple-500 text-white' : isDark ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}>{item.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => routeTranscript()} disabled={!transcript.trim() || sending} className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2">
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {destination === 'auto' ? 'Route intelligently' : `Send to ${DESTINATIONS.find(x => x.id === destination)?.label}`}
            </button>
            <button onClick={copyToClipboard} disabled={!transcript.trim()} className={`px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-800'} disabled:opacity-40`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={() => { setTranscript(''); setInterim(''); setReceipt(null); }} disabled={!transcript.trim()} className={`px-3 py-2.5 rounded-lg text-sm ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-800'} disabled:opacity-40`}>Clear</button>
          </div>

          {receipt && (
            <div className={`mt-4 rounded-xl border p-4 ${receipt.pending ? 'border-purple-500/30 bg-purple-500/10' : receipt.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
              <div className={`font-semibold text-sm ${receipt.ok ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : 'text-red-400'}`}>{receipt.title}</div>
              <div className={`mt-1 text-sm whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{receipt.message}</div>
              {receipt.ok && receipt.target === 'memory' && onNavigate && <button onClick={() => { onNavigate('memory-vault'); onClose(); }} className="mt-2 text-xs text-cyan-400 hover:underline">Open Memory Vault →</button>}
              {receipt.ok && receipt.target === 'journal' && onNavigate && <button onClick={() => { onNavigate('health-os'); onClose(); }} className="mt-2 text-xs text-cyan-400 hover:underline">Open Health OS →</button>}
            </div>
          )}

          <div className={`mt-5 p-3 rounded-xl text-xs ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>Examples:</strong> “I feel drained and stressed” → Life Journal · “Remember this decision…” → Memory Vault · “Remind me to call…” → Task/Juno · “MNQ setup looked clean…” → Trading OS.
          </div>
        </div>
      </div>
    </div>
  );
}
