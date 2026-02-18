import React, { useState, useEffect } from 'react';
import {
  Globe,
  ExternalLink,
  CheckCircle2,
  Clock,
  Server,
  Shield,
  TrendingUp,
  RefreshCw,
  Cloud,
  Plus,
  X,
  Save,
  Settings,
  AlertCircle,
  Zap
} from 'lucide-react';
import { domains as staticDomains } from '../data/portfolio';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

function Domains() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [domains, setDomains] = useState(staticDomains);
  const [loading, setLoading] = useState(false);
  const [cloudflareSync, setCloudflareSync] = useState(false);
  const [cloudflareStatus, setCloudflareStatus] = useState({ configured: false, domains: [] });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cfApiKey, setCfApiKey] = useState(localStorage.getItem('liv8_cloudflare_api_key') || '');
  const [cfEmail, setCfEmail] = useState(localStorage.getItem('liv8_cloudflare_email') || '');

  const [formData, setFormData] = useState({
    domain: '',
    purpose: '',
    status: 'parked'
  });

  const liveDomains = domains.filter(d => d.status === 'live');
  const parkedDomains = domains.filter(d => d.status === 'parked');

  useEffect(() => {
    checkCloudflareStatus();
  }, []);

  const checkCloudflareStatus = async () => {
    // First try server
    try {
      const response = await fetch(`${API_URL}/api/cloudflare/domains`);
      if (response.ok) {
        const data = await response.json();
        setCloudflareStatus(data);
        return;
      }
    } catch (e) {}

    // Try browser-side with stored credentials
    const storedKey = localStorage.getItem('liv8_cloudflare_api_key');
    const storedEmail = localStorage.getItem('liv8_cloudflare_email');
    if (storedKey && storedEmail) {
      try {
        const response = await fetch('https://api.cloudflare.com/client/v4/zones', {
          headers: {
            'X-Auth-Key': storedKey,
            'X-Auth-Email': storedEmail,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.result) {
            const cfDomains = data.result.map(zone => ({
              id: zone.id,
              name: zone.name,
              status: zone.status,
              plan: zone.plan?.name,
              nameServers: zone.name_servers
            }));
            setCloudflareStatus({ configured: true, domains: cfDomains });

            // Merge with existing domains
            const existingNames = domains.map(d => d.domain);
            const newDomains = cfDomains
              .filter(d => !existingNames.includes(d.name))
              .map(d => ({
                domain: d.name,
                purpose: `Cloudflare Zone - ${d.plan || 'Free'}`,
                status: d.status === 'active' ? 'live' : 'parked',
                cloudflareId: d.id,
                nameServers: d.nameServers
              }));

            if (newDomains.length > 0) {
              setDomains(prev => [...prev, ...newDomains]);
            }
            return;
          }
        }
      } catch (e) {
        console.warn('Browser-side Cloudflare fetch failed (likely CORS):', e);
      }
    }

    console.log('Cloudflare not configured');
  };

  const syncFromCloudflare = async () => {
    setLoading(true);

    // Try server first
    try {
      const response = await fetch(`${API_URL}/api/cloudflare/domains`);
      if (response.ok) {
        const data = await response.json();
        if (data.domains && data.domains.length > 0) {
          const cfDomains = data.domains.map(d => ({
            domain: d.name,
            purpose: `Cloudflare Zone - ${d.plan || 'Free'}`,
            status: d.status === 'active' ? 'live' : 'parked',
            cloudflareId: d.id,
            nameServers: d.nameServers
          }));
          const existingNames = domains.map(d => d.domain);
          const newDomains = cfDomains.filter(d => !existingNames.includes(d.domain));
          setDomains(prev => [...prev, ...newDomains]);
          setCloudflareSync(true);
          setLoading(false);
          return;
        }
      }
    } catch (e) {}

    // Fallback: re-check with browser credentials
    await checkCloudflareStatus();
    setCloudflareSync(cloudflareStatus.configured);
    setLoading(false);
  };

  const handleAddDomain = () => {
    if (!formData.domain) return;

    const newDomain = {
      domain: formData.domain,
      purpose: formData.purpose || 'Custom domain',
      status: formData.status
    };

    setDomains(prev => [...prev, newDomain]);
    setShowAddModal(false);
    setFormData({ domain: '', purpose: '', status: 'parked' });
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Domain Portfolio</h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Digital real estate and web presence management</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={syncFromCloudflare}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isDark ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
            }`}
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            Sync Cloudflare
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Domain
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className={`p-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cloudflare Status Banner */}
      {cloudflareStatus.configured && cloudflareSync && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'
        }`}>
          <Cloud className="w-5 h-5 text-orange-400" />
          <p className={`text-sm ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
            Synced with Cloudflare - {cloudflareStatus.domains.length} zones found
          </p>
        </div>
      )}

      {!cloudflareStatus.configured && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          <div>
            <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              Cloudflare not configured. Click Settings to enter your Cloudflare credentials, or add CLOUDFLARE_API_KEY and CLOUDFLARE_EMAIL to your server environment.
            </p>
          </div>
        </div>
      )}

      {/* Domain Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{domains.length}</p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Domains</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <p className="text-3xl font-bold text-green-400">{liveDomains.length}</p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Live Sites</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <p className="text-3xl font-bold text-cyan-400">{parkedDomains.length}</p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Parked</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <p className="text-3xl font-bold text-purple-400">${domains.length * 15}/yr</p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Est. Annual Cost</p>
        </div>
      </div>

      {/* Live Domains */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-500/20">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Live Domains</h2>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Active websites with deployed applications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveDomains.map((domain) => (
            <div key={domain.domain} className={`p-6 rounded-xl border transition-all hover:border-green-500/50 ${
              isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Globe className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{domain.domain}</h3>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{domain.purpose}</p>
                  </div>
                </div>
                <a
                  href={`https://${domain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Status</span>
                  <span className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Live
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>SSL</span>
                  <span className="flex items-center gap-1 text-green-400">
                    <Shield className="w-3 h-3" />
                    Active
                  </span>
                </div>
                {domain.cloudflareId && (
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Cloudflare</span>
                    <span className="flex items-center gap-1 text-orange-400">
                      <Cloud className="w-3 h-3" />
                      Protected
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Parked Domains */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <Server className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Parked Domains</h2>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Reserved domains awaiting deployment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parkedDomains.map((domain) => (
            <div key={domain.domain} className={`p-6 rounded-xl border transition-all hover:border-cyan-500/50 ${
              isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Globe className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{domain.domain}</h3>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{domain.purpose}</p>
                  </div>
                </div>
                <a
                  href={`https://${domain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Status</span>
                  <span className="flex items-center gap-2 text-cyan-400">
                    <Clock className="w-3 h-3" />
                    Parked
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Ready</span>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Awaiting deployment</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Domain Strategy & Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-xl border ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Domain Strategy
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="text-sm font-semibold text-purple-400 mb-2">Core Brand</h4>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>liv8.co</li>
                <li>liv8ai.com</li>
                <li>liv8health.com</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <h4 className="text-sm font-semibold text-cyan-400 mb-2">Trading</h4>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>hybridfunding.co</li>
                <li>tradehybrid.co</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="text-sm font-semibold text-green-400 mb-2">Services</h4>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>smartlifebrokers</li>
                <li>builtinminutes</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Portfolio Value</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Registration Costs</span>
              <span className={isDark ? 'text-white' : 'text-gray-900'}>${domains.length * 15}/year</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Estimated Value</span>
              <span className="text-green-400">$5,000 - $15,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Deployed</span>
              <div className="flex items-center gap-2">
                <div className={`w-24 h-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                  <div className="h-2 rounded-full bg-green-500" style={{ width: `${(liveDomains.length / domains.length) * 100}%` }} />
                </div>
                <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{Math.round((liveDomains.length / domains.length) * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md rounded-xl ${isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Domain</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Domain Name *</label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`}
                  placeholder="example.com"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Purpose</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`}
                  placeholder="Main website, landing page, etc."
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`}
                >
                  <option value="parked">Parked</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </div>
            <div className={`p-4 border-t flex justify-end gap-3 ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
              <button onClick={() => setShowAddModal(false)} className={`px-4 py-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                Cancel
              </button>
              <button onClick={handleAddDomain} disabled={!formData.domain} className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50">
                <Save className="w-4 h-4 inline-block mr-2" />Add Domain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md rounded-xl ${isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Domain Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Cloud className="w-5 h-5 text-orange-400" />
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Cloudflare Integration</span>
                </div>
                <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {cloudflareStatus.configured
                    ? `Connected - ${cloudflareStatus.domains?.length || 0} zones`
                    : 'Not configured. Enter your Cloudflare credentials below.'}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>API Key</label>
                    <input
                      type="password"
                      value={cfApiKey}
                      onChange={(e) => setCfApiKey(e.target.value)}
                      className={`w-full p-2 rounded-lg border text-sm ${isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-gray-200'}`}
                      placeholder="Your Cloudflare Global API Key"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Email</label>
                    <input
                      type="email"
                      value={cfEmail}
                      onChange={(e) => setCfEmail(e.target.value)}
                      className={`w-full p-2 rounded-lg border text-sm ${isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-gray-200'}`}
                      placeholder="your@email.com"
                    />
                  </div>
                  <button
                    onClick={() => {
                      localStorage.setItem('liv8_cloudflare_api_key', cfApiKey);
                      localStorage.setItem('liv8_cloudflare_email', cfEmail);
                      setShowSettingsModal(false);
                      checkCloudflareStatus();
                    }}
                    disabled={!cfApiKey || !cfEmail}
                    className="w-full px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm disabled:opacity-50"
                  >
                    Save & Connect
                  </button>
                </div>
              </div>
              <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Auto-Sync</span>
                </div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Domains will automatically sync from Cloudflare when credentials are configured.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Domains;
