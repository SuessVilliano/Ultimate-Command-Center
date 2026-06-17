import React, { useState, useEffect } from 'react';
import { X, Copy, RefreshCw, Columns } from 'lucide-react';
import { API_URL } from '../config';

// Engines we can compare. Only the ones the server reports as available show up.
const ENGINES = [
  { id: 'claude-cli', name: 'Claude (CLI Login)', color: 'purple' },
  { id: 'gemini-cli', name: 'Gemini (CLI Login)', color: 'blue' },
  { id: 'ollama', name: 'Ollama (Local)', color: 'teal' },
  { id: 'groq', name: 'Groq', color: 'orange' },
  { id: 'gemini', name: 'Gemini (Key)', color: 'blue' },
  { id: 'claude', name: 'Claude (Key)', color: 'purple' },
  { id: 'openai', name: 'OpenAI', color: 'green' },
];

export default function CompareDrafts({ ticket, isDark = true, onClose }) {
  const [available, setAvailable] = useState({});
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/ai/provider`)
      .then(r => r.json())
      .then(d => {
        const av = d.available || {};
        setAvailable(av);
        // Default: the first 2-3 available engines (prefer login/local)
        const def = ENGINES.filter(e => av[e.id]).map(e => e.id).slice(0, 3);
        setSelected(def.length ? def : ENGINES.filter(e => av[e.id]).map(e => e.id));
      })
      .catch(() => {});
  }, []);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const runCompare = async () => {
    if (!selected.length) return;
    setLoading(true);
    setResults([]);
    try {
      const r = await fetch(`${API_URL}/api/generate-response/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticket.subject,
          description: ticket.description_text || ticket.description,
          requesterName: ticket.requester?.name || ticket.requester_name,
          ticketId: ticket.id,
          ticketType: ticket.type,
          tags: ticket.tags,
          providers: selected,
        }),
      });
      const d = await r.json();
      setResults(d.results || []);
    } catch (e) {
      setResults(selected.map(p => ({ provider: p, error: 'Request failed' })));
    } finally {
      setLoading(false);
    }
  };

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    }).catch(() => {});
  };

  const nameFor = (id) => ENGINES.find(e => e.id === id)?.name || id;
  const cols = results.length || selected.length || 1;
  const gridCols = cols >= 3 ? 'lg:grid-cols-3' : cols === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-xl ${isDark ? 'bg-gray-900 border border-purple-900/40' : 'bg-white border border-gray-200'} shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <Columns className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Compare Responses</h3>
              <p className="text-xs text-gray-400 truncate max-w-md">{ticket.subject}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-700/40"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Engine toggles */}
        <div className={`p-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap items-center gap-2`}>
          <span className="text-xs text-gray-400 mr-1">Engines:</span>
          {ENGINES.filter(e => available[e.id]).map(e => (
            <button
              key={e.id}
              onClick={() => toggle(e.id)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                selected.includes(e.id)
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-600' : 'border-gray-300 text-gray-500'
              }`}
            >
              {e.name}
            </button>
          ))}
          {ENGINES.filter(e => available[e.id]).length === 0 && (
            <span className="text-xs text-yellow-400">No engines available — set one up in AI Settings first.</span>
          )}
          <button
            onClick={runCompare}
            disabled={loading || !selected.length}
            className="ml-auto flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Columns className="w-4 h-4" />}
            {loading ? 'Generating…' : results.length ? 'Regenerate' : 'Compare'}
          </button>
        </div>

        {/* Columns */}
        <div className="flex-1 overflow-y-auto p-3">
          {!results.length && !loading && (
            <div className="text-center text-gray-500 py-16 text-sm">
              Pick your engines above and hit <span className="text-purple-400">Compare</span> to draft the same reply with each — side by side.
            </div>
          )}
          {loading && (
            <div className="text-center text-gray-400 py-16 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> Drafting with {selected.length} engine{selected.length > 1 ? 's' : ''}…
            </div>
          )}
          {!!results.length && (
            <div className={`grid grid-cols-1 ${gridCols} gap-3`}>
              {results.map((r, idx) => (
                <div key={idx} className={`flex flex-col rounded-lg border ${isDark ? 'border-gray-800 bg-gray-800/40' : 'border-gray-200 bg-gray-50'}`}>
                  <div className={`flex items-center justify-between px-3 py-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{nameFor(r.provider)}</span>
                    {!r.error && (
                      <button
                        onClick={() => copy(r.response, idx)}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Copy className="w-3 h-3" />{copiedIdx === idx ? 'Copied!' : 'Use this'}
                      </button>
                    )}
                  </div>
                  <div className={`p-3 text-sm whitespace-pre-wrap overflow-y-auto max-h-[55vh] ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    {r.error ? <span className="text-red-400 text-xs">⚠ {r.error}</span> : r.response}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
