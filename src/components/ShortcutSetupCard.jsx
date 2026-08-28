import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Mic, RefreshCw, ShieldCheck, Smartphone, Volume2 } from 'lucide-react';
import { API_URL } from '../config';

const LS_TOKEN = 'liv8_shortcut_pair_token_v1';

export default function ShortcutSetupCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => { try { return localStorage.getItem(LS_TOKEN) || ''; } catch { return ''; } });
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);
  const endpoint = `${API_URL}/api/shortcut/voice`;

  const loadStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/shortcut/status`);
      const text = await r.text();
      setStatus(r.ok ? JSON.parse(text) : { ok: false, error: text || `HTTP ${r.status}` });
    } catch (e) { setStatus({ ok: false, error: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadStatus(); }, []);

  const saveToken = value => {
    setToken(value);
    try { localStorage.setItem(LS_TOKEN, value); } catch {}
  };

  const testConnection = async () => {
    setTesting(true); setTest(null);
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: 'Shortcut connection test. Reply only that LIV8 voice bridge is online.', mode: 'assistant', source: 'command_center_setup' })
      });
      const text = await r.text();
      let json; try { json = JSON.parse(text); } catch { json = { error: text }; }
      setTest({ ok: r.ok && json.ok !== false, message: json.spokenText || json.response || json.error || `HTTP ${r.status}` });
    } catch (e) { setTest({ ok: false, message: e.message }); }
    finally { setTesting(false); }
  };

  const setupText = useMemo(() => `LIV8 iPhone Shortcut\n\n1. Add “Dictate Text”\n2. Add “Get Contents of URL”\nURL: ${endpoint}\nMethod: POST\nHeader: Authorization = Bearer YOUR_TOKEN\nJSON body:\ntext = Dictated Text\nmode = auto\nsource = ios_shortcut\n3. Add “Get Dictionary Value” → spokenText\n4. Add “Speak Text”\n\nOptional: include an appleHealth dictionary in the same POST to update Health OS before Juno answers.`, [endpoint]);

  const copy = async text => { try { await navigator.clipboard.writeText(text); } catch {} };

  return <section className="mb-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[.055] via-purple-500/[.035] to-transparent overflow-hidden">
    <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center gap-4 justify-between border-b border-white/10">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20"><Smartphone className="w-5 h-5 text-cyan-300" /></div>
        <div><div className="flex items-center gap-2"><h2 className="font-semibold text-white">Hands-Free LIV8</h2>{status?.configured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">SERVER READY</span>}</div><p className="text-xs text-gray-500 mt-1">One iPhone Shortcut can sync health, capture a life note, ask Juno, use tools, and speak the answer back.</p></div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={loadStatus} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-gray-300 flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Check server</button>
        <a href="shortcuts://create-shortcut" className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs font-medium flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5" />Open Shortcuts</a>
      </div>
    </div>

    <div className="p-4 sm:p-5 grid xl:grid-cols-[1.1fr_.9fr] gap-4">
      <div className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-gray-500">Production endpoint</div><div className="text-xs text-cyan-200 mt-1 break-all">{endpoint}</div></div><button onClick={() => copy(endpoint)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><Copy className="w-4 h-4" /></button></div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Private pairing token</label>
          <input type="password" value={token} onChange={e => saveToken(e.target.value)} placeholder="Paste LIV8_SHORTCUT_TOKEN or Apple Health ingest token" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-gray-700" />
          <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-600"><ShieldCheck className="w-3.5 h-3.5" />Stored only in this browser's local storage; never committed to GitHub.</div>
        </div>
        <button disabled={!token || testing} onClick={testConnection} className="w-full px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-medium flex items-center justify-center gap-2">{testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}Test voice bridge</button>
        {test && <div className={`rounded-xl border p-3 text-xs ${test.ok ? 'border-emerald-500/20 bg-emerald-500/[.05] text-emerald-200' : 'border-rose-500/20 bg-rose-500/[.05] text-rose-200'}`}>{test.ok && <CheckCircle2 className="inline w-4 h-4 mr-2" />}{test.message}</div>}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between"><div><div className="font-medium text-white text-sm">Build “Talk to LIV8”</div><div className="text-[11px] text-gray-500 mt-1">Four actions. Then it becomes a one-tap voice remote.</div></div><button onClick={() => copy(setupText)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400" title="Copy setup"><Copy className="w-4 h-4" /></button></div>
        <ol className="mt-4 space-y-3 text-xs text-gray-300">
          <li className="flex gap-3"><span className="text-cyan-300 font-bold">1</span><span><b>Dictate Text</b> — prompt “Talk to LIV8”.</span></li>
          <li className="flex gap-3"><span className="text-cyan-300 font-bold">2</span><span><b>Get Contents of URL</b> — POST to the endpoint shown here; Authorization header is <code className="text-purple-300">Bearer YOUR_TOKEN</code>; JSON: <code className="text-purple-300">text=Dictated Text, mode=auto, source=ios_shortcut</code>.</span></li>
          <li className="flex gap-3"><span className="text-cyan-300 font-bold">3</span><span><b>Get Dictionary Value</b> — key <code className="text-purple-300">spokenText</code>.</span></li>
          <li className="flex gap-3"><span className="text-cyan-300 font-bold">4</span><span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-purple-300" /><b>Speak Text</b> — speak the dictionary value.</span></li>
        </ol>
        <div className="mt-4 rounded-lg bg-purple-500/[.06] border border-purple-500/15 p-3 text-[11px] text-purple-200/80">After the base Shortcut works, add Apple Health samples to the same request and LIV8 will update Health OS before Juno answers.</div>
      </div>
    </div>
  </section>;
}
