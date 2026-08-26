import React, { useState, useEffect } from 'react';
import {
  CheckCircle, XCircle, Copy, RefreshCw, Trash2, ChevronRight, Send,
  Mail, MessageSquare, Instagram, Facebook, Megaphone, FileText
} from 'lucide-react';
import { API_URL } from '../../config';

// Outbound Queue — repurposed from the old ticket Draft Queue.
// Now it holds affiliate messages (email / SMS / DM across platforms) and
// content pieces you push out via GHL, all staged for review before they go out.

const STATUS_COLORS = {
  PENDING_REVIEW: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'To Review' },
  APPROVED: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', label: 'Sent / Ready' },
  NEEDS_EDIT: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', label: 'Needs Edit' },
  REJECTED: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', label: 'Discarded' }
};

const CHANNEL_META = {
  email: { icon: Mail, label: 'Email', color: 'text-blue-400' },
  sms: { icon: MessageSquare, label: 'SMS', color: 'text-green-400' },
  instagram: { icon: Instagram, label: 'Instagram DM', color: 'text-pink-400' },
  facebook: { icon: Facebook, label: 'Facebook DM', color: 'text-blue-500' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', color: 'text-emerald-400' },
  ghl: { icon: Send, label: 'GHL', color: 'text-purple-400' },
  content: { icon: Megaphone, label: 'Content', color: 'text-cyan-400' }
};

function parseMeta(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || null); } catch { return null; }
}

function channelOf(draft) {
  const meta = parseMeta(draft.pipeline_metadata);
  if (meta?.channel && CHANNEL_META[meta.channel]) return meta.channel;
  if (meta?.kind === 'content') return 'content';
  // Fall back to sniffing the subject prefix.
  const s = (draft.ticket_subject || '').toLowerCase();
  const hit = Object.keys(CHANNEL_META).find(k => s.includes(k));
  return hit || 'ghl';
}

export default function OutboundQueue({ isDark, onReuse }) {
  const [drafts, setDrafts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('PENDING_REVIEW');
  const [kindFilter, setKindFilter] = useState('all'); // all | message | content
  const [expanded, setExpanded] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/drafts?status=${filter}&limit=30`),
        fetch(`${API_URL}/api/drafts/stats`)
      ]);
      if (dRes.ok) setDrafts((await dRes.json()).drafts || []);
      if (sRes.ok) setStats(await sRes.json());
    } catch (e) {
      console.error('Failed to fetch outbound queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrafts(); }, [filter]);
  useEffect(() => {
    const t = setInterval(fetchDrafts, 30000);
    return () => clearInterval(t);
  }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API_URL}/api/drafts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchDrafts();
    } catch (e) { console.error(e); }
  };

  const remove = async (id) => {
    try { await fetch(`${API_URL}/api/drafts/${id}`, { method: 'DELETE' }); fetchDrafts(); } catch (e) {}
  };

  const copy = (text) => navigator.clipboard.writeText(text).catch(() => {});

  const visible = drafts.filter(d => {
    if (kindFilter === 'all') return true;
    const ch = channelOf(d);
    return kindFilter === 'content' ? ch === 'content' : ch !== 'content';
  });

  return (
    <div className={`rounded-xl ${isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'}`}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full p-4 flex items-center justify-between ${collapsed ? '' : 'border-b'} ${isDark ? 'border-purple-900/20' : 'border-gray-100'}`}
      >
        <div className="flex items-center gap-3">
          <Send className="w-4 h-4 text-purple-400" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Outbound Queue</h3>
          {stats.PENDING_REVIEW > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
              {stats.PENDING_REVIEW} to review
            </span>
          )}
          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            emails · SMS · DMs · content
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
      </button>

      {!collapsed && (
        <>
          {/* Filters */}
          <div className={`px-4 pt-3 flex flex-wrap items-center gap-1 ${isDark ? '' : ''}`}>
            {['PENDING_REVIEW', 'APPROVED', 'NEEDS_EDIT', 'REJECTED'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  filter === status
                    ? `${STATUS_COLORS[status].bg} ${STATUS_COLORS[status].text}`
                    : isDark ? 'text-gray-500 hover:bg-white/5' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                {STATUS_COLORS[status].label} {stats[status] ? `(${stats[status]})` : ''}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {['all', 'message', 'content'].map(k => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`px-2 py-1 text-xs rounded-lg capitalize transition-colors ${
                    kindFilter === k
                      ? isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-100 text-purple-600'
                      : isDark ? 'text-gray-500 hover:bg-white/5' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {k === 'message' ? 'Messages' : k}
                </button>
              ))}
              <button onClick={fetchDrafts} className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto mt-2">
            {visible.length === 0 ? (
              <div className={`p-6 text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                <Send className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nothing queued here. Draft a message from an affiliate to stage it.</p>
              </div>
            ) : visible.map(draft => {
              const ch = channelOf(draft);
              const CM = CHANNEL_META[ch];
              const ChIcon = CM.icon;
              const isOpen = expanded === draft.id;
              const style = STATUS_COLORS[draft.status] || STATUS_COLORS.PENDING_REVIEW;
              const meta = parseMeta(draft.pipeline_metadata);
              return (
                <div key={draft.id} className={`border-b last:border-b-0 ${isDark ? 'border-purple-900/10' : 'border-gray-50'}`}>
                  <div
                    className={`px-4 py-3 flex items-center gap-3 cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    onClick={() => setExpanded(isOpen ? null : draft.id)}
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs ${isDark ? 'bg-white/5' : 'bg-gray-100'} ${CM.color}`}>
                      <ChIcon className="w-3 h-3" /> {CM.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {draft.ticket_subject || 'Untitled'}
                      </div>
                      <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {meta?.affiliateName ? `${meta.affiliateName} · ` : ''}{new Date(draft.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs ${style.bg} ${style.text}`}>{style.label}</span>
                  </div>

                  {isOpen && (
                    <div className={`px-4 pb-4 ${isDark ? 'bg-white/[0.02]' : 'bg-gray-50/50'}`}>
                      <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap mb-3 max-h-48 overflow-y-auto ${
                        isDark ? 'bg-white/5 text-gray-300' : 'bg-white text-gray-700 border border-gray-200'
                      }`}>
                        {draft.draft_text}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {draft.status !== 'APPROVED' && (
                          <button onClick={() => updateStatus(draft.id, 'APPROVED')} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white">
                            <CheckCircle className="w-3 h-3" /> Mark Sent
                          </button>
                        )}
                        {draft.status !== 'NEEDS_EDIT' && (
                          <button onClick={() => updateStatus(draft.id, 'NEEDS_EDIT')} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400">
                            <FileText className="w-3 h-3" /> Needs Edit
                          </button>
                        )}
                        <button onClick={() => copy(draft.draft_text)} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        {onReuse && (
                          <button onClick={() => onReuse(draft)} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg ${isDark ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'}`}>
                            <Send className="w-3 h-3" /> Open in Composer
                          </button>
                        )}
                        <button onClick={() => remove(draft.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 ml-auto">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
