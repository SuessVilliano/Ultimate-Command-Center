const fs = require('fs');
let content = fs.readFileSync('ChatWidget.jsx', 'utf8');

// Replace old API key section with new AI Settings button
const oldSection = `                <div className="pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className={\`text-xs font-medium \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
                      AI: {aiService.hasApiKey() ? '✓ Connected' : '○ Not configured'}
                    </span>
                    <button
                      onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                      className={\`text-xs px-2 py-1 rounded \${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}\`}
                    >
                      {showApiKeyInput ? 'Cancel' : 'Configure AI'}
                    </button>
                  </div>
                  {showApiKeyInput && (
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Enter Gemini API key..."
                        className={\`w-full px-2 py-1.5 rounded text-sm \${isDark ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} border\`}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveApiKey}
                          disabled={!apiKey}
                          className="flex-1 px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
                        >
                          Save Key
                        </button>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={\`px-2 py-1 text-xs rounded \${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}\`}
                        >
                          Get Key
                        </a>
                      </div>
                    </div>
                  )}
                </div>`;

const newSection = `                <div className="pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className={\`text-xs font-medium \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
                      AI: {backendStatus.connected ? \`\${backendStatus.provider} ✓\` : '○ Offline'}
                    </span>
                    <button
                      onClick={() => setShowAISettings(true)}
                      className={\`text-xs px-2 py-1 rounded \${isDark ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-purple-600 text-white hover:bg-purple-500'}\`}
                    >
                      AI Settings
                    </button>
                  </div>
                  {backendStatus.connected && (
                    <div className={\`text-xs \${isDark ? 'text-gray-500' : 'text-gray-400'}\`}>
                      Model: {backendStatus.model || 'default'}
                    </div>
                  )}
                </div>`;

content = content.replace(oldSection, newSection);

// Find the closing of the component and add the AI Settings modal before it
const modalCode = `
      {/* AI Settings Modal */}
      {showAISettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAISettings(false)}>
          <div onClick={e => e.stopPropagation()}>
            <AISettings
              isDark={isDark}
              onClose={() => setShowAISettings(false)}
              onProviderChange={(data) => {
                setBackendStatus(prev => ({ ...prev, provider: data.provider, model: data.model }));
              }}
            />
          </div>
        </div>
      )}
`;

// Insert modal before the final closing tag of the return
content = content.replace(
  /(\s*<\/div>\s*\);\s*}\s*export default ChatWidget;)/,
  modalCode + '\n    </div>\n  );\n}\n\nexport default ChatWidget;'
);

fs.writeFileSync('ChatWidget.jsx', content);
console.log('ChatWidget updated');
