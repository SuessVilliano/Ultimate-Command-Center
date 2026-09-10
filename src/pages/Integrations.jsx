import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Bot, Calendar, CheckCircle2, ExternalLink, FolderKanban,
  Mail, Plug, RefreshCw, ShieldCheck, XCircle, Zap
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.projects)) return value.projects;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.data?.projects)) return value.data.projects;
  return [];
};

const safeJson = async (response) => {
  try { return await response.json(); } catch { return {}; }
};

function StatusBadge({ connected, configured, label }) {
  if (connected) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400"><CheckCircle2 className="h-3 w-3"/>{label || 'Connected'}</span>;
  }
  if (configured) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-400"><AlertCircle className="h-3 w-3"/>Configured</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-xs text-rose-400"><XCircle className="h-3 w-3"/>Not connected</span>;
}

function Card({ title, subtitle, icon: Icon, status, children, isDark }) {
  return <section className={`rounded-xl border p-5 ${isDark ? 'border-white/10 bg-[#0a0a0f]' : 'border-gray-200 bg-white shadow-sm'}`}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-cyan-500/10 p-2"><Icon className="h-5 w-5 text-cyan-400"/></div>
        <div>
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {status}
    </div>
    {children}
  </section>;
}

export default function Integrations() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [integrationStatus, setIntegrationStatus] = useState({});
  const [googleStatus, setGoogleStatus] = useState({ configured: false, connected: false });
  const [niftyStatus, setNiftyStatus] = useState({ authenticated: false });
  const [niftyProjects, setNiftyProjects] = useState([]);
  const [taskadeWorkspaces, setTaskadeWorkspaces] = useState([]);
  const [taskmagicStatus, setTaskmagicStatus] = useState({ configured: false, connected: false });
  const [syncStatus, setSyncStatus] = useState(null);

  const fetchWithTimeout = useCallback(async (url, options = {}, timeoutMs = 6000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const loadGoogle = useCallback(async () => {
    try {
      const r = await fetchWithTimeout(`${API_URL}/api/google/status`);
      if (r.ok) setGoogleStatus(await safeJson(r));
    } catch (e) {
      console.warn('Google status unavailable:', e?.message);
    }
  }, [fetchWithTimeout]);

  const loadNifty = useCallback(async () => {
    try {
      const statusRes = await fetchWithTimeout(`${API_URL}/api/nifty/auth/status`);
      const status = statusRes.ok ? await safeJson(statusRes) : { authenticated: false };
      setNiftyStatus(status || { authenticated: false });
      if (!status?.authenticated) {
        setNiftyProjects([]);
        return;
      }
      const projectsRes = await fetchWithTimeout(`${API_URL}/api/nifty/projects`);
      if (projectsRes.ok) {
        const payload = await safeJson(projectsRes);
        setNiftyProjects(asArray(payload));
      } else setNiftyProjects([]);
    } catch (e) {
      console.warn('Nifty status unavailable:', e?.message);
      setNiftyProjects([]);
    }
  }, [fetchWithTimeout]);

  const loadTaskade = useCallback(async () => {
    try {
      const r = await fetchWithTimeout(`${API_URL}/api/taskade/workspaces`);
      if (r.ok) setTaskadeWorkspaces(asArray(await safeJson(r)));
      else setTaskadeWorkspaces([]);
    } catch (e) {
      console.warn('Taskade status unavailable:', e?.message);
      setTaskadeWorkspaces([]);
    }
  }, [fetchWithTimeout]);

  const loadTaskmagic = useCallback(async () => {
    try {
      const r = await fetchWithTimeout(`${API_URL}/api/taskmagic/mcp/status`);
      if (r.ok) {
        const payload = await safeJson(r);
        setTaskmagicStatus({
          configured: !!payload?.configured,
          connected: !!payload?.connected,
        });
      }
    } catch (e) {
      console.warn('TaskMagic status unavailable:', e?.message);
    }
  }, [fetchWithTimeout]);

  const loadSync = useCallback(async () => {
    try {
      const r = await fetchWithTimeout(`${API_URL}/api/sync/status`);
      if (r.ok) setSyncStatus(await safeJson(r));
    } catch (e) {
      console.warn('Sync status unavailable:', e?.message);
    }
  }, [fetchWithTimeout]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let status = {};
      try {
        const r = await fetchWithTimeout(`${API_URL}/api/integrations/status`);
        if (r.ok) status = await safeJson(r);
      } catch (e) {
        console.warn('Integration status endpoint unavailable:', e?.message);
      }
      setIntegrationStatus(status || {});
      await Promise.allSettled([loadGoogle(), loadNifty(), loadTaskade(), loadTaskmagic(), loadSync()]);
    } catch (e) {
      console.error('Integrations page load failed:', e);
      setError('Some integration statuses could not be loaded. The page is staying available so you can retry safely.');
    } finally {
      setLoading(false);
    }
  }, [fetchWithTimeout, loadGoogle, loadNifty, loadTaskade, loadTaskmagic, loadSync]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    if (!accessToken) return;
    fetch(`${API_URL}/api/google/connect-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    }).then(safeJson).then(data => {
      if (data?.connected) setGoogleStatus(data);
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }).catch(e => console.warn('Google token exchange failed:', e?.message));
  }, []);

  const connectGoogle = async () => {
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const r = await fetchWithTimeout(`${API_URL}/api/calendar/oauth-url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      const data = await safeJson(r);
      if (!r.ok || !data?.url) {
        alert(data?.error || 'Google OAuth is not configured on the Command Center API.');
        return;
      }
      window.location.assign(data.url);
    } catch (e) {
      alert(`Google connection could not start: ${e?.message || 'Unknown error'}`);
    }
  };

  const totalProjects = useMemo(() => niftyProjects.length, [niftyProjects]);
  const cardText = isDark ? 'text-gray-400' : 'text-gray-600';

  return <div className="space-y-6 animate-slide-in">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Integrations</h1>
        <p className={`mt-1 text-sm ${cardText}`}>Connection health for Command Center services. A failed API response will no longer crash the whole app.</p>
      </div>
      <button onClick={loadAll} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh all
      </button>
    </div>

    {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{error}</div>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card isDark={isDark} title="Google Workspace" subtitle="Gmail + Google Calendar" icon={Mail}
        status={<StatusBadge connected={!!googleStatus?.connected} configured={!!googleStatus?.configured}/>}> 
        {googleStatus?.connected ? <div className="space-y-2 text-sm text-emerald-400">
          <div className="flex items-center gap-2"><Mail className="h-4 w-4"/>Gmail connected</div>
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4"/>Calendar connected</div>
          {googleStatus?.email && <p className="text-xs text-gray-500">{googleStatus.email}</p>}
        </div> : <div className="space-y-3">
          <p className={`text-sm ${cardText}`}>Authorize Google once for both Gmail and Calendar.</p>
          <button onClick={connectGoogle} className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700"><ExternalLink className="mr-2 inline h-4 w-4"/>Connect Google</button>
        </div>}
      </Card>

      <Card isDark={isDark} title="Nifty PM" subtitle="Project management" icon={FolderKanban}
        status={<StatusBadge connected={!!niftyStatus?.authenticated} configured={!!integrationStatus?.nifty?.configured}/>}> 
        {niftyStatus?.authenticated ? <div>
          <p className={`text-sm ${cardText}`}>{totalProjects} project{totalProjects === 1 ? '' : 's'} available</p>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {niftyProjects.slice(0, 12).map((project, i) => <div key={project?.id || `nifty-${i}`} className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'border-white/10 bg-white/5 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>{project?.name || project?.title || 'Untitled project'}</div>)}
          </div>
        </div> : <p className={`text-sm ${cardText}`}>Nifty is not currently authenticated with this Command Center session.</p>}
      </Card>

      <Card isDark={isDark} title="Taskade" subtitle="Legacy project connection" icon={Plug}
        status={<StatusBadge connected={taskadeWorkspaces.length > 0} configured={!!integrationStatus?.taskade?.configured}/>}> 
        <p className={`text-sm ${cardText}`}>{taskadeWorkspaces.length ? `${taskadeWorkspaces.length} workspace${taskadeWorkspaces.length === 1 ? '' : 's'} found.` : 'No Taskade workspaces returned.'}</p>
      </Card>

      <Card isDark={isDark} title="TaskMagic" subtitle="Automation / MCP" icon={Bot}
        status={<StatusBadge connected={taskmagicStatus.connected} configured={taskmagicStatus.configured}/>}> 
        <p className={`text-sm ${cardText}`}>{taskmagicStatus.connected ? 'TaskMagic MCP is responding.' : 'TaskMagic MCP is not currently responding.'}</p>
      </Card>

      <Card isDark={isDark} title="Sync Engine" subtitle="Cross-tool synchronization" icon={Zap}
        status={<StatusBadge connected={!!(syncStatus?.connected || syncStatus?.healthy || syncStatus?.status === 'ok')} configured={!!syncStatus}/>}> 
        <p className={`text-sm ${cardText}`}>{syncStatus ? 'Sync status endpoint is available.' : 'Sync status is unavailable right now.'}</p>
      </Card>

      <Card isDark={isDark} title="Page Guard" subtitle="Crash protection" icon={ShieldCheck}
        status={<StatusBadge connected label="Active"/>}> 
        <p className={`text-sm ${cardText}`}>Malformed integration payloads are normalized to safe arrays and failed requests are isolated instead of blanking the app.</p>
      </Card>
    </div>
  </div>;
}
