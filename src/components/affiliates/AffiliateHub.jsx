import React, { useEffect, useState } from 'react';
import AffiliateHubCore from './AffiliateHubCore';
import LiveAffiliateCrmSync from './LiveAffiliateCrmSync';
import { API_URL } from '../../config';

export default function AffiliateHub({ showCrm = true, showAnalytics = true, ...props }) {
  const [aiServerStatus, setAiServerStatus] = useState('checking');
  const [legacyOpen, setLegacyOpen] = useState(true);

  useEffect(() => {
    if (!showAnalytics) return undefined;

    let active = true;
    let timer = null;

    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_URL}/health`, { cache: 'no-store' });
        if (active) setAiServerStatus(response.ok ? 'online' : 'offline');
      } catch {
        if (active) setAiServerStatus('offline');
      }
    };

    checkBackend();
    timer = setInterval(checkBackend, 30000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [showAnalytics]);

  return (
    <div className="space-y-5">
      {showCrm && <LiveAffiliateCrmSync isDark={props.isDark !== false} />}

      {showAnalytics && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <button
            type="button"
            onClick={() => setLegacyOpen(v => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left"
          >
            <div>
              <div className="text-sm font-semibold text-slate-200">Affiliate Analytics & Outreach Tools</div>
              <div className="mt-0.5 text-xs text-slate-500">Weekly-import analytics remain here; live contact data, notes and activity are available separately in Affiliate CRM.</div>
            </div>
            <span className="text-xs text-slate-500">{legacyOpen ? 'Hide' : 'Show'}</span>
          </button>
          {legacyOpen && <div className="mt-3"><AffiliateHubCore {...props} aiServerStatus={aiServerStatus} /></div>}
        </section>
      )}
    </div>
  );
}
