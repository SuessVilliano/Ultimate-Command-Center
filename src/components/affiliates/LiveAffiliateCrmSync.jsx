import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock3, Database, FileSpreadsheet,
  Mail, MessageSquare, Phone, RefreshCw, Search, Server, StickyNote, UserRound,
  XCircle
} from 'lucide-react';
import { API_URL } from '../../config';

const BOOK_KEY = 'liv8_ghl_reactivation_book_v1';
const BOOK_UPDATED_EVENT = 'liv8:affiliate-book-updated';
const LIVE_CACHE_KEY = 'liv8_ghl_company_live_sync_v1';

function readJson(storage, key, fallback) {
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readBook() {
  const rows = readJson(sessionStorage, BOOK_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function readCache() {
  const value = readJson(localStorage, LIVE_CACHE_KEY, null);
  return value && Array.isArray(value.records) ? value : null;
}

function labelForImported(row = {}) {
  return row.name || row.email || row.promoterId || row.id || 'Unknown affiliate';
}

function displayNote(note = {}) {
  return note.body || note.note || note.text || note.message || '';
}

function noteDate(note = {}) {
  return note.dateAdded || note.createdAt || note.created_at || note.updatedAt || '';
}

function activityDate(item = {}) {
  return item.lastMessageDate || item.lastMessageAt || item.updatedAt || item.dateUpdated || item.dateAdded || '';
}

function fmtDate(value) {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value ?? '—'}</div>
    </div>
  );
}

export default function LiveAffiliateCrmSync({ isDark = true }) {
  const [book, setBook] = useState(() => readBook());
  const [cache, setCache] = useState(() => readCache());
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [toast, setToast] = useState('');

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/liv8-connect/status?account=company`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setStatus(data);
    } catch (error) {
      setStatus({ highlevel: { configured: false }, error: error.message });
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const onBook = () => setBook(readBook());
    window.addEventListener(BOOK_UPDATED_EVENT, onBook);
    return () => window.removeEventListener(BOOK_UPDATED_EVENT, onBook);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const records = cache?.records || [];
  const selected = records.find((record, index) => {
    const key = record?.contact?.id || record?.imported?.email || record?.imported?.id || `row-${index}`;
    return key === selectedKey;
  }) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(record => {
      const contact = record.contact || {};
      const imported = record.imported || {};
      return [contact.name, contact.email, contact.phone, imported.name, imported.email, imported.id, imported.promoterId]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [records, query]);

  const matched = records.filter(r => r.matched).length;
  const unmatched = records.length - matched;
  const companyConfigured = Boolean(status?.highlevel?.configured);
  const staffConfigured = Boolean(status?.staffUserConfigured);

  const syncEverything = async () => {
    setSyncError('');
    if (!book.length) {
      setSyncError('Import your weekly affiliate book first. The import defines the roster; GHL supplies the live CRM record.');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/liv8-connect/affiliate/sync?account=company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliates: book, includeNotes: true, includeActivity: true, account: 'company' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Company CRM sync failed');
      localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(data));
      setCache(data);
      const first = data.records?.find(r => r.matched) || data.records?.[0];
      if (first) setSelectedKey(first.contact?.id || first.imported?.email || first.imported?.id || null);
      setToast(`Synced ${data.matched}/${data.total} affiliates with live GHL`);
      await loadStatus();
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const refreshSelected = async (contactId) => {
    if (!contactId || !cache) return;
    try {
      const [contactRes, notesRes, activityRes] = await Promise.all([
        fetch(`${API_URL}/api/liv8-connect/highlevel/contacts/${encodeURIComponent(contactId)}?account=company`, { cache: 'no-store' }),
        fetch(`${API_URL}/api/liv8-connect/highlevel/contacts/${encodeURIComponent(contactId)}/notes?account=company`, { cache: 'no-store' }),
        fetch(`${API_URL}/api/liv8-connect/highlevel/contacts/${encodeURIComponent(contactId)}/activity?account=company`, { cache: 'no-store' }),
      ]);
      const [contactData, notesData, activityData] = await Promise.all([
        contactRes.json().catch(() => ({})), notesRes.json().catch(() => ({})), activityRes.json().catch(() => ({})),
      ]);
      if (!contactRes.ok) throw new Error(contactData.error || 'Could not refresh contact');
      const raw = contactData.contact || contactData;
      const normalized = {
        ...(selected?.contact || {}),
        id: raw.id || raw.contactId || contactId,
        name: raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(' ') || raw.email || 'Unknown',
        firstName: raw.firstName || null,
        lastName: raw.lastName || null,
        email: raw.email || null,
        phone: raw.phone || null,
        tags: raw.tags || [],
        assignedTo: raw.assignedTo || raw.assignedUserId || null,
        dateAdded: raw.dateAdded || raw.createdAt || null,
        dateUpdated: raw.dateUpdated || raw.updatedAt || null,
        customFields: raw.customFields || raw.customField || [],
        source: raw.source || null,
        raw,
      };
      const next = {
        ...cache,
        syncedAt: new Date().toISOString(),
        records: cache.records.map(record => record?.contact?.id === contactId ? {
          ...record,
          contact: normalized,
          notes: notesRes.ok ? (notesData.notes || []) : record.notes,
          activity: activityRes.ok ? (activityData.activity || []) : record.activity,
          syncedAt: new Date().toISOString(),
        } : record),
      };
      localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(next));
      setCache(next);
    } catch (error) {
      setSyncError(error.message);
    }
  };

  const addNote = async () => {
    const contactId = selected?.contact?.id;
    const body = noteDraft.trim();
    if (!contactId || !body) return;
    setSavingNote(true);
    setSyncError('');
    try {
      const res = await fetch(`${API_URL}/api/liv8-connect/highlevel/contacts/${encodeURIComponent(contactId)}/notes?account=company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, account: 'company' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save CRM note');
      setNoteDraft('');
      await refreshSelected(contactId);
      setToast('Note saved to live HighLevel contact');
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setSavingNote(false);
    }
  };

  const selectedImported = selected?.imported || {};
  const selectedContact = selected?.contact || null;

  return (
    <section className={`rounded-2xl border ${isDark ? 'border-cyan-500/20 bg-slate-950/70' : 'border-cyan-200 bg-white'} overflow-hidden`}>
      {toast && <div className="fixed bottom-6 right-6 z-[80] rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white shadow-xl">{toast}</div>}

      <div className="border-b border-white/10 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-slate-100">Live Affiliate CRM</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              HighLevel Company CRM is the source of truth for contact data, notes and activity. Your weekly import supplies the assigned roster and fresh affiliate-performance metrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusLoading ? (
              <span className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">Checking company connection…</span>
            ) : companyConfigured && staffConfigured ? (
              <span className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-300"><CheckCircle2 className="h-4 w-4" /> LIVE GHL — Company</span>
            ) : (
              <span className="flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-300"><XCircle className="h-4 w-4" /> Company CRM not fully configured</span>
            )}
            <button onClick={syncEverything} disabled={syncing || !companyConfigured || !staffConfigured} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing Everything…' : 'Sync Everything'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Weekly import" value={`${book.length} rows`} />
          <Stat label="Live matched" value={cache ? matched : 'Not synced'} />
          <Stat label="Unmatched" value={cache ? unmatched : '—'} />
          <Stat label="Last sync" value={cache?.syncedAt ? fmtDate(cache.syncedAt) : 'Never'} />
          <Stat label="Authority" value="GHL Company" />
        </div>

        {!companyConfigured && !statusLoading && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>The app will not silently fall back to sandbox for this workspace. Configure the company PIT + company location + staff user before live sync can run.</span>
          </div>
        )}
        {syncError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" /> {syncError}
          </div>
        )}
      </div>

      {!cache ? (
        <div className="p-8 text-center">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-600" />
          <h3 className="mt-3 font-semibold text-slate-200">Import your weekly book, then press Sync Everything</h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">The import remains performance/enrichment data. Live CRM fields are pulled from the company HighLevel account and cached only as a working copy.</p>
        </div>
      ) : (
        <div className="grid min-h-[560px] lg:grid-cols-[340px_1fr]">
          <div className="border-r border-white/10 p-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search synced affiliates…" className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-cyan-500/50" />
            </div>
            <div className="max-h-[690px] space-y-1 overflow-auto pr-1">
              {filtered.map((record, index) => {
                const contact = record.contact || {};
                const imported = record.imported || {};
                const key = contact.id || imported.email || imported.id || `row-${index}`;
                const active = key === selectedKey;
                return (
                  <button key={key} onClick={() => setSelectedKey(key)} className={`w-full rounded-lg border px-3 py-3 text-left transition ${active ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-transparent hover:bg-white/5'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium text-slate-200">{contact.name || labelForImported(imported)}</div>
                      {record.matched ? <CheckCircle2 className="h-4 w-4 flex-none text-emerald-400" /> : <AlertTriangle className="h-4 w-4 flex-none text-amber-400" />}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">{contact.email || imported.email || 'No email'}</div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{record.matched ? 'LIVE GHL' : record.reason || 'Unmatched'}</span>
                      {imported.currQ != null && <span>• Q: {imported.currQ}</span>}
                      {imported.lifetime != null && <span>• LT: {imported.lifetime}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 md:p-5">
            {!selected ? (
              <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-slate-500">Select an affiliate to view the live CRM record.</div>
            ) : !selected.matched || !selectedContact ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
                <div className="flex items-center gap-2 font-semibold text-amber-200"><AlertTriangle className="h-5 w-5" /> No exact company CRM match</div>
                <p className="mt-2 text-sm text-amber-100/70">{labelForImported(selectedImported)} stayed in your weekly roster but was not merged with a CRM contact. Reason: {selected.reason || 'not found'}.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <UserRound className="h-5 w-5 text-cyan-400" />
                      <h3 className="text-xl font-semibold text-slate-100">{selectedContact.name}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                      {selectedContact.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {selectedContact.email}</span>}
                      {selectedContact.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {selectedContact.phone}</span>}
                      <span className="flex items-center gap-1"><Server className="h-3.5 w-3.5" /> GHL ID: {selectedContact.id}</span>
                    </div>
                  </div>
                  <button onClick={() => refreshSelected(selectedContact.id)} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/15"><RefreshCw className="h-4 w-4" /> Refresh contact</button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Lifetime trials" value={selectedImported.lifetime ?? '—'} />
                  <Stat label="Current quarter" value={selectedImported.currQ ?? '—'} />
                  <Stat label="Last MRR" value={selectedImported.lastMrr != null ? `$${selectedImported.lastMrr}` : '—'} />
                  <Stat label="CRM updated" value={fmtDate(selectedContact.dateUpdated)} />
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-200"><StickyNote className="h-4 w-4 text-amber-300" /> GHL Notes</div>
                      <span className="text-xs text-slate-500">{selected.notes?.length || 0} notes</span>
                    </div>
                    <div className="mb-3 flex gap-2">
                      <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2} placeholder="Write a note directly to this HighLevel contact…" className="min-h-[72px] flex-1 rounded-lg border border-white/10 bg-slate-950/50 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500/50" />
                      <button onClick={addNote} disabled={savingNote || !noteDraft.trim()} className="self-stretch rounded-lg bg-cyan-600 px-3 text-sm font-semibold text-white disabled:opacity-40">{savingNote ? 'Saving…' : 'Save'}</button>
                    </div>
                    <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                      {(selected.notes || []).length === 0 ? <div className="py-6 text-center text-sm text-slate-500">No CRM notes returned.</div> : (selected.notes || []).map((note, index) => (
                        <div key={note.id || index} className="rounded-lg border border-white/10 bg-black/10 p-3">
                          <div className="text-sm whitespace-pre-wrap text-slate-300">{displayNote(note) || 'Note'}</div>
                          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><Clock3 className="h-3 w-3" /> {fmtDate(noteDate(note))}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-200"><Activity className="h-4 w-4 text-violet-300" /> CRM Activity</div>
                      <span className="text-xs text-slate-500">{selected.activity?.length || 0} conversations</span>
                    </div>
                    <div className="max-h-[470px] space-y-2 overflow-auto pr-1">
                      {(selected.activity || []).length === 0 ? <div className="py-6 text-center text-sm text-slate-500">No conversation activity returned.</div> : (selected.activity || []).map((item, index) => (
                        <div key={item.id || index} className="rounded-lg border border-white/10 bg-black/10 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><MessageSquare className="h-3.5 w-3.5" /> {item.lastMessageType || item.type || item.channel || 'Conversation'}</div>
                            <div className="text-[11px] text-slate-500">{fmtDate(activityDate(item))}</div>
                          </div>
                          <div className="mt-2 text-sm text-slate-300">{item.lastMessageBody || item.lastMessage || item.lastMessageText || item.subject || 'Conversation activity'}</div>
                          {item.status && <div className="mt-2 text-[11px] text-slate-500">Status: {item.status}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-slate-200"><FileSpreadsheet className="h-4 w-4 text-emerald-300" /> Weekly Import Enrichment</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Status" value={selectedImported.activeStatus || '—'} />
                    <Stat label="Award" value={selectedImported.award || '—'} />
                    <Stat label="Endorsement" value={selectedImported.endorsement || '—'} />
                    <Stat label="Niche" value={selectedImported.niche || '—'} />
                  </div>
                  {selectedImported.story && <div className="mt-3 rounded-lg bg-black/10 p-3 text-sm text-slate-400">{selectedImported.story}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
