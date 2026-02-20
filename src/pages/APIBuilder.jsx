import React, { useState, useRef } from 'react';
import {
  Plug, Plus, Play, StopCircle, Save, Trash2, Copy, Settings,
  Globe, Zap, Code, Database, ChevronRight, RefreshCw, ExternalLink,
  AlertCircle, CheckCircle, Edit3, Send, Link, Webhook, FileText,
  Terminal, Lock, Unlock, Search, Download, Upload, ArrowRight, Eye
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

// MCP Connection types
const CONNECTION_TYPES = [
  {
    id: 'graphql',
    name: 'GraphQL API',
    description: 'Connect to any GraphQL endpoint with schema introspection',
    icon: Globe,
    color: 'pink',
    fields: [
      { key: 'url', label: 'GraphQL Endpoint URL', placeholder: 'https://api.example.com/graphql', type: 'url', required: true },
      { key: 'authHeader', label: 'Authorization Header', placeholder: 'Bearer your-token-here', type: 'password' },
      { key: 'customHeaders', label: 'Custom Headers (JSON)', placeholder: '{"X-API-Key": "..."}', type: 'textarea' },
    ]
  },
  {
    id: 'rest',
    name: 'REST API (OpenAPI)',
    description: 'Connect to REST APIs using OpenAPI/Swagger spec',
    icon: Code,
    color: 'blue',
    fields: [
      { key: 'specUrl', label: 'OpenAPI Spec URL', placeholder: 'https://api.example.com/openapi.json', type: 'url', required: true },
      { key: 'baseUrl', label: 'Base URL (override)', placeholder: 'https://api.example.com/v1', type: 'url' },
      { key: 'authHeader', label: 'Authorization Header', placeholder: 'Bearer your-token-here', type: 'password' },
      { key: 'allowUnsafe', label: 'Allow Write Operations', placeholder: '/users/*,/orders/*', type: 'text' },
    ]
  },
  {
    id: 'webhook',
    name: 'Webhook / n8n',
    description: 'Trigger webhooks and automation flows',
    icon: Webhook,
    color: 'green',
    fields: [
      { key: 'url', label: 'Webhook URL', placeholder: 'https://hooks.example.com/trigger', type: 'url', required: true },
      { key: 'method', label: 'HTTP Method', placeholder: 'POST', type: 'select', options: ['POST', 'GET', 'PUT', 'PATCH'] },
      { key: 'authHeader', label: 'Authorization', placeholder: 'Bearer token or API key', type: 'password' },
      { key: 'payload', label: 'Default Payload (JSON)', placeholder: '{"event": "trigger", "data": {}}', type: 'textarea' },
    ]
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Connect to PostgreSQL, MySQL, MongoDB, or Supabase',
    icon: Database,
    color: 'orange',
    fields: [
      { key: 'type', label: 'Database Type', placeholder: 'postgresql', type: 'select', options: ['postgresql', 'mysql', 'mongodb', 'supabase', 'sqlite'], required: true },
      { key: 'connectionString', label: 'Connection String', placeholder: 'postgresql://user:pass@host:5432/db', type: 'password', required: true },
      { key: 'schema', label: 'Schema/Database Name', placeholder: 'public', type: 'text' },
      { key: 'readOnly', label: 'Read Only Mode', type: 'checkbox' },
    ]
  },
  {
    id: 'mcp-server',
    name: 'MCP Server',
    description: 'Connect to any MCP-compatible server (api-agent, etc.)',
    icon: Terminal,
    color: 'purple',
    fields: [
      { key: 'url', label: 'MCP Server URL', placeholder: 'http://localhost:3000/mcp', type: 'url', required: true },
      { key: 'targetUrl', label: 'Target API URL', placeholder: 'https://your-api.com/graphql', type: 'url' },
      { key: 'apiType', label: 'API Type', type: 'select', options: ['graphql', 'rest'] },
      { key: 'targetHeaders', label: 'Target Headers (JSON)', placeholder: '{"Authorization": "Bearer TOKEN"}', type: 'textarea' },
    ]
  },
  {
    id: 'custom',
    name: 'Custom Integration',
    description: 'Build a custom API connection with raw HTTP',
    icon: Plug,
    color: 'cyan',
    fields: [
      { key: 'name', label: 'Integration Name', placeholder: 'My Custom API', type: 'text', required: true },
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.example.com', type: 'url', required: true },
      { key: 'authType', label: 'Auth Type', type: 'select', options: ['none', 'bearer', 'api-key', 'basic', 'oauth2'] },
      { key: 'authValue', label: 'Auth Value', placeholder: 'Token or key value', type: 'password' },
      { key: 'endpoints', label: 'Endpoints (JSON array)', placeholder: '[{"method":"GET","path":"/users","description":"List users"}]', type: 'textarea' },
    ]
  }
];

function APIBuilder() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // State
  const [activeView, setActiveView] = useState('connections'); // connections, builder, tester
  const [connections, setConnections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('api_connections') || '[]'); } catch { return []; }
  });
  const [selectedType, setSelectedType] = useState(null);
  const [connectionConfig, setConnectionConfig] = useState({});
  const [editingId, setEditingId] = useState(null);

  // Tester state
  const [testEndpoint, setTestEndpoint] = useState({ method: 'GET', url: '', headers: '', body: '' });
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  // Natural language query state
  const [nlQuery, setNlQuery] = useState('');
  const [nlResult, setNlResult] = useState(null);
  const [nlLoading, setNlLoading] = useState(false);

  // Save connections to localStorage
  const saveConnections = (conns) => {
    setConnections(conns);
    localStorage.setItem('api_connections', JSON.stringify(conns));
  };

  const saveConnection = () => {
    const conn = {
      ...connectionConfig,
      id: editingId || Date.now().toString(),
      type: selectedType.id,
      typeName: selectedType.name,
      createdAt: editingId ? connectionConfig.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      saveConnections(connections.map(c => c.id === editingId ? conn : c));
    } else {
      saveConnections([...connections, conn]);
    }
    setActiveView('connections');
    setEditingId(null);
    setConnectionConfig({});
  };

  const deleteConnection = (id) => {
    saveConnections(connections.filter(c => c.id !== id));
  };

  const editConnection = (conn) => {
    setSelectedType(CONNECTION_TYPES.find(t => t.id === conn.type));
    setConnectionConfig(conn);
    setEditingId(conn.id);
    setActiveView('builder');
  };

  // Test an API endpoint
  const testAPI = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const headers = {};
      if (testEndpoint.headers) {
        try { Object.assign(headers, JSON.parse(testEndpoint.headers)); } catch {}
      }

      const fetchOptions = {
        method: testEndpoint.method,
        headers: { 'Content-Type': 'application/json', ...headers },
      };
      if (['POST', 'PUT', 'PATCH'].includes(testEndpoint.method) && testEndpoint.body) {
        fetchOptions.body = testEndpoint.body;
      }

      const startTime = Date.now();
      const response = await fetch(testEndpoint.url, fetchOptions);
      const elapsed = Date.now() - startTime;
      const contentType = response.headers.get('content-type') || '';
      let body;
      if (contentType.includes('json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      setTestResult({
        status: response.status,
        statusText: response.statusText,
        elapsed,
        headers: Object.fromEntries(response.headers.entries()),
        body,
        ok: response.ok,
      });
    } catch (error) {
      setTestResult({
        status: 0,
        statusText: 'Network Error',
        error: error.message,
        ok: false,
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Natural language API query
  const runNLQuery = async () => {
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    setNlResult(null);
    try {
      const response = await fetch(`${API_URL}/api/commander/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are an API integration assistant. The user wants to: "${nlQuery}"\n\nBased on this request, generate the appropriate API call. Return a JSON object with: method, url, headers (object), body (if needed), and a brief explanation. Format as a JSON code block.`,
          systemPrompt: 'You are an expert API developer. Generate precise API calls based on user requests. Always return valid JSON.',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNlResult(data.response || data.text || 'Could not generate API call');
      } else {
        setNlResult('Server error - ensure the backend is running with API keys configured.');
      }
    } catch (error) {
      setNlResult('Connection error: ' + error.message);
    } finally {
      setNlLoading(false);
    }
  };

  const colorMap = {
    pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            API & MCP Builder
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Connect to any API, build MCP integrations, and test endpoints
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeView !== 'connections' && (
            <button
              onClick={() => { setActiveView('connections'); setEditingId(null); setConnectionConfig({}); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              }`}
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* Connections View */}
      {activeView === 'connections' && (
        <div className="space-y-6">
          {/* Tabs */}
          <div className={`flex gap-2 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'} pb-2`}>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm">
              <Plug className="w-4 h-4" />
              Connections
            </button>
            <button
              onClick={() => setActiveView('tester')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Play className="w-4 h-4" />
              API Tester
            </button>
          </div>

          {/* Connection Types Grid */}
          <div>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              New Connection
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CONNECTION_TYPES.map(type => {
                const Icon = type.icon;
                const colors = colorMap[type.color];
                return (
                  <button
                    key={type.id}
                    onClick={() => { setSelectedType(type); setConnectionConfig({}); setEditingId(null); setActiveView('builder'); }}
                    className={`p-5 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                      isDark ? 'border-purple-900/30 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{type.name}</h3>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{type.description}</p>
                    <div className="flex items-center mt-3">
                      <ChevronRight className={`w-4 h-4 ml-auto ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Saved Connections */}
          {connections.length > 0 && (
            <div>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Saved Connections ({connections.length})
              </h2>
              <div className="space-y-3">
                {connections.map(conn => {
                  const type = CONNECTION_TYPES.find(t => t.id === conn.type);
                  const Icon = type?.icon || Plug;
                  const colors = colorMap[type?.color || 'cyan'];
                  return (
                    <div
                      key={conn.id}
                      className={`p-4 rounded-xl border flex items-center gap-4 ${
                        isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {conn.name || conn.typeName || 'Unnamed Connection'}
                        </h4>
                        <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {conn.url || conn.specUrl || conn.connectionString || conn.baseUrl || 'No URL'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => editConnection(conn)}
                          className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setTestEndpoint(prev => ({ ...prev, url: conn.url || conn.specUrl || conn.baseUrl || '' }));
                            setActiveView('tester');
                          }}
                          className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10 text-cyan-400' : 'hover:bg-gray-100 text-cyan-500'}`}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteConnection(conn.id)}
                          className={`p-2 rounded-lg ${isDark ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* api-agent Info */}
          <div className={`p-6 rounded-xl border ${
            isDark ? 'border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-cyan-900/20' : 'border-purple-200 bg-gradient-to-br from-purple-50 to-cyan-50'
          }`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Terminal className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  API Agent (MCP Server)
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Turn any GraphQL or REST API into an AI-queryable interface. The API Agent uses natural language
                  to query APIs, with DuckDB post-processing for filtering, sorting, and aggregation. Supports
                  recipe caching for fast repeated queries.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <a
                    href="https://github.com/SuessVilliano/api-agent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                  >
                    <ExternalLink className="w-3 h-3" /> GitHub Repo
                  </a>
                  <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <CheckCircle className="w-3 h-3" /> GraphQL Introspection
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <CheckCircle className="w-3 h-3" /> OpenAPI/REST
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <CheckCircle className="w-3 h-3" /> DuckDB SQL
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <CheckCircle className="w-3 h-3" /> Recipe Caching
                  </span>
                </div>
                <div className={`mt-3 p-3 rounded-lg font-mono text-xs ${isDark ? 'bg-black/30 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                  <p className={isDark ? 'text-gray-500' : 'text-gray-400'}>{'# Run the MCP server:'}</p>
                  <p>uvx --from git+https://github.com/SuessVilliano/api-agent api-agent</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder View */}
      {activeView === 'builder' && selectedType && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className={`p-6 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-3 mb-6">
                {(() => {
                  const Icon = selectedType.icon;
                  const colors = colorMap[selectedType.color];
                  return (
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                  );
                })()}
                <div>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {editingId ? 'Edit' : 'New'} {selectedType.name}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedType.description}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Connection Name */}
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Connection Name</label>
                  <input
                    type="text"
                    value={connectionConfig.name || ''}
                    onChange={(e) => setConnectionConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My API Connection"
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                </div>

                {/* Dynamic Fields */}
                {selectedType.fields.map(field => (
                  <div key={field.key}>
                    <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={connectionConfig[field.key] || ''}
                        onChange={(e) => setConnectionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg border text-sm ${
                          isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                        }`}
                      >
                        <option value="">Select...</option>
                        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={connectionConfig[field.key] || ''}
                        onChange={(e) => setConnectionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={3}
                        className={`w-full px-3 py-2 rounded-lg border text-sm font-mono ${
                          isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                        }`}
                      />
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={connectionConfig[field.key] || false}
                          onChange={(e) => setConnectionConfig(prev => ({ ...prev, [field.key]: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-400 accent-purple-500"
                        />
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Enable</span>
                      </label>
                    ) : (
                      <input
                        type={field.type === 'password' ? 'password' : 'text'}
                        value={connectionConfig[field.key] || ''}
                        onChange={(e) => setConnectionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className={`w-full px-3 py-2 rounded-lg border text-sm ${
                          field.type === 'password' ? 'font-mono' : ''
                        } ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={saveConnection}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 font-medium text-sm"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Update' : 'Save'} Connection
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(connectionConfig, null, 2))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
                    isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                  Copy Config
                </button>
              </div>
            </div>
          </div>

          {/* MCP Config Preview */}
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <h4 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>MCP Config Preview</h4>
              <div className={`p-3 rounded-lg font-mono text-xs overflow-x-auto ${isDark ? 'bg-black/30 text-green-400' : 'bg-gray-100 text-gray-700'}`}>
                <pre>{JSON.stringify({
                  mcpServers: {
                    [connectionConfig.name || 'my-api']: {
                      url: connectionConfig.url || connectionConfig.specUrl || connectionConfig.baseUrl || 'http://localhost:3000/mcp',
                      headers: {
                        'X-Target-URL': connectionConfig.url || connectionConfig.targetUrl || '',
                        'X-API-Type': selectedType.id === 'graphql' ? 'graphql' : 'rest',
                        ...(connectionConfig.authHeader ? { 'Authorization': connectionConfig.authHeader } : {}),
                      }
                    }
                  }
                }, null, 2)}</pre>
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Tips</h4>
              <ul className={`text-xs space-y-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <li>Use the MCP config to connect Claude Desktop or Cursor</li>
                <li>GraphQL APIs support automatic schema introspection</li>
                <li>REST APIs need an OpenAPI spec URL for full functionality</li>
                <li>DuckDB post-processing enables SQL on API results</li>
                <li>Recipes cache successful queries for instant replays</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tester View */}
      {activeView === 'tester' && (
        <div className="space-y-6">
          {/* Tabs */}
          <div className={`flex gap-2 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'} pb-2`}>
            <button
              onClick={() => setActiveView('connections')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Plug className="w-4 h-4" />
              Connections
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm">
              <Play className="w-4 h-4" />
              API Tester
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request Panel */}
            <div className={`rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Request</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex gap-2">
                  <select
                    value={testEndpoint.method}
                    onChange={(e) => setTestEndpoint(prev => ({ ...prev, method: e.target.value }))}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  >
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input
                    type="url"
                    value={testEndpoint.url}
                    onChange={(e) => setTestEndpoint(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://api.example.com/endpoint"
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                  <button
                    onClick={testAPI}
                    disabled={testLoading || !testEndpoint.url}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 text-sm font-medium"
                  >
                    {testLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </button>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Headers (JSON)</label>
                  <textarea
                    value={testEndpoint.headers}
                    onChange={(e) => setTestEndpoint(prev => ({ ...prev, headers: e.target.value }))}
                    placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                    rows={3}
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                {['POST', 'PUT', 'PATCH'].includes(testEndpoint.method) && (
                  <div>
                    <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Body (JSON)</label>
                    <textarea
                      value={testEndpoint.body}
                      onChange={(e) => setTestEndpoint(prev => ({ ...prev, body: e.target.value }))}
                      placeholder='{"key": "value"}'
                      rows={4}
                      className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${
                        isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Response Panel */}
            <div className={`rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Response</h3>
                  {testResult && (
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        testResult.ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {testResult.status} {testResult.statusText}
                      </span>
                      {testResult.elapsed && (
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{testResult.elapsed}ms</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4">
                {testResult ? (
                  <div className={`p-3 rounded-lg font-mono text-xs max-h-[400px] overflow-auto ${
                    isDark ? 'bg-black/30 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <pre>{typeof testResult.body === 'object' ? JSON.stringify(testResult.body, null, 2) : (testResult.body || testResult.error || 'Empty response')}</pre>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Send className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Send a request to see the response</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Natural Language Query */}
          <div className={`p-6 rounded-xl border ${isDark ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50'}`}>
            <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              AI-Powered API Builder
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Describe what you want in plain English and the AI will generate the API call.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runNLQuery()}
                placeholder='e.g., "Get the top 10 trending crypto coins from CoinGecko"'
                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm ${
                  isDark ? 'bg-white/5 border-cyan-500/30 text-white' : 'bg-white border-cyan-200 text-gray-900'
                }`}
              />
              <button
                onClick={runNLQuery}
                disabled={nlLoading || !nlQuery.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 text-sm font-medium"
              >
                {nlLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Generate
              </button>
            </div>
            {nlResult && (
              <div className={`mt-4 p-3 rounded-lg font-mono text-xs overflow-x-auto ${
                isDark ? 'bg-black/30 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}>
                <pre className="whitespace-pre-wrap">{nlResult}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default APIBuilder;
