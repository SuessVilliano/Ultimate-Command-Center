import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Copy, RefreshCw, Trash2, ChevronRight, Star } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

const STATUS_COLORS = {
  PENDING_REVIEW: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'Pending Review' },
  APPROVED: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', label: 'Approved' },
  REJECTED: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', label: 'Rejected' },
  NEEDS_EDIT: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', label: 'Needs Edit' },
  ESCALATION_RECOMMENDED: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', label: 'Escalation' }
};

export default function DraftQueue({ isDark, onSelectTicket }) {
  const [drafts, setDrafts] = useState([]);
  const [stats, setStats] = useState({ total: 0, PENDING_REVIEW: 0, APPROVED: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('PENDING_REVIEW');
  const [expandedDraft, setExpandedDraft] = useState(null);
  const [savingCasebook, setSavingCasebook] = useState(null);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const [draftsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/drafts?status=${filter}&limit=20`),
        fetch(`${API_URL}/api/drafts/stats`)
      ]);
      if (draftsRes.ok) setDrafts((await draftsRes.json()).drafts || []);
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error('Failed to fetch drafts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrafts(); }, [filter]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchDrafts, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const updateStatus = async (draftId, status) => {
    try {
      await fetch(`${API_URL}/api/drafts/${draftId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchDrafts();
    } catch (e) {
      console.error('Failed to update draft:', e);
    }
  };

  const deleteDraft = async (draftId) => {
    try {
      await fetch(`${API_URL}/api/drafts/${draftId}`, { method: 'DELETE' });
      fetchDrafts();
    } catch (e) {}
  };

  const copyDraft = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const saveDraftToCasebook = async (draft) => {
    setSavingCasebook(draft.id);
    try {
      await fetch(`${API_URL}/api/casebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: draft.ticket_id,
          subject: draft.ticket_subject,
          approved_response: draft.draft_text,
          keywords: draft.ticket_subject.split(/\s+/).filter(w => w.length > 3)
        })
      });
      // Auto-approve when saved to casebook
      await updateStatus(draft.id, 'APPROVED');
    } catch (e) {
      console.error('Failed to save to casebook:', e);
    } finally {
      setSavingCasebook(null);
    }
  };

  const parseQA = (qaStr) => {
    try { return typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr; } catch { return null; }
  };

  return (
    <div className={`rounded-xl ${isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'}`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Draft Queue
          </h3>
          <div className="flex items-center gap-1.5">
            {stats.PENDING_REVIEW > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                {stats.PENDING_REVIEW} pending
              </span>
            )}
            {stats.ESCALATION_RECOMMENDED > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                {stats.ESCALATION_RECOMMENDED} escalation
              </span>
            )}
          </div>
        </div>
        <button onClick={fetchDrafts} className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className={`px-4 pb-2 flex gap-1 border-b ${isDark ? 'border-purple-900/20' : 'border-gray-100'}`}>
        {['PENDING_REVIEW', 'APPROVED', 'NEEDS_EDIT', 'ESCALATION_RECOMMENDED', 'REJECTED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
              filter === status
                ? STATUS_COLORS[status].bg + ' ' + STATUS_COLORS[status].text
                : isDark ? 'text-gray-500 hover:bg-white/5' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {STATUS_COLORS[status].label} {stats[status] ? `(${stats[status]})` : ''}
          </button>
        ))}
      </div>

      {/* Draft list */}
      <div className="max-h-96 overflow-y-auto">
        {drafts.length === 0 ? (
          <div className={`p-6 text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            <p className="text-sm">No drafts with this status</p>
          </div>
        ) : (
          drafts.map(draft => {
            const qa = parseQA(draft.qa_result);
            const isExpanded = expandedDraft === draft.id;
            const statusStyle = STATUS_COLORS[draft.status] || STATUS_COLORS.PENDING_REVIEW;

            return (
              <div
                key={draft.id}
                className={`border-b last:border-b-0 ${isDark ? 'border-purple-900/10' : 'border-gray-50'}`}
              >
                {/* Draft header */}
                <div
                  className={`px-4 py-3 flex items-center gap-3 cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  onClick={() => setExpandedDraft(isExpanded ? null : draft.id)}
                >
                  <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      #{draft.ticket_id} — {draft.ticket_subject || 'Untitled'}
                    </div>
                    <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(draft.created_at).toLocaleString()} {qa && `• QA: ${qa.score || 0}/100`}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${statusStyle.bg} ${statusStyle.text}`}>
                    {draft.qa_passed ? 'QA Pass' : qa?.overall === 'FAIL' ? 'QA Fail' : 'Pending'}
                  </span>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className={`px-4 pb-4 ${isDark ? 'bg-white/[0.02]' : 'bg-gray-50/50'}`}>
                    {/* Draft text */}
                    <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap mb-3 max-h-48 overflow-y-auto ${
                      isDark ? 'bg-white/5 text-gray-300' : 'bg-white text-gray-700 border border-gray-200'
                    }`}>
                      {draft.draft_text}
                    </div>

                    {/* QA details */}
                    {qa && qa.criteria && (
                      <div className={`p-2 rounded-lg mb-3 text-xs ${isDark ? 'bg-white/5' : 'bg-white border border-gray-200'}`}>
                        <div className={`font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>QA Result: {qa.overall} ({qa.score}/100)</div>
                        <div className="grid grid-cols-2 gap-1">
                          {Object.entries(qa.criteria).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-1">
                              {val.pass ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{key.replace(/_/g, ' ')}</span>
                            </div>
                          ))}
                        </div>
                        {qa.fixes?.length > 0 && (
                          <div className="mt-1.5 text-red-400">
                            Fixes: {qa.fixes.join('; ')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {draft.status !== 'APPROVED' && (
                        <button
                          onClick={() => updateStatus(draft.id, 'APPROVED')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {draft.status !== 'REJECTED' && (
                        <button
                          onClick={() => updateStatus(draft.id, 'REJECTED')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      )}
                      <button
                        onClick={() => copyDraft(draft.draft_text)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                      <button
                        onClick={() => saveDraftToCasebook(draft)}
                        disabled={savingCasebook === draft.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        <Star className="w-3 h-3" /> {savingCasebook === draft.id ? 'Saving...' : 'Casebook'}
                      </button>
                      <button
                        onClick={() => deleteDraft(draft.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
