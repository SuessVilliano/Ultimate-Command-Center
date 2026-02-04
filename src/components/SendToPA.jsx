import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  X,
  MessageSquare,
  CheckCircle,
  Clock,
  FileText,
  Zap,
  Loader2,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

// Quick send types with their icons and descriptions
const SEND_TYPES = [
  { id: 'note', label: 'Quick Note', icon: FileText, placeholder: 'Type a note to remember...' },
  { id: 'reminder', label: 'Reminder', icon: Clock, placeholder: 'What do you need to remember?' },
  { id: 'action_item', label: 'Action Item', icon: Zap, placeholder: 'What needs to be done?' },
  { id: 'ai_summary', label: 'AI Summary', icon: Sparkles, placeholder: 'Paste text to summarize and send...' }
];

function SendToPA({ contextData = null, onSent = null }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [message, setMessage] = useState('');
  const [sendType, setSendType] = useState('note');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Reset sent status after animation
  useEffect(() => {
    if (sent) {
      const timer = setTimeout(() => {
        setSent(false);
        setMessage('');
        setIsOpen(false);
        setIsMinimized(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sent]);

  const handleSend = async () => {
    if (!message.trim() && !contextData) return;

    setSending(true);
    setError(null);

    try {
      let payload = {
        type: sendType,
        message: message.trim()
      };

      // If context data is provided (like a ticket or task), include it
      if (contextData) {
        payload.data = contextData;
      }

      // For action items, parse deadline if mentioned
      if (sendType === 'action_item' && message.includes('by ')) {
        const deadlineMatch = message.match(/by\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2})/i);
        if (deadlineMatch) {
          payload.data = {
            ...payload.data,
            title: message.replace(deadlineMatch[0], '').trim(),
            deadline: deadlineMatch[1]
          };
        }
      }

      const response = await fetch(`${API_URL}/api/telegram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        setSent(true);
        if (onSent) onSent(result);
      } else {
        throw new Error(result.error || 'Failed to send');
      }
    } catch (err) {
      console.error('SendToPA error:', err);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setIsMinimized(true);
    }
  };

  const currentType = SEND_TYPES.find(t => t.id === sendType);
  const TypeIcon = currentType?.icon || MessageSquare;

  // Floating button (minimized state)
  if (!isOpen || isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className={`group relative p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${
            isDark
              ? 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500'
              : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400'
          }`}
          title="Send to Personal Assistant"
        >
          <Send className="w-6 h-6 text-white" />
          {/* Pulse indicator */}
          <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
          {/* Tooltip */}
          <span className={`absolute right-full mr-3 px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity ${
            isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 shadow-lg'
          }`}>
            Send to PA
          </span>
        </button>
      </div>
    );
  }

  // Expanded panel
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`w-80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-gray-900 border border-white/10'
            : 'bg-white border border-gray-200'
        }`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3 flex items-center justify-between ${
            isDark
              ? 'bg-gradient-to-r from-cyan-600 to-purple-600'
              : 'bg-gradient-to-r from-cyan-500 to-purple-500'
          }`}
        >
          <div className="flex items-center gap-2 text-white">
            <Send className="w-5 h-5" />
            <span className="font-semibold">Send to PA</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(true);
              }}
              className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Success State */}
          {sent ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3 animate-bounce" />
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Sent to your PA!
              </p>
            </div>
          ) : (
            <>
              {/* Type selector */}
              <div className="flex gap-1 mb-3">
                {SEND_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSendType(type.id)}
                      className={`flex-1 p-2 rounded-lg flex flex-col items-center gap-1 text-xs transition-colors ${
                        sendType === type.id
                          ? isDark
                            ? 'bg-cyan-600 text-white'
                            : 'bg-cyan-100 text-cyan-700'
                          : isDark
                          ? 'bg-white/5 text-gray-400 hover:bg-white/10'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="truncate w-full text-center">{type.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Input area */}
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentType?.placeholder}
                  rows={3}
                  className={`w-full p-3 pr-12 rounded-lg resize-none transition-colors ${
                    isDark
                      ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-cyan-500'
                      : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-cyan-500'
                  } focus:outline-none focus:ring-2 focus:ring-cyan-500/20`}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || (!message.trim() && !contextData)}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all ${
                    sending
                      ? 'bg-gray-500 cursor-wait'
                      : message.trim() || contextData
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      : isDark
                      ? 'bg-white/10 text-gray-500'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Error message */}
              {error && (
                <p className="mt-2 text-sm text-red-500">{error}</p>
              )}

              {/* Keyboard shortcut hint */}
              <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Press <kbd className={`px-1 rounded ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>Enter</kbd> to send, <kbd className={`px-1 rounded ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>Esc</kbd> to close
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SendToPA;
