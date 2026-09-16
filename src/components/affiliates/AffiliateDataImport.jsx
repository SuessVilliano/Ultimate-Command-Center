import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Cloud, CloudOff, FileClock, History, RotateCcw, Upload, X } from 'lucide-react';
import { parseAffiliateBookCSV } from '../../lib/affiliate-book-import';
import {
  BOOK_UPDATED_EVENT,
  getAffiliateBookMeta,
  getAffiliateBookRows,
  restoreAffiliateImport,
  storeAffiliateBook,
} from '../../lib/affiliate-book-runtime';
import { cloudStateStatus, listAffiliateImports, requestOwnerMagicLink } from '../../lib/liv8-cloud-state';

function fmt(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AffiliateDataImport({ isDark = true, buttonClass = '' }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cloud, setCloud] = useState({ configured: false, connected: false });
  const [history, setHistory] = useState([]);
  const [book, setBook] = useState(() => getAffiliateBookRows());
  const [meta, setMeta] = useState(() => getAffiliateBookMeta());

  const refresh = async () => {
    setBook(getAffiliateBookRows());
    setMeta(getAffiliateBookMeta());
    const nextCloud = await cloudStateStatus().catch(() => ({ configured: false, connected: false }));
    setCloud(nextCloud);
    if (nextCloud.connected) {
      setHistory(await listAffiliateImports(12).catch(() => []));
    } else {
      setHistory([]);
    }
  };

  useEffect(() => {
    refresh();
    const onBook = () => refresh();
    window.addEventListener(BOOK_UPDATED_EVENT, onBook);
    return () => window.removeEventListener(BOOK_UPDATED_EVENT, onBook);
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleFile = async file => {
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const parsed = parseAffiliateBookCSV(await file.text());
      const result = await storeAffiliateBook(parsed.rows, {
        filename: file.name,
        kind: parsed.kind,
        source: 'ghl-toolbar-import',
      });
      setMessage(result.cloud?.ok
        ? `Imported ${parsed.rows.length} affiliates and saved a cloud snapshot.`
        : `Imported ${parsed.rows.length} affiliates. Local + Mac copies are saved; connect LIV8 Cloud for cross-device sync.`);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Could not import that file.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const connectCloud = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await requestOwnerMagicLink();
      setMessage('Secure sign-in link sent to liv8ent@gmail.com. Open it on this device to turn on cross-device sync.');
    } catch (e) {
      setError(e?.message || 'Could not start LIV8 Cloud sign-in.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async item => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await restoreAffiliateImport(item.id);
      setMessage(`Restored ${result.rows} affiliates from ${fmt(item.imported_at)}.`);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Could not restore that snapshot.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button onClick={() => setOpen(true)} className={buttonClass} title="Import or restore your affiliate book">
      <Upload className="h-3.5 w-3.5"/>Import data
    </button>

    {open && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className={`w-full max-w-3xl overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-cyan-500/20 bg-[#070c0f] text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
        <div className={`flex items-start justify-between gap-4 border-b p-5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <div className={`text-xs uppercase tracking-[.18em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>LIV8 affiliate data</div>
            <h2 className="mt-1 text-xl font-bold">Import, sync & restore</h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Drop the newest Affiliate EXPAND CSV here. It becomes the active book, refreshes CRM matching, and is preserved as a dated snapshot.</p>
          </div>
          <button onClick={() => setOpen(false)} className={`rounded-lg p-2 ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}><X className="h-5 w-5"/></button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[1.35fr_.85fr]">
          <div className="space-y-4">
            <button
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
              className={`flex min-h-[190px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-cyan-400 bg-cyan-500/10' : isDark ? 'border-white/15 bg-white/[.025] hover:border-cyan-500/40' : 'border-slate-300 bg-slate-50 hover:border-cyan-400'}`}
            >
              <Upload className="h-9 w-9 text-cyan-400"/>
              <div className="mt-3 font-semibold">{busy ? 'Processing…' : 'Drop your weekly book here'}</div>
              <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>or click to choose the CSV from your computer</div>
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => handleFile(e.target.files?.[0])}/>

            {message && <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none"/>{message}</div>}
            {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

            <div className={`rounded-xl border p-4 ${isDark ? 'border-white/10 bg-white/[.025]' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Current active book</div>
                  <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{book.length ? `${book.length} affiliates · ${meta.filename || meta.source || 'saved roster'}` : 'No affiliate book loaded yet'}</div>
                </div>
                <div className={`text-right text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  <div>{fmt(meta.updatedAt)}</div>
                  <div>{meta.kind || ''}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${cloud.connected ? 'border-emerald-500/25 bg-emerald-500/10' : isDark ? 'border-amber-500/25 bg-amber-500/10' : 'border-amber-300 bg-amber-50'}`}>
              <div className="flex items-center gap-2 font-semibold">
                {cloud.connected ? <Cloud className="h-4 w-4 text-emerald-400"/> : <CloudOff className="h-4 w-4 text-amber-400"/>}
                {cloud.connected ? 'LIV8 Cloud synced' : 'Cross-device sync not connected'}
              </div>
              <p className={`mt-2 text-xs ${cloud.connected ? 'text-emerald-200/80' : isDark ? 'text-amber-200/80' : 'text-amber-800'}`}>
                {cloud.connected ? 'This book follows liv8ent@gmail.com across the Mac Mini, browser, and work laptop.' : 'Your local and Mac copies still work. Connect liv8ent@gmail.com once on this device to share the same saved book everywhere.'}
              </p>
              {!cloud.connected && cloud.configured && <button disabled={busy} onClick={connectCloud} className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50">Connect liv8ent@gmail.com</button>}
              {!cloud.configured && <div className="mt-2 text-xs text-amber-300">Cloud sync is waiting for the Command Center Supabase environment.</div>}
            </div>

            <div className={`rounded-xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className={`flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold ${isDark ? 'border-white/10' : 'border-slate-200'}`}><History className="h-4 w-4"/>Import history</div>
              <div className="max-h-[300px] overflow-auto p-2">
                {!cloud.connected ? <div className={`p-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Connect LIV8 Cloud to recall dated imports from any device.</div> : !history.length ? <div className={`p-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Your first cloud import will appear here.</div> : history.map(item => <div key={item.id} className={`mb-1 flex items-center justify-between gap-3 rounded-lg p-2 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{item.filename || 'Affiliate book snapshot'}</div>
                    <div className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}><FileClock className="mr-1 inline h-3 w-3"/>{fmt(item.imported_at)} · {item.row_count} rows</div>
                  </div>
                  <button disabled={busy} onClick={() => restore(item)} className={`flex-none rounded-lg border px-2 py-1.5 text-[11px] ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}><RotateCcw className="mr-1 inline h-3 w-3"/>Restore</button>
                </div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>}
  </>;
}
