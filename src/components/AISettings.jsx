import React, { useState, useEffect } from 'react';
import { Settings, Check, X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

const BACKEND_URL = API_URL;

const PROVIDERS = [
  { id: 'gemini', name: 'Gemini', icon: '🌟', color: 'blue' },
  { id: 'claude', name: 'Claude', icon: '🤖', color: 'purple' },
  { id: 'openai', name: 'OpenAI', icon: '🧠', color: 'green' }
];

export default function AISettings({ isDark = true, onClose, onProviderChange }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerStatus, setProviderStatus] = useState({
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    available: { claude: false, openai: false, gemini: false },
    hasKeys: { claude: false, openai: false, gemini: false },
    models: {}
  });

  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    claude: '',
    openai: ''
  });

  const [showKeys, setShowKeys] = useState({
    gemini: false,
    claude: false,
    openai: false
  });

  const [selectedModel, setSelectedModel] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchProviderStatus();
  }, []);

  const fetchProviderStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/ai/provider`);
      if (response.ok) {
        const data = await response.json();
        setProviderStatus(data);
        setSelectedModel(data.model);
      }
    } catch (error) {
      console.error('Failed to fetch provider status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSwitch = async (providerId) => {
    if (!providerStatus.available[providerId]) {
      setMessage({ type: 'error', text: `${providerId} API key not configured. Add it below first.` });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${BACKEND_URL}/api/ai/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId })
      });

      if (response.ok) {
        const data = await response.json();
        setProviderStatus(prev => ({ ...prev, provider: data.provider, model: data.model }));
        setSelectedModel(data.model);
        setMessage({ type: 'success', text: `Switched to ${providerId}` });
        onProviderChange?.(data);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to switch provider' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to switch provider' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async (providerId) => {
    const key = apiKeys[providerId];
    if (!key) return;

    try {
      setSaving(true);
      const response = await fetch(`${BACKEND_URL}/api/ai/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey: key })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `${providerId} API key saved!` });
        setApiKeys(prev => ({ ...prev, [providerId]: '' }));
        fetchProviderStatus(); // Refresh status
      } else {
        setMessage({ type: 'error', text: 'Failed to save API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleModelChange = async (model) => {
    try {
      setSaving(true);
      const response = await fetch(`${BACKEND_URL}/api/ai/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerStatus.provider, model })
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedModel(data.model);
        setMessage({ type: 'success', text: `Model changed to ${model}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change model' });
    } finally {
      setSaving(false);
    }
  };

  const getKeyLink = (providerId) => {
    switch (providerId) {
      case 'gemini': return 'https://aistudio.google.com/app/apikey';
      case 'claude': return 'https://console.anthropic.com/settings/keys';
      case 'openai': return 'https://platform.openai.com/api-keys';
      default: return '#';
    }
  };

  if (loading) {
    return (
      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-xl max-w-md w-full`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Settings className="w-5 h-5" />
          AI Provider Settings
        </h3>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {message.text && (
        <div className={`mb-4 p-2 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Provider Selection */}
      <div className="mb-4">
        <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2 block`}>
          Active Provider
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map(provider => (
            <button
              key={provider.id}
              onClick={() => handleProviderSwitch(provider.id)}
              disabled={saving}
              className={`p-3 rounded-lg border-2 transition-all ${
                providerStatus.provider === provider.id
                  ? `border-${provider.color}-500 bg-${provider.color}-500/20`
                  : isDark
                    ? 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              } ${!providerStatus.available[provider.id] ? 'opacity-50' : ''}`}
            >
              <div className="text-2xl mb-1">{provider.icon}</div>
              <div className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {provider.name}
              </div>
              {providerStatus.available[provider.id] ? (
                <Check className="w-3 h-3 text-green-400 mx-auto mt-1" />
              ) : (
                <span className="text-xs text-gray-500">No key</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      {providerStatus.models?.[providerStatus.provider] && (
        <div className="mb-4">
          <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2 block`}>
            Model
          </label>
          <select
            value={selectedModel}
            onChange={e => handleModelChange(e.target.value)}
            disabled={saving}
            className={`w-full px-3 py-2 rounded-lg border ${
              isDark
                ? 'bg-gray-900 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {providerStatus.models[providerStatus.provider]?.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} {model.default ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* API Keys Section */}
      <div className="space-y-3">
        <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} block`}>
          API Keys
        </label>
        {PROVIDERS.map(provider => (
          <div key={provider.id} className={`p-3 rounded-lg ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {provider.icon} {provider.name}
              </span>
              <div className="flex items-center gap-2">
                {providerStatus.hasKeys?.[provider.id] && (
                  <span className="text-xs text-green-400">Configured</span>
                )}
                <a
                  href={getKeyLink(provider.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  Get Key
                </a>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeys[provider.id] ? 'text' : 'password'}
                  value={apiKeys[provider.id]}
                  onChange={e => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                  placeholder={providerStatus.hasKeys?.[provider.id] ? 'Update key...' : 'Enter API key...'}
                  className={`w-full px-3 py-1.5 pr-8 rounded text-sm ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } border`}
                />
                <button
                  onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={() => handleSaveApiKey(provider.id)}
                disabled={!apiKeys[provider.id] || saving}
                className="px-3 py-1.5 text-sm rounded bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Current Status */}
      <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Current: <span className="text-white font-medium">{providerStatus.provider}</span> / {providerStatus.model}
        </div>
      </div>
    </div>
  );
}
