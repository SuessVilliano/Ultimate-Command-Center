import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

// Embeds the REAL ChatGPT and Gemini web apps side by side so you can use your
// own logged-in account (custom GPT, Gem, full memory) right inside the Command
// Center. This only works in the desktop app (it needs an embedded browser);
// in a normal browser tab those sites block embedding, so we show links instead.

const CHATGPT_URL = 'https://chatgpt.com/';
const GEMINI_URL = 'https://gemini.google.com/app';
// A real desktop Chrome UA helps Google's sign-in accept the embedded window.
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const isElectron = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);

export default function Assistants() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [view, setView] = useState('both'); // 'chatgpt' | 'gemini' | 'both'

  const Toggle = ({ id, label }) => (
    <button
      onClick={() => setView(id)}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        view === id
          ? 'bg-purple-600 text-white'
          : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  // A single embedded assistant panel (Electron only).
  const Panel = ({ url, title }) => (
    <div className="flex-1 flex flex-col min-w-0 border border-gray-700/40 rounded-lg overflow-hidden bg-white">
      <div className={`px-3 py-1.5 text-xs font-medium ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
        {title}
      </div>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <webview
        src={url}
        partition="persist:assistants"
        useragent={CHROME_UA}
        allowpopups="true"
        style={{ flex: 1, width: '100%', height: '100%' }}
      />
    </div>
  );

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI Copilots</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Your own ChatGPT and Gemini, logged in, side by side.
          </p>
        </div>
        {isElectron && (
          <div className="flex items-center gap-2">
            <Toggle id="chatgpt" label="ChatGPT" />
            <Toggle id="gemini" label="Gemini" />
            <Toggle id="both" label="Both" />
          </div>
        )}
      </div>

      {isElectron ? (
        <div className="flex-1 flex gap-3 min-h-0">
          {(view === 'chatgpt' || view === 'both') && <Panel url={CHATGPT_URL} title="ChatGPT" />}
          {(view === 'gemini' || view === 'both') && <Panel url={GEMINI_URL} title="Gemini" />}
        </div>
      ) : (
        <div className={`flex-1 flex items-center justify-center rounded-xl border ${isDark ? 'border-gray-800 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
          <div className="text-center max-w-md p-8">
            <div className="text-4xl mb-3">🖥️</div>
            <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Open the desktop app to embed your assistants
            </h2>
            <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              ChatGPT and Gemini block embedding in a normal browser tab. In the LIV8
              desktop app they load right here, logged into your own account. For now,
              open them in a new tab:
            </p>
            <div className="flex items-center justify-center gap-3">
              <a href={CHATGPT_URL} target="_blank" rel="noreferrer"
                 className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-500">Open ChatGPT</a>
              <a href={GEMINI_URL} target="_blank" rel="noreferrer"
                 className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500">Open Gemini</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
