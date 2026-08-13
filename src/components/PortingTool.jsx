import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, ArrowLeft, Phone, Upload, FileText, Download, Send,
  Plus, Trash2, MessageSquare, Bot, User as UserIcon, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Copy, Sparkles, ClipboardPaste
} from 'lucide-react';

const SERVER_BASE = (() => {
  if (typeof window === 'undefined') return '';
  const { hostname, protocol } = window.location;
  return `${protocol}//${hostname}:3005`;
})();

const EMPTY_NUMBER = { number: '', type: 'LOCAL', carrier: '', account_number: '', pin: '' };

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  businessName: '',
  email: '',
  customerType: 'business',
  locationId: '',
  address: { street: '', city: '', state: '', zip: '' },
  phone_numbers: [{ ...EMPTY_NUMBER }],
  notes: ''
};

const STEPS = [
  { key: 'paste',     label: 'Paste' },
  { key: 'edit',      label: 'Review' },
  { key: 'check',     label: 'Eligibility' },
  { key: 'loa',       label: 'LOA' },
  { key: 'submit',    label: 'Submit' }
];

function normalizePhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return raw || '';
}

function classes(...c) { return c.filter(Boolean).join(' '); }

export default function PortingTool({ isDark = true, prefillData = null }) {
  const [step, setStep] = useState('paste');
  const [form, setForm] = useState(EMPTY_FORM);
  const [pasteText, setPasteText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractMethod, setExtractMethod] = useState(null);
  const [error, setError] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [loaMode, setLoaMode] = useState('single');
  const [loaLoading, setLoaLoading] = useState(false);
  const [billFile, setBillFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // Chat assistant
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (prefillData) {
      setForm(prev => ({
        ...prev,
        firstName: prefillData.firstName || prev.firstName,
        lastName: prefillData.lastName || prev.lastName,
        email: prefillData.email || prev.email,
        locationId: prefillData.locationId || prev.locationId
      }));
      if (prefillData.firstName || prefillData.email) setStep('edit');
    }
  }, [prefillData]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, chatOpen]);

  const stepIdx = STEPS.findIndex(s => s.key === step);

  // ------------------------------------------------------------------
  // API calls
  // ------------------------------------------------------------------

  async function runExtract() {
    if (pasteText.trim().length < 10) {
      setError('Paste at least 10 characters of ticket content');
      return;
    }
    setError(null);
    setExtracting(true);
    try {
      const r = await fetch(`${SERVER_BASE}/api/porting/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Extract failed');
      const e = j.extracted || {};
      setExtractMethod(j.method || null);
      setForm(prev => ({
        ...prev,
        firstName: e.firstName || prev.firstName,
        lastName: e.lastName || prev.lastName,
        businessName: e.businessName || prev.businessName,
        email: e.email || prev.email,
        customerType: e.customerType || prev.customerType,
        notes: e.notes || prev.notes,
        address: {
          street: e.address?.street || prev.address.street,
          city: e.address?.city || prev.address.city,
          state: e.address?.state || prev.address.state,
          zip: e.address?.zip || prev.address.zip
        },
        phone_numbers: Array.isArray(e.phone_numbers) && e.phone_numbers.length
          ? e.phone_numbers.map(n => ({
              number: normalizePhone(n.number),
              type: n.type || 'LOCAL',
              carrier: n.carrier || '',
              account_number: n.account_number || '',
              pin: n.pin || ''
            }))
          : prev.phone_numbers
      }));
      setStep('edit');
    } catch (e) {
      setError(e.message);
    } finally {
      setExtracting(false);
    }
  }

  async function runEligibility() {
    setError(null);
    setEligibilityLoading(true);
    try {
      const phoneNumbers = form.phone_numbers
        .map(n => normalizePhone(n.number))
        .filter(Boolean);
      if (!phoneNumbers.length) throw new Error('Add at least one phone number');
      const r = await fetch(`${SERVER_BASE}/api/porting/eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers, locationId: form.locationId || undefined })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Eligibility check failed');
      setEligibility(j.results || []);
      setStep('check');
    } catch (e) {
      setError(e.message);
    } finally {
      setEligibilityLoading(false);
    }
  }

  async function runGenerateLOA() {
    setError(null);
    setLoaLoading(true);
    try {
      const phoneNumbers = form.phone_numbers
        .filter(n => n.number)
        .map(n => ({ ...n, number: normalizePhone(n.number) }));
      const r = await fetch(`${SERVER_BASE}/api/porting/generate-loa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          businessName: form.businessName || undefined,
          address: form.address,
          phoneNumbers,
          loaMode
        })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `LOA generation failed (${r.status})`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LOA-${form.firstName}-${form.lastName}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoaLoading(false);
    }
  }

  async function runSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const phoneNumbers = form.phone_numbers
        .filter(n => n.number)
        .map(n => ({ ...n, number: normalizePhone(n.number) }));
      const payload = {
        ...form,
        phoneNumbers,
        customerName: `${form.firstName} ${form.lastName}`.trim(),
        authorizedRepresentativeEmail: form.email
      };
      const fd = new FormData();
      fd.append('data', JSON.stringify(payload));
      if (billFile) fd.append('billingStatement', billFile);
      const r = await fetch(`${SERVER_BASE}/api/porting/requests`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Submit failed');
      setSubmitResult(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatSending) return;
    setChatInput('');
    const newHistory = [...chatHistory, { role: 'user', content: msg }];
    setChatHistory(newHistory);
    setChatSending(true);
    try {
      const r = await fetch(`${SERVER_BASE}/api/porting/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatHistory })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Chat failed');
      setChatHistory([...newHistory, { role: 'assistant', content: j.reply }]);
    } catch (e) {
      setChatHistory([...newHistory, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setChatSending(false);
    }
  }

  function resetAll() {
    setStep('paste');
    setPasteText('');
    setForm(EMPTY_FORM);
    setEligibility(null);
    setBillFile(null);
    setSubmitResult(null);
    setError(null);
    setExtractMethod(null);
  }

  function updateNumber(idx, field, value) {
    setForm(prev => {
      const next = [...prev.phone_numbers];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, phone_numbers: next };
    });
  }

  function addNumber() {
    setForm(prev => ({ ...prev, phone_numbers: [...prev.phone_numbers, { ...EMPTY_NUMBER }] }));
  }

  function removeNumber(idx) {
    setForm(prev => ({
      ...prev,
      phone_numbers: prev.phone_numbers.filter((_, i) => i !== idx) || [{ ...EMPTY_NUMBER }]
    }));
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPasteText(text);
    } catch {
      setError('Clipboard access blocked. Paste manually with Cmd/Ctrl+V.');
    }
  }

  // ------------------------------------------------------------------
  // Style helpers
  // ------------------------------------------------------------------

  const bg = isDark ? 'bg-[#0a0a14]' : 'bg-white';
  const card = isDark
    ? 'bg-white/5 border border-white/10 backdrop-blur-sm'
    : 'bg-gray-50 border border-gray-200';
  const cardHover = isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const subText = isDark ? 'text-gray-400' : 'text-gray-600';
  const inputCls = classes(
    'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-purple-500/60 transition-colors',
    isDark
      ? 'bg-black/30 border-white/10 text-white placeholder-gray-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  );
  const labelCls = classes('text-xs font-medium mb-1', subText);
  const btnPrimary = 'px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';
  const btnGhost = classes(
    'px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors',
    isDark ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10' : 'bg-gray-100 border border-gray-200 text-gray-900 hover:bg-gray-200'
  );

  return (
    <div className={classes('flex gap-4 w-full', text)}>
      {/* Main column */}
      <div className="flex-1 min-w-0">
        {/* Header + step indicator */}
        <div className={classes('rounded-xl p-4 mb-4', card)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-purple-400" />
              <div>
                <h2 className="text-lg font-semibold">AutoPort</h2>
                <p className={classes('text-xs', subText)}>Phone number porting workflow</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setChatOpen(o => !o)} className={btnGhost} title="AI assistant">
                <Bot className="w-4 h-4" /> {chatOpen ? 'Hide AI' : 'AI Assist'}
              </button>
              <button onClick={resetAll} className={btnGhost} title="Start over">
                Reset
              </button>
            </div>
          </div>

          {/* Step pills */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {STEPS.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <React.Fragment key={s.key}>
                  <button
                    onClick={() => { if (done) setStep(s.key); }}
                    disabled={!done && !active}
                    className={classes(
                      'px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap',
                      active && 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white',
                      done && (isDark ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200'),
                      !done && !active && (isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-500')
                    )}
                  >
                    {done && <CheckCircle2 className="w-3 h-3" />}
                    {i + 1}. {s.label}
                  </button>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className={classes('w-3 h-3', subText)} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {error && (
          <div className={classes(
            'rounded-lg px-4 py-3 mb-4 flex items-start gap-2 text-sm',
            isDark ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'
          )}>
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">dismiss</button>
          </div>
        )}

        {/* Step content */}
        {step === 'paste' && (
          <div className={classes('rounded-xl p-5', card)}>
            <h3 className="font-semibold mb-1">1. Paste ticket text</h3>
            <p className={classes('text-sm mb-4', subText)}>
              Drop the support-ticket content below. AI will pull out names, addresses, phone numbers, carrier, account #, and PIN.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={14}
              placeholder="Paste ticket body, customer email, or any text containing porting details..."
              className={classes(inputCls, 'font-mono text-sm resize-y')}
            />
            <div className="flex items-center justify-between mt-4">
              <button onClick={pasteFromClipboard} className={btnGhost}>
                <ClipboardPaste className="w-4 h-4" /> Paste from clipboard
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('edit')}
                  className={btnGhost}
                  title="Skip to manual entry"
                >
                  Skip — enter manually
                </button>
                <button onClick={runExtract} disabled={extracting} className={btnPrimary}>
                  {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {extracting ? 'Extracting...' : 'Extract with AI'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'edit' && (
          <div className={classes('rounded-xl p-5', card)}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">2. Review & edit</h3>
                <p className={classes('text-sm', subText)}>
                  Verify everything matches the customer's current carrier records exactly.
                  {extractMethod && (
                    <span className={classes('ml-2 px-2 py-0.5 rounded-full text-xs', isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700')}>
                      Extracted via {extractMethod}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className={labelCls}>First name *</label>
                <input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Last name *</label>
                <input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Business name</label>
                <input className={inputCls} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Customer type</label>
                <select className={inputCls} value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Authorized email *</label>
                <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="signer@example.com" />
              </div>
              <div>
                <label className={labelCls}>GHL Location ID</label>
                <input className={inputCls} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} />
              </div>
            </div>

            {/* Address */}
            <div className={classes('rounded-lg p-3 mb-4', isDark ? 'bg-black/20 border border-white/5' : 'bg-white border border-gray-200')}>
              <div className={classes('text-xs font-semibold uppercase tracking-wider mb-2', subText)}>Service address</div>
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-6">
                  <label className={labelCls}>Street</label>
                  <input className={inputCls} value={form.address.street} onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} />
                </div>
                <div className="col-span-3">
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
                </div>
                <div className="col-span-1">
                  <label className={labelCls}>State</label>
                  <input className={inputCls} value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value.toUpperCase() } })} maxLength={2} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>ZIP</label>
                  <input className={inputCls} value={form.address.zip} onChange={(e) => setForm({ ...form, address: { ...form.address, zip: e.target.value } })} />
                </div>
              </div>
            </div>

            {/* Phone numbers */}
            <div className={classes('rounded-lg p-3 mb-4', isDark ? 'bg-black/20 border border-white/5' : 'bg-white border border-gray-200')}>
              <div className="flex items-center justify-between mb-3">
                <div className={classes('text-xs font-semibold uppercase tracking-wider', subText)}>
                  Phone numbers ({form.phone_numbers.length})
                </div>
                <button onClick={addNumber} className={classes('text-xs px-2 py-1 rounded-md flex items-center gap-1', isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200')}>
                  <Plus className="w-3 h-3" /> Add number
                </button>
              </div>
              <div className="space-y-2">
                {form.phone_numbers.map((n, idx) => (
                  <div key={idx} className={classes('grid grid-cols-12 gap-2 items-end p-2 rounded-md', isDark ? 'bg-white/5' : 'bg-gray-50')}>
                    <div className="col-span-3">
                      <label className={labelCls}>Number</label>
                      <input className={inputCls} value={n.number} onChange={(e) => updateNumber(idx, 'number', e.target.value)} placeholder="+15551234567" />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Type</label>
                      <select className={inputCls} value={n.type} onChange={(e) => updateNumber(idx, 'type', e.target.value)}>
                        <option value="LOCAL">LOCAL</option>
                        <option value="MOBILE">MOBILE</option>
                        <option value="TOLL_FREE">TOLL_FREE</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Carrier</label>
                      <input className={inputCls} value={n.carrier} onChange={(e) => updateNumber(idx, 'carrier', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Account #</label>
                      <input className={inputCls} value={n.account_number} onChange={(e) => updateNumber(idx, 'account_number', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>PIN</label>
                      <input className={inputCls} value={n.pin} onChange={(e) => updateNumber(idx, 'pin', e.target.value)} />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => removeNumber(idx)}
                        disabled={form.phone_numbers.length === 1}
                        className={classes('p-2 rounded-md disabled:opacity-30 disabled:cursor-not-allowed', isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-100 text-red-600')}
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea className={classes(inputCls, 'resize-y')} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setStep('paste')} className={btnGhost}>
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={runEligibility} disabled={eligibilityLoading} className={btnPrimary}>
                {eligibilityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Check eligibility
              </button>
            </div>
          </div>
        )}

        {step === 'check' && eligibility && (
          <div className={classes('rounded-xl p-5', card)}>
            <h3 className="font-semibold mb-1">3. Portability results</h3>
            <p className={classes('text-sm mb-4', subText)}>
              Review each number. Non-portable numbers should be removed before generating the LOA.
            </p>
            <div className="space-y-2">
              {eligibility.map((r, idx) => (
                <div
                  key={idx}
                  className={classes(
                    'rounded-lg p-3 flex items-center justify-between gap-3',
                    r.portable
                      ? (isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200')
                      : (isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200')
                  )}
                >
                  <div className="flex items-center gap-3">
                    {r.portable
                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                      : <XCircle className="w-5 h-5 text-red-500" />}
                    <div>
                      <div className="font-mono text-sm">{r.number}</div>
                      <div className={classes('text-xs', subText)}>
                        {r.type}{r.pinRequired ? ' • PIN required' : ''}{r.reason ? ` • ${r.reason}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(r.number)}
                    className={classes('p-1.5 rounded-md', isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200')}
                    title="Copy"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setStep('edit')} className={btnGhost}>
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep('loa')} className={btnPrimary}>
                Continue to LOA <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'loa' && (
          <div className={classes('rounded-xl p-5', card)}>
            <h3 className="font-semibold mb-1">4. Generate LOA</h3>
            <p className={classes('text-sm mb-4', subText)}>
              The Letter of Authorization is a PDF you'll send to the customer for signature. Name + address must match the carrier's records exactly or the port will reject.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { key: 'single',      label: 'Single LOA',      desc: 'All numbers on one form' },
                { key: 'per-carrier', label: 'One per carrier', desc: 'Group by carrier' },
                { key: 'per-number',  label: 'One per number',  desc: 'Individual forms' }
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setLoaMode(opt.key)}
                  className={classes(
                    'p-3 rounded-lg text-left border transition-all',
                    loaMode === opt.key
                      ? (isDark ? 'bg-purple-500/20 border-purple-500/50 text-white' : 'bg-purple-50 border-purple-300 text-purple-900')
                      : (isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-gray-50 border-gray-200 hover:bg-gray-100')
                  )}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className={classes('text-xs mt-0.5', subText)}>{opt.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={runGenerateLOA} disabled={loaLoading} className={btnPrimary}>
              {loaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {loaLoading ? 'Generating...' : 'Download LOA PDF'}
            </button>
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setStep('check')} className={btnGhost}>
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep('submit')} className={btnPrimary}>
                Continue to submit <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'submit' && (
          <div className={classes('rounded-xl p-5', card)}>
            {!submitResult ? (
              <>
                <h3 className="font-semibold mb-1">5. Attach bill & submit</h3>
                <p className={classes('text-sm mb-4', subText)}>
                  Optionally upload the most recent billing statement to speed up carrier verification. The port request will be created with status <code className="px-1 py-0.5 rounded bg-black/30 text-xs">waiting_for_signature</code>.
                </p>
                <div className={classes('rounded-lg p-4 mb-4', isDark ? 'bg-black/20 border border-dashed border-white/20' : 'bg-white border border-dashed border-gray-300')}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Upload className={classes('w-5 h-5', subText)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {billFile ? billFile.name : 'Upload billing statement (PDF/PNG/JPG)'}
                      </div>
                      <div className={classes('text-xs', subText)}>
                        {billFile ? `${(billFile.size / 1024).toFixed(1)} KB` : 'Optional'}
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <button onClick={() => setStep('loa')} className={btnGhost}>
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={runSubmit} disabled={submitting} className={btnPrimary}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {submitting ? 'Submitting...' : 'Create port request'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Port request created</h3>
                <p className={classes('text-sm mb-4', subText)}>{submitResult.message}</p>
                <div className={classes('inline-block text-left rounded-lg p-3 mb-4', isDark ? 'bg-black/30' : 'bg-gray-100')}>
                  <div className={classes('text-xs uppercase tracking-wider', subText)}>Port Request SID</div>
                  <div className="font-mono text-sm flex items-center gap-2">
                    {submitResult.portInRequestSid}
                    <button onClick={() => navigator.clipboard?.writeText(submitResult.portInRequestSid)} className={classes('p-1 rounded', isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200')}>
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className={classes('text-xs mt-2', subText)}>
                    ETA: {submitResult.estimatedCompletionDays}
                  </div>
                </div>
                <div>
                  <button onClick={resetAll} className={btnPrimary + ' mx-auto'}>
                    Start a new port
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Chat side drawer */}
      {chatOpen && (
        <div className={classes('w-96 flex-shrink-0 rounded-xl flex flex-col h-[calc(100vh-160px)]', card)}>
          <div className={classes('flex items-center gap-2 px-4 py-3 border-b', isDark ? 'border-white/10' : 'border-gray-200')}>
            <Bot className="w-4 h-4 text-cyan-400" />
            <div className="text-sm font-semibold">AutoPort Assistant</div>
            <button onClick={() => setChatHistory([])} className={classes('ml-auto text-xs underline', subText)}>Clear</button>
          </div>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatHistory.length === 0 && (
              <div className={classes('text-sm text-center py-6', subText)}>
                Ask about port timelines, rejection reasons, LOA requirements, or paste raw ticket text for extraction help.
              </div>
            )}
            {chatHistory.map((m, i) => (
              <div key={i} className={classes('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
                <div className={classes('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', m.role === 'user' ? 'bg-purple-500/30' : 'bg-cyan-500/30')}>
                  {m.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={classes(
                  'px-3 py-2 rounded-lg text-sm whitespace-pre-wrap max-w-[80%]',
                  m.role === 'user'
                    ? (isDark ? 'bg-purple-500/20' : 'bg-purple-100')
                    : (isDark ? 'bg-white/5' : 'bg-gray-100')
                )}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatSending && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-cyan-500/30 flex items-center justify-center"><Bot className="w-3.5 h-3.5" /></div>
                <div className={classes('px-3 py-2 rounded-lg', isDark ? 'bg-white/5' : 'bg-gray-100')}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
          <div className={classes('p-3 border-t flex gap-2', isDark ? 'border-white/10' : 'border-gray-200')}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="Ask about porting..."
              className={inputCls}
              disabled={chatSending}
            />
            <button onClick={sendChat} disabled={chatSending || !chatInput.trim()} className={btnPrimary}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
