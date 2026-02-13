import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Zap, Brain, Star } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

export default function GodModeBrief({ isDark }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const fetchBrief = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/briefing/god-mode`);
      if (response.ok) setBrief(await response.json());
    } catch (e) {
      console.error('Failed to fetch God Mode brief:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrief(); }, []);

  if (!brief && !loading) return null;

  return (
    <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border border-purple-500/30' : 'bg-gradient-to-br from-purple-50 to-cyan-50 border border-purple-200'}`}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            God Mode Brief
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
            DRAFT-ONLY
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); fetchBrief(); }}
          className={`p-1 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        </button>
      </div>

      {!collapsed && brief && (
        <div className="px-4 pb-4 space-y-3">
          {/* Greeting */}
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {brief.greeting}
          </p>

          {/* Priorities */}
          {brief.priorities?.length > 0 && (
            <div className="space-y-1">
              {brief.priorities.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`text-xs mt-0.5 ${
                    p.includes('urgent') || p.includes('escalation')
                      ? 'text-red-400'
                      : p.includes('clear') ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {p.includes('urgent') || p.includes('escalation') ? '!' : p.includes('clear') ? '\u2713' : '\u2022'}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{p}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Ticket Queue */}
            <div className={`p-2.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white/70'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tickets</div>
              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {brief.ticketQueue?.total || 0}
              </div>
              {(brief.ticketQueue?.urgent || 0) > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-xs text-red-400">{brief.ticketQueue.urgent} urgent</span>
                </div>
              )}
            </div>

            {/* Draft Queue */}
            <div className={`p-2.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white/70'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Drafts</div>
              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {brief.draftQueue?.PENDING_REVIEW || 0}
              </div>
              {(brief.draftQueue?.APPROVED || 0) > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400">{brief.draftQueue.APPROVED} approved</span>
                </div>
              )}
            </div>

            {/* Casebook */}
            <div className={`p-2.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white/70'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Casebook</div>
              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {brief.casebook?.total || 0}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>patterns</span>
              </div>
            </div>
          </div>

          {/* Proactive AI */}
          {(brief.proactiveAI?.issues > 0 || brief.proactiveAI?.suggestions > 0) && (
            <div className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
              <Brain className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                Proactive AI: {brief.proactiveAI.issues} issues, {brief.proactiveAI.suggestions} suggestions
              </span>
            </div>
          )}

          {/* Pending drafts preview */}
          {brief.draftQueue?.pendingDrafts?.length > 0 && (
            <div>
              <div className={`text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Pending Drafts
              </div>
              <div className="space-y-1">
                {brief.draftQueue.pendingDrafts.slice(0, 3).map(d => (
                  <div key={d.id} className={`flex items-center justify-between p-1.5 rounded text-xs ${isDark ? 'bg-white/5' : 'bg-white/70'}`}>
                    <span className={`truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      #{d.ticketId} {d.subject}
                    </span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                      d.qaPasssed ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {d.status === 'ESCALATION_RECOMMENDED' ? 'ESC' : d.qaPasssed ? 'PASS' : 'REVIEW'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`text-[10px] text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            Generated {brief.generatedAt ? new Date(brief.generatedAt).toLocaleTimeString() : ''} • {brief.mode}
          </div>
        </div>
      )}
    </div>
  );
}
