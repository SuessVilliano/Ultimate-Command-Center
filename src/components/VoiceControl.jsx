import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  VolumeX,
  Volume2,
  Settings,
  MessageSquare,
  X,
  Send,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { API_URL } from '../config';

// Navigation commands still handled locally for instant response
const NAV_COMMANDS = {
  'go to dashboard': 'dashboard', 'open dashboard': 'dashboard',
  'go to projects': 'projects', 'open projects': 'projects',
  'go to agents': 'agents', 'open agents': 'agents',
  'go to actions': 'actions', 'go to domains': 'domains',
  'go to valuation': 'valuation', 'go to github': 'github',
  'go to trading': 'trading', 'open trading': 'trading',
  'go to voice agents': 'voice-agents', 'open voice agents': 'voice-agents',
  'go to api builder': 'api-builder', 'open api builder': 'api-builder',
  'go to news': 'news', 'open news': 'news',
  'go to integrations': 'integrations', 'open integrations': 'integrations',
};

function VoiceControl({ onNavigate, isOpen, onClose }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your LIV8 Command Center voice assistant. Ask me anything — I\'ll give you real answers about your business, markets, projects, or anything else. You can also say "go to [page]" to navigate.' }
  ]);

  // Voice settings
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 1, pitch: 1, volume: 1
  });

  // Feature support
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // System context for the AI
  const SYSTEM_PROMPT = `You are the LIV8 Command Center AI assistant. You speak conversationally and give real, helpful answers.

You are integrated into a business operations dashboard for Hybrid Holdings LLC, which manages:
- Hybrid Funding (hybridfunding.co) - proprietary trading firm with challenge programs
- Trade Hybrid (tradehybrid.co) - trading education platform
- LIV8 Solar (liv8solar.com) - smart energy consulting
- LIV8 Health (liv8health.com) - health supplements e-commerce
- LIV8 AI (liv8ai.com) - AI solutions & machine learning services
- Smart Life Brokers (smartlifebrokers.com) - insurance & financial services

The Command Center has these sections: Dashboard, Agent Team (12 AI agents on Taskade), News & Markets (live crypto/stock data), Trading (live market data), Voice Agents (build voice AI for clients), API Builder (MCP connections), Projects, Integrations (Freshdesk, ClickUp, GoHighLevel, TaskMagic, GitHub), Valuation, Domains, and GitHub.

Keep responses concise for voice — under 3 sentences when possible. Be direct and helpful.`;

  // Check for browser support and load voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      setSpeechSupported(true);
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        if (availableVoices.length > 0) {
          const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
          const preferredVoice = englishVoices.find(v =>
            v.name.includes('Google') || v.name.includes('Microsoft') ||
            v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('David')
          ) || englishVoices[0] || availableVoices[0];
          setSelectedVoice(preferredVoice);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setRecognitionSupported(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setTranscript(interim || final);
        if (final) {
          processCommand(final.trim());
          setTranscript('');
        }
      };

      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Auto scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = (text) => {
    if (!speechSupported || voices.length === 0) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.volume = voiceSettings.volume;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const processCommand = async (command) => {
    const lowerCommand = command.toLowerCase();
    setMessages(prev => [...prev, { role: 'user', content: command }]);

    // Check navigation commands first (instant, no API call needed)
    for (const [key, target] of Object.entries(NAV_COMMANDS)) {
      if (lowerCommand.includes(key)) {
        const response = `Navigating to ${target.replace('-', ' ')}`;
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        speak(response);
        setTimeout(() => { onNavigate(target); onClose(); }, 500);
        return;
      }
    }

    // For everything else, call the real AI backend
    setIsThinking(true);
    try {
      // Build conversation history for context
      const conversationHistory = messages.slice(-6).map(m => ({
        role: m.role, content: m.content
      }));

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: command,
          systemPrompt: SYSTEM_PROMPT,
          conversationHistory,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.response || data.text || data.message || '';
        if (reply) {
          setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
          speak(reply);
          return;
        }
      }

      // Fallback to commander endpoint
      const fallbackResponse = await fetch(`${API_URL}/api/commander/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: command,
          systemPrompt: SYSTEM_PROMPT,
        }),
      });

      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        const reply = data.response || data.text || 'I received your message but couldn\'t generate a response. Please check the AI settings.';
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        speak(reply);
      } else {
        const errorMsg = 'I\'m having trouble connecting to the AI backend. Please make sure the server is running and API keys are configured in Settings.';
        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        speak(errorMsg);
      }
    } catch (error) {
      console.error('Voice AI error:', error);
      const errorMsg = 'Connection error. Please check that the server is running.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      speak(errorMsg);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionSupported) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      processCommand(inputText.trim());
      setInputText('');
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-[600px] bg-gray-900 border border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/20 bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">LIV8 Voice Assistant</h2>
              <p className="text-xs text-gray-400">
                {isListening ? 'Listening...' : isThinking ? 'Thinking...' : isSpeaking ? 'Speaking...' : 'Ready — ask me anything'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b border-purple-500/20 bg-gray-800/50">
            <h3 className="text-sm font-semibold text-white mb-3">Voice Settings</h3>
            {voices.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Voice ({voices.filter(v => v.lang.startsWith('en')).length} available)</label>
                  <select
                    value={selectedVoice?.name || ''}
                    onChange={(e) => setSelectedVoice(voices.find(v => v.name === e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    {voices.filter(v => v.lang.startsWith('en')).map((voice) => (
                      <option key={voice.name} value={voice.name}>{voice.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Speed: {voiceSettings.rate}x</label>
                  <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.rate}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                    className="w-full accent-purple-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Pitch: {voiceSettings.pitch}</label>
                  <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.pitch}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                    className="w-full accent-purple-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Volume: {Math.round(voiceSettings.volume * 100)}%</label>
                  <input type="range" min="0" max="1" step="0.1" value={voiceSettings.volume}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                    className="w-full accent-purple-500" />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-400">No voices available. Text-to-speech may not work in this browser.</p>
              </div>
            )}
            {voices.length > 0 && (
              <button onClick={() => speak('This is a test of the LIV8 voice assistant.')}
                className="mt-3 px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors">
                Test Voice
              </button>
            )}
          </div>
        )}

        {/* Browser Support Warnings */}
        {(!speechSupported || !recognitionSupported) && (
          <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30">
            <div className="flex items-center gap-2 text-yellow-400 text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>
                {!recognitionSupported && 'Speech recognition not supported. '}
                {!speechSupported && 'Text-to-speech not supported. '}
                Use Chrome or Edge for full features.
              </span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-200 rounded-bl-sm'
              }`}>
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl bg-gray-800 text-gray-400 rounded-bl-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          {transcript && (
            <div className="flex justify-end">
              <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-purple-600/50 text-white/80 rounded-br-sm">
                <p className="text-sm italic">{transcript}...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-purple-500/20 bg-gray-900">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleListening}
              disabled={!recognitionSupported || isThinking}
              className={`p-4 rounded-full transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : recognitionSupported && !isThinking
                    ? 'bg-purple-600 text-white hover:bg-purple-500'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {isSpeaking && (
              <button onClick={stopSpeaking}
                className="p-4 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                <VolumeX className="w-6 h-6" />
              </button>
            )}

            <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask anything — markets, projects, agents, business..."
                disabled={isThinking}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
              />
              <button type="submit" disabled={isThinking || !inputText.trim()}
                className="p-3 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 transition-colors disabled:opacity-50">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>

          {isListening && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 bg-purple-500 rounded-full animate-pulse"
                    style={{ height: `${12 + Math.random() * 16}px`, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-xs text-purple-400">Listening... speak now</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceControl;
