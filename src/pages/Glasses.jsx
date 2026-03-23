import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../config';

/**
 * Glasses Companion Page
 *
 * Optimized for Meta Ray-Bans + VisionClaw:
 * - Always-on voice listening (no tapping)
 * - Auto-speaks responses
 * - Camera capture for vision analysis
 * - Proactive alerts spoken automatically
 * - Minimal UI — big text, no clutter
 */

// Alert priority thresholds
const ALERT_CHECK_INTERVAL = 60000; // Check for alerts every 60s
const BRIEFING_CHECK_INTERVAL = 300000; // Check briefing every 5min

function Glasses() {
  // Core state
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking | error
  const [displayText, setDisplayText] = useState('Say something or tap the mic...');
  const [lastResponse, setLastResponse] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Proactive alerts
  const [alertQueue, setAlertQueue] = useState([]);
  const [lastAlertCheck, setLastAlertCheck] = useState(null);

  // Vision
  const [cameraActive, setCameraActive] = useState(false);
  const [lastCapture, setLastCapture] = useState(null);

  // Settings
  const [autoListen, setAutoListen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceId, setVoiceId] = useState(() =>
    localStorage.getItem('liv8_edge_voice') || 'en-US-AvaMultilingualNeural'
  );

  // Refs
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const alertIntervalRef = useRef(null);
  const speakingRef = useRef(false);
  const autoListenRef = useRef(autoListen);
  const statusRef = useRef(status);

  // Keep refs in sync
  useEffect(() => { autoListenRef.current = autoListen; }, [autoListen]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Health check ──
  useEffect(() => {
    fetch(`${API_URL}/health`).then(r => {
      setIsConnected(r.ok);
      if (r.ok) setDisplayText('Command Center online. Ready.');
    }).catch(() => setIsConnected(false));
  }, []);

  // ── Speech Recognition Setup ──
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      // Don't process speech while AI is speaking (echo prevention)
      if (speakingRef.current) return;

      let interim = '';
      let newFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newFinal += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim) {
        setDisplayText(interim);
        setStatus('listening');
      }

      if (newFinal && newFinal.trim()) {
        handleVoiceInput(newFinal.trim());
      }
    };

    recognition.onend = () => {
      // Auto-restart if we should be listening and not speaking
      if (autoListenRef.current && !speakingRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 300);
      } else {
        setStatus('idle');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Speech error:', event.error);
    };

    recognitionRef.current = recognition;

    // Auto-start listening
    if (autoListen) {
      try { recognition.start(); setStatus('listening'); } catch {}
    }

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, []);

  // ── Handle voice input → AI → speak response ──
  const handleVoiceInput = useCallback(async (text) => {
    setStatus('thinking');
    setDisplayText(text);

    // Check for special commands
    const lower = text.toLowerCase();

    // Camera command
    if (lower.includes('what do you see') || lower.includes('look at this') ||
        lower.includes('scan this') || lower.includes('read this') ||
        lower.includes('what is this') || lower.includes('analyze this')) {
      await captureAndAnalyze(text);
      return;
    }

    // Briefing command
    if (lower.includes('brief me') || lower.includes('give me a briefing') ||
        lower.includes('what\'s going on') || lower.includes('status report')) {
      await fetchAndSpeakBriefing();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId,
          voice: voiceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversationId) setConversationId(data.conversationId);

        const reply = data.response || 'No response.';
        setLastResponse(reply);
        setDisplayText(reply);

        await speakResponse(data.audio, reply);
      } else {
        setDisplayText('Server error. Try again.');
        setStatus('error');
        setTimeout(() => setStatus('listening'), 2000);
      }
    } catch (err) {
      console.error('Voice error:', err);
      setDisplayText('Connection lost.');
      setStatus('error');
      setTimeout(() => setStatus('listening'), 3000);
    }
  }, [conversationId, voiceId]);

  // ── Speak a response (base64 audio or browser TTS fallback) ──
  const speakResponse = useCallback(async (audioBase64, text) => {
    setStatus('speaking');
    speakingRef.current = true;

    // Stop listening while speaking to prevent echo
    try { recognitionRef.current?.stop(); } catch {}

    try {
      if (audioBase64) {
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const blob = new Blob([audioBytes], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise((resolve) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play().catch(resolve);
        });
      } else if ('speechSynthesis' in window) {
        // Browser TTS fallback
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        await new Promise((resolve) => {
          utterance.onend = resolve;
          utterance.onerror = resolve;
          window.speechSynthesis.speak(utterance);
        });
      }
    } catch (err) {
      console.error('Speak error:', err);
    } finally {
      speakingRef.current = false;
      setStatus('listening');

      // Resume listening after speaking
      if (autoListenRef.current) {
        setTimeout(() => {
          try { recognitionRef.current?.start(); } catch {}
        }, 500);
      }
    }
  }, []);

  // ── Camera: Capture + Vision Analysis ──
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setDisplayText('Camera not available.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const captureAndAnalyze = useCallback(async (prompt) => {
    setStatus('thinking');
    setDisplayText('Analyzing what I see...');

    // If camera isn't active, start it and capture after a brief delay
    if (!cameraActive && !videoRef.current?.srcObject) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: 1280, height: 720 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video to load
          await new Promise(resolve => {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play();
              setTimeout(resolve, 500);
            };
          });
          setCameraActive(true);
        }
      } catch (err) {
        setDisplayText('Camera not available. Try again.');
        setStatus('listening');
        return;
      }
    }

    // Capture frame
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    setLastCapture(canvas.toDataURL('image/jpeg', 0.3));

    try {
      const response = await fetch(`${API_URL}/api/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          prompt: prompt || 'What do you see? Be concise.',
          conversationId,
          voice: voiceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversationId) setConversationId(data.conversationId);

        const reply = data.response || 'I couldn\'t analyze that.';
        setLastResponse(reply);
        setDisplayText(reply);
        await speakResponse(data.audio, reply);
      } else {
        setDisplayText('Vision analysis failed.');
        setStatus('listening');
      }
    } catch (err) {
      console.error('Vision error:', err);
      setDisplayText('Could not analyze image.');
      setStatus('listening');
    }
  }, [cameraActive, conversationId, voiceId, speakResponse]);

  // ── Proactive Alerts ──
  const checkAlerts = useCallback(async () => {
    // Don't interrupt if speaking or thinking
    if (speakingRef.current || statusRef.current === 'thinking') return;

    try {
      const response = await fetch(`${API_URL}/api/alerts/glasses`);
      if (!response.ok) return;

      const data = await response.json();

      // Only speak if there are alerts and they're different from last check
      if (data.count > 0 && data.summary) {
        const alertText = 'Commander update: ' + data.summary;
        const lastAlert = localStorage.getItem('glasses_last_alert');
        if (lastAlert !== alertText) {
          localStorage.setItem('glasses_last_alert', alertText);
          setAlertQueue(prev => [...prev, alertText]);
        }
      }

      setLastAlertCheck(new Date());
    } catch (err) {
      console.error('Alert check error:', err);
    }
  }, []);

  // Process alert queue — speak one at a time
  useEffect(() => {
    if (alertQueue.length === 0) return;
    if (speakingRef.current || status === 'thinking' || status === 'speaking') return;

    const alert = alertQueue[0];
    setAlertQueue(prev => prev.slice(1));
    setDisplayText(alert);
    speakResponse(null, alert);
  }, [alertQueue, status, speakResponse]);

  // Start alert polling
  useEffect(() => {
    // Initial check after 10s (let page load)
    const initialTimeout = setTimeout(checkAlerts, 10000);
    alertIntervalRef.current = setInterval(checkAlerts, ALERT_CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(alertIntervalRef.current);
    };
  }, [checkAlerts]);

  // ── Fetch & speak a full briefing ──
  const fetchAndSpeakBriefing = useCallback(async () => {
    setStatus('thinking');
    setDisplayText('Getting your briefing...');

    try {
      const response = await fetch(`${API_URL}/api/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Give me a quick executive briefing. What are my priorities right now? Any urgent tickets? How are the markets? Keep it under 30 seconds of speaking.',
          conversationId,
          voice: voiceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversationId) setConversationId(data.conversationId);
        setLastResponse(data.response);
        setDisplayText(data.response);
        await speakResponse(data.audio, data.response);
      } else {
        setDisplayText('Could not get briefing.');
        setStatus('listening');
      }
    } catch {
      setDisplayText('Briefing failed. Check connection.');
      setStatus('listening');
    }
  }, [conversationId, voiceId, speakResponse]);

  // ── Toggle listening ──
  const toggleListening = () => {
    if (autoListen) {
      setAutoListen(false);
      try { recognitionRef.current?.stop(); } catch {}
      setStatus('idle');
    } else {
      setAutoListen(true);
      try { recognitionRef.current?.start(); } catch {}
      setStatus('listening');
    }
  };

  // ── Status colors ──
  const statusConfig = {
    idle: { color: 'text-gray-500', bg: 'bg-gray-800', pulse: false, label: 'Idle' },
    listening: { color: 'text-green-400', bg: 'bg-green-500/20', pulse: true, label: 'Listening' },
    thinking: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', pulse: true, label: 'Thinking' },
    speaking: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', pulse: true, label: 'Speaking' },
    error: { color: 'text-red-400', bg: 'bg-red-500/20', pulse: false, label: 'Error' },
  };

  const currentStatus = statusConfig[status] || statusConfig.idle;

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-between p-6 select-none"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* Hidden video/canvas for camera capture */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar — status + connection */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-white/40 text-xs font-mono">
            {isConnected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastAlertCheck && (
            <span className="text-white/20 text-xs font-mono">
              Alerts: {lastAlertCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-white/30 hover:text-white/60 text-xs"
          >
            {showSettings ? 'CLOSE' : 'SETTINGS'}
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="w-full max-w-md bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Auto-listen</span>
              <button
                onClick={toggleListening}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  autoListen ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
                }`}
              >
                {autoListen ? 'ON' : 'OFF'}
              </button>
            </label>
            <label className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Camera</span>
              <button
                onClick={cameraActive ? stopCamera : startCamera}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  cameraActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-white/40'
                }`}
              >
                {cameraActive ? 'ON' : 'OFF'}
              </button>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={checkAlerts}
                className="flex-1 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium"
              >
                Check Alerts Now
              </button>
              <button
                onClick={fetchAndSpeakBriefing}
                className="flex-1 px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium"
              >
                Get Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main display area — the response text */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-4">
        {/* Camera preview thumbnail */}
        {lastCapture && (
          <div className="mb-4 opacity-40">
            <img src={lastCapture} alt="" className="w-32 h-20 object-cover rounded-lg" />
          </div>
        )}

        {/* Main text */}
        <p className={`text-center text-2xl sm:text-3xl font-light leading-relaxed ${
          status === 'listening' ? 'text-white/50' :
          status === 'thinking' ? 'text-yellow-300/70' :
          status === 'speaking' ? 'text-white' :
          status === 'error' ? 'text-red-400/70' :
          'text-white/60'
        }`}>
          {displayText}
        </p>
      </div>

      {/* Bottom — status indicator + mic button */}
      <div className="w-full flex flex-col items-center gap-6">
        {/* Status label */}
        <div className={`flex items-center gap-2 ${currentStatus.color}`}>
          <div className={`w-2 h-2 rounded-full ${currentStatus.color.replace('text-', 'bg-')} ${
            currentStatus.pulse ? 'animate-pulse' : ''
          }`} />
          <span className="text-sm font-mono uppercase tracking-wider">{currentStatus.label}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-4">
          {/* Camera button */}
          <button
            onClick={() => captureAndAnalyze('What do you see? Describe it concisely.')}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/60">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          {/* Main mic button */}
          <button
            onClick={toggleListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              status === 'listening'
                ? 'bg-green-500 shadow-[0_0_60px_rgba(34,197,94,0.4)]'
                : status === 'speaking'
                  ? 'bg-cyan-500 shadow-[0_0_60px_rgba(6,182,212,0.4)]'
                  : status === 'thinking'
                    ? 'bg-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.3)]'
                    : 'bg-white/20 hover:bg-white/30'
            } ${currentStatus.pulse ? 'animate-pulse' : ''}`}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              {autoListen ? (
                <>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" x2="12" y1="19" y2="22"/>
                </>
              ) : (
                <>
                  <line x1="2" x2="22" y1="2" y2="22"/>
                  <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
                  <path d="M5 10v2a7 7 0 0 0 12 5"/>
                  <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
                  <line x1="12" x2="12" y1="19" y2="22"/>
                </>
              )}
            </svg>
          </button>

          {/* Briefing button */}
          <button
            onClick={fetchAndSpeakBriefing}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/60">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" x2="8" y1="13" y2="13"/>
              <line x1="16" x2="8" y1="17" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </button>
        </div>

        {/* Glasses mode indicator */}
        <span className="text-white/15 text-xs font-mono tracking-widest">
          LIV8 COMMAND CENTER  //  GLASSES MODE
        </span>
      </div>
    </div>
  );
}

export default Glasses;
