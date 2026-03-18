import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Copy, Save, RefreshCw, X, Wand2,
  ClipboardPaste, FileText, Check, ChevronDown, Globe
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

/**
 * VoiceDictation - Willow-like voice-to-text tool
 * Speak naturally and paste anywhere, save to notes, or revise with AI
 */
function VoiceDictation({ isOpen, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalText, setFinalText] = useState('');
  const [savedNotes, setSavedNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('voice_notes') || '[]'); } catch { return []; }
  });
  const [copied, setCopied] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [revisionMode, setRevisionMode] = useState('none');
  const [showNotes, setShowNotes] = useState(false);
  const [language, setLanguage] = useState('en-US');

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  // Persist notes
  useEffect(() => {
    localStorage.setItem('voice_notes', JSON.stringify(savedNotes));
  }, [savedNotes]);

  // Initialize speech recognition with continuous mode
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) {
        setFinalText(prev => prev + final);
        setTranscript('');
      } else {
        setTranscript(interim);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in listening mode
      if (recognitionRef.current?._shouldContinue) {
        try { recognition.start(); } catch {}
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.error('Recognition error:', event.error);
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition._shouldContinue = false;
      try { recognition.stop(); } catch {}
    };
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current._shouldContinue = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      recognitionRef.current._shouldContinue = true;
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {}
    }
  };

  const copyToClipboard = async () => {
    const text = finalText.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const saveToNotes = () => {
    const text = finalText.trim();
    if (!text) return;
    const note = {
      id: Date.now().toString(),
      text,
      createdAt: new Date().toISOString(),
    };
    setSavedNotes(prev => [note, ...prev]);
    setFinalText('');
  };

  const deleteNote = (id) => {
    setSavedNotes(prev => prev.filter(n => n.id !== id));
  };

  const reviseWithAI = async (mode) => {
    const text = finalText.trim();
    if (!text) return;
    setIsRevising(true);
    setRevisionMode(mode);

    const prompts = {
      'fix-grammar': `Fix the grammar and punctuation in this text. Keep the meaning identical. Only return the corrected text:\n\n${text}`,
      'professional': `Rewrite this text in a professional, business tone. Keep the meaning but make it polished:\n\n${text}`,
      'casual': `Rewrite this text in a casual, friendly tone:\n\n${text}`,
      'concise': `Make this text more concise while keeping all key information:\n\n${text}`,
      'expand': `Expand this text with more detail and context while keeping the original meaning:\n\n${text}`,
      'email': `Format this text as a professional email. Add appropriate greeting and sign-off:\n\n${text}`,
      'bullet-points': `Convert this text into clear bullet points:\n\n${text}`,
    };

    try {
      const response = await fetch(`${API_URL}/api/commander/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompts[mode] || prompts['fix-grammar'],
          systemPrompt: 'You are a text editor assistant. Return ONLY the revised text without any preamble, explanation, or quotes.',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const revised = data.response || data.text || text;
        setFinalText(revised.replace(/^["']|["']$/g, '').trim());
      }
    } catch (error) {
      console.error('Revision error:', error);
    } finally {
      setIsRevising(false);
      setRevisionMode('none');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
        isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'
      }`} style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? 'border-purple-900/30' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-cyan-500">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Voice Dictation
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Speak naturally, paste anywhere
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`text-xs rounded-lg px-2 py-1 border ${
                isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            >
              <option value="en-US">EN-US</option>
              <option value="en-GB">EN-UK</option>
              <option value="es-ES">ES</option>
              <option value="fr-FR">FR</option>
              <option value="de-DE">DE</option>
              <option value="pt-BR">PT-BR</option>
            </select>
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Mic Button */}
        <div className="p-6 flex flex-col items-center">
          <button
            onClick={toggleListening}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)] animate-pulse'
                : 'bg-gradient-to-br from-green-500 to-cyan-500 hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]'
            }`}
          >
            {isListening ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
          </button>
          <p className={`mt-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {isListening ? 'Listening... tap to stop' : 'Tap to start dictating'}
          </p>
          {isListening && transcript && (
            <p className={`mt-2 text-sm italic ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              {transcript}
            </p>
          )}
        </div>

        {/* Text Area */}
        <div className="px-4 pb-2">
          <textarea
            ref={textareaRef}
            value={finalText}
            onChange={(e) => setFinalText(e.target.value)}
            placeholder="Your dictated text will appear here. You can also type or edit directly..."
            rows={5}
            className={`w-full px-4 py-3 rounded-xl border text-sm resize-none ${
              isDark
                ? 'bg-white/5 border-purple-900/30 text-white placeholder-gray-600'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>

        {/* Actions */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy */}
            <button
              onClick={copyToClipboard}
              disabled={!finalText.trim()}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-500/20 text-green-400'
                  : finalText.trim()
                    ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                    : isDark ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>

            {/* Save to Notes */}
            <button
              onClick={saveToNotes}
              disabled={!finalText.trim()}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${
                finalText.trim()
                  ? 'bg-purple-600 text-white hover:bg-purple-500'
                  : isDark ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              Save Note
            </button>

            {/* Clear */}
            <button
              onClick={() => setFinalText('')}
              disabled={!finalText.trim()}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <X className="w-4 h-4" />
              Clear
            </button>

            {/* View Notes */}
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm ml-auto ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              Notes ({savedNotes.length})
            </button>
          </div>
        </div>

        {/* AI Revision Options */}
        <div className={`px-4 py-3 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Revise with AI
            </span>
            {isRevising && (
              <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'fix-grammar', label: 'Fix Grammar' },
              { id: 'professional', label: 'Professional' },
              { id: 'casual', label: 'Casual' },
              { id: 'concise', label: 'Concise' },
              { id: 'expand', label: 'Expand' },
              { id: 'email', label: 'Email Format' },
              { id: 'bullet-points', label: 'Bullet Points' },
            ].map(option => (
              <button
                key={option.id}
                onClick={() => reviseWithAI(option.id)}
                disabled={!finalText.trim() || isRevising}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  revisionMode === option.id && isRevising
                    ? 'bg-purple-600 text-white'
                    : finalText.trim() && !isRevising
                      ? isDark
                        ? 'bg-white/10 hover:bg-purple-600/30 text-gray-300 hover:text-white'
                        : 'bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700'
                      : isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Saved Notes */}
        {showNotes && savedNotes.length > 0 && (
          <div className={`border-t max-h-48 overflow-y-auto ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
            {savedNotes.map(note => (
              <div key={note.id} className={`p-3 border-b ${isDark ? 'border-purple-900/10 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm line-clamp-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{note.text}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { navigator.clipboard.writeText(note.text); }}
                      className={`p-1 rounded ${isDark ? 'hover:bg-white/10 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => { setFinalText(note.text); setShowNotes(false); }}
                      className={`p-1 rounded ${isDark ? 'hover:bg-white/10 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
                    >
                      <ClipboardPaste className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className={`p-1 rounded ${isDark ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceDictation;
