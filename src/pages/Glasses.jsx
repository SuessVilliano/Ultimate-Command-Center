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

// Timing constants
const ALERT_CHECK_INTERVAL = 60000; // Check for alerts every 60s
const SCREEN_MONITOR_INTERVAL = 15000; // Capture screen every 15s
const MONITOR_COOLDOWN = 30000; // Don't speak more than once every 30s

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

  // Screen monitoring
  const [screenSharing, setScreenSharing] = useState(false);
  const [monitorActive, setMonitorActive] = useState(false);
  const [monitorContext, setMonitorContext] = useState(null); // what tool AI detected
  const [monitorCount, setMonitorCount] = useState(0);

  // Live streaming
  const [isLive, setIsLive] = useState(false);
  const [streamDestinations, setStreamDestinations] = useState([]);
  const [streamDuration, setStreamDuration] = useState(0);

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
  const screenVideoRef = useRef(null);
  const screenCanvasRef = useRef(null);
  const streamWsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamTimerRef = useRef(null);
  const alertIntervalRef = useRef(null);
  const monitorIntervalRef = useRef(null);
  const lastMonitorSpokeRef = useRef(0);
  const lastFrameHashRef = useRef('');
  const speakingRef = useRef(false);
  const autoListenRef = useRef(autoListen);
  const statusRef = useRef(status);

  // Keep refs in sync
  useEffect(() => { autoListenRef.current = autoListen; }, [autoListen]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Health check + trigger proactive scan on page load ──
  useEffect(() => {
    fetch(`${API_URL}/health`).then(r => {
      setIsConnected(r.ok);
      if (r.ok) {
        setDisplayText('Command Center online. Ready.');
        // Run proactive AI check on fresh load
        fetch(`${API_URL}/api/proactive/check`, { method: 'POST' })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.detectedIssues?.length > 0 || data?.suggestions?.length > 0) {
              const issueCount = data.detectedIssues?.length || 0;
              const sugCount = data.suggestions?.length || 0;
              const summary = `Proactive scan: ${issueCount} issue${issueCount !== 1 ? 's' : ''}, ${sugCount} suggestion${sugCount !== 1 ? 's' : ''} found.`;
              setAlertQueue(prev => [...prev, summary]);
            }
          })
          .catch(() => {}); // Silent fail — not critical
      }
    }).catch(() => setIsConnected(false));
  }, []);

  // ── Speech Recognition Setup (mobile-friendly) ──
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const recognition = new SpeechRecognition();
    // Mobile: use single-shot mode (continuous is broken on mobile Chrome)
    // Desktop: use continuous mode
    recognition.continuous = !isMobile;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Track restart attempts to avoid rapid loops
    let restartCount = 0;
    let lastRestartTime = 0;

    recognition.onresult = (event) => {
      // Don't process speech while AI is speaking (echo prevention)
      if (speakingRef.current) return;

      // Reset restart counter on successful speech
      restartCount = 0;

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
        handleVoiceInputExtended(newFinal.trim());
      }
    };

    recognition.onend = () => {
      // Auto-restart if we should be listening and not speaking
      if (autoListenRef.current && !speakingRef.current) {
        const now = Date.now();
        // Prevent rapid restart loops (max 3 restarts within 5 seconds)
        if (now - lastRestartTime < 5000) {
          restartCount++;
        } else {
          restartCount = 0;
        }
        lastRestartTime = now;

        if (restartCount > 3) {
          // Too many restarts — wait longer before trying again
          setStatus('listening');
          setTimeout(() => {
            restartCount = 0;
            try { recognition.start(); } catch {}
          }, 3000);
          return;
        }

        // Normal restart — longer delay on mobile
        const delay = isMobile ? 1000 : 300;
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, delay);
      } else {
        setStatus('idle');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        // Normal on mobile — just means silence, will auto-restart via onend
        return;
      }
      if (event.error === 'aborted') return;
      if (event.error === 'not-allowed') {
        setDisplayText('Microphone permission needed. Check browser settings.');
        setStatus('error');
        return;
      }
      console.error('Speech error:', event.error);
    };

    recognitionRef.current = recognition;

    // Auto-start listening
    if (autoListen) {
      // Delay start on mobile to let page fully load
      const startDelay = isMobile ? 1500 : 100;
      setTimeout(() => {
        try { recognition.start(); setStatus('listening'); } catch {}
      }, startDelay);
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

      // Resume listening after speaking — longer delay on mobile
      if (autoListenRef.current) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        setTimeout(() => {
          try { recognitionRef.current?.start(); } catch {}
        }, isMobile ? 1500 : 500);
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

  // ── Screen Share: Start sharing your computer screen ──
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', width: 1920, height: 1080 },
        audio: false,
      });

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        setScreenSharing(true);

        // Detect when user stops sharing
        stream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          setMonitorActive(false);
          clearInterval(monitorIntervalRef.current);
        };
      }
    } catch (err) {
      console.error('Screen share error:', err);
      setDisplayText('Screen share cancelled or not available.');
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenVideoRef.current?.srcObject) {
      screenVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
      screenVideoRef.current.srcObject = null;
    }
    setScreenSharing(false);
    setMonitorActive(false);
    clearInterval(monitorIntervalRef.current);
  }, []);

  // ── Simple frame hash to detect screen changes ──
  const getFrameHash = useCallback((canvas) => {
    const ctx = canvas.getContext('2d');
    // Sample a grid of pixels for a fast hash
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    // Sample every 10000th pixel for speed
    for (let i = 0; i < data.length; i += 40000) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    return String(hash);
  }, []);

  // ── Screen Monitor: Periodic capture → AI analysis ──
  const captureScreen = useCallback(async () => {
    if (!screenVideoRef.current?.srcObject) return;
    if (speakingRef.current || statusRef.current === 'thinking') return;

    // Cooldown: don't speak more than once per MONITOR_COOLDOWN
    if (Date.now() - lastMonitorSpokeRef.current < MONITOR_COOLDOWN) return;

    const canvas = screenCanvasRef.current;
    const video = screenVideoRef.current;
    if (!canvas || !video || !video.videoWidth) return;

    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.min(video.videoHeight, 720);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Check if screen actually changed
    const frameHash = getFrameHash(canvas);
    if (frameHash === lastFrameHashRef.current) return; // No change, skip
    lastFrameHashRef.current = frameHash;

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    setLastCapture(canvas.toDataURL('image/jpeg', 0.2));
    setMonitorCount(prev => prev + 1);

    try {
      const response = await fetch(`${API_URL}/api/vision/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          conversationId,
          voice: voiceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversationId) setConversationId(data.conversationId);
        if (data.detectedTool) setMonitorContext(data.detectedTool);

        // Only speak if AI decided this is worth interrupting for
        if (data.shouldSpeak && data.response) {
          lastMonitorSpokeRef.current = Date.now();
          setLastResponse(data.response);
          setDisplayText(data.response);
          await speakResponse(data.audio, data.response);
        }
      }
    } catch (err) {
      console.error('Monitor capture error:', err);
    }
  }, [conversationId, voiceId, speakResponse, getFrameHash]);

  // ── Toggle screen monitor on/off ──
  const toggleMonitor = useCallback(() => {
    if (monitorActive) {
      setMonitorActive(false);
      clearInterval(monitorIntervalRef.current);
    } else {
      if (!screenSharing) {
        // Start screen share first
        startScreenShare().then(() => {
          setMonitorActive(true);
          monitorIntervalRef.current = setInterval(captureScreen, SCREEN_MONITOR_INTERVAL);
        });
      } else {
        setMonitorActive(true);
        monitorIntervalRef.current = setInterval(captureScreen, SCREEN_MONITOR_INTERVAL);
      }
    }
  }, [monitorActive, screenSharing, startScreenShare, captureScreen]);

  // Cleanup monitor + stream on unmount
  useEffect(() => {
    return () => {
      clearInterval(monitorIntervalRef.current);
      clearInterval(streamTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      streamWsRef.current?.close();
    };
  }, []);

  // ── Load stream destinations on mount ──
  useEffect(() => {
    fetch(`${API_URL}/api/stream/destinations`)
      .then(r => r.ok ? r.json() : { destinations: [] })
      .then(data => setStreamDestinations(data.destinations || []))
      .catch(() => {});
  }, []);

  // ── Go Live: capture glasses camera + mic → stream to RTMP ──
  const goLive = useCallback(async () => {
    if (isLive) return;

    try {
      // Get camera + mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
        audio: true,
      });

      // Tell server to start FFmpeg
      const startRes = await fetch(`${API_URL}/api/stream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        stream.getTracks().forEach(t => t.stop());
        setDisplayText(err.error || 'Failed to start stream.');
        speakResponse(null, err.error || 'Failed to start stream. Check your streaming destinations.');
        return;
      }

      const startData = await startRes.json();

      // Connect WebSocket to send media data
      const wsUrl = API_URL.replace('http', 'ws') + '/ws/stream';
      const ws = new WebSocket(wsUrl);
      streamWsRef.current = ws;

      ws.onopen = () => {
        // Start MediaRecorder to capture and send chunks
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: 2500000,
        });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
        };

        // Send chunks every 1 second for low latency
        recorder.start(1000);

        setIsLive(true);
        setStreamDuration(0);
        streamTimerRef.current = setInterval(() => {
          setStreamDuration(prev => prev + 1);
        }, 1000);

        const destNames = startData.destinations?.join(', ') || 'your channels';
        setDisplayText(`LIVE to ${destNames}`);
        speakResponse(null, `You are now live streaming to ${destNames}.`);
      };

      ws.onerror = () => {
        stream.getTracks().forEach(t => t.stop());
        setDisplayText('Stream connection failed.');
      };

      ws.onclose = () => {
        if (isLive) stopLive();
      };

    } catch (err) {
      console.error('Go live error:', err);
      setDisplayText('Could not access camera for streaming.');
      speakResponse(null, 'Could not access camera. Check permissions.');
    }
  }, [isLive, speakResponse]);

  const stopLive = useCallback(async () => {
    clearInterval(streamTimerRef.current);

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamWsRef.current?.close();

    try {
      await fetch(`${API_URL}/api/stream/stop`, { method: 'POST' });
    } catch {}

    const dur = streamDuration;
    setIsLive(false);
    setStreamDuration(0);

    const mins = Math.floor(dur / 60);
    const secs = dur % 60;
    const durText = mins > 0 ? `${mins} minutes and ${secs} seconds` : `${secs} seconds`;
    setDisplayText(`Stream ended. Duration: ${durText}`);
    speakResponse(null, `Stream ended. You were live for ${durText}.`);
  }, [streamDuration, speakResponse]);

  const toggleDestination = useCallback(async (id, enabled) => {
    try {
      await fetch(`${API_URL}/api/stream/destinations/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setStreamDestinations(prev =>
        prev.map(d => d.id === id ? { ...d, enabled } : d)
      );
    } catch {}
  }, []);

  // ── Telegram Bridge Functions ──
  const sendToTelegram = useCallback(async (channel, message) => {
    setStatus('thinking');
    setDisplayText(`Sending to ${channel}...`);

    try {
      const response = await fetch(`${API_URL}/api/telegram/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          channel,
          conversationId,
          voice: voiceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversationId) setConversationId(data.conversationId);
        setDisplayText(data.response);
        await speakResponse(data.audio, data.response);
      } else {
        const err = await response.json();
        setDisplayText(err.error || 'Failed to send to Telegram.');
        speakResponse(null, err.error || 'Failed to send to Telegram.');
      }
    } catch (err) {
      setDisplayText('Telegram connection failed.');
      speakResponse(null, 'Could not connect to Telegram.');
    }
  }, [conversationId, voiceId, speakResponse]);

  const checkSignals = useCallback(async () => {
    setStatus('thinking');
    setDisplayText('Checking trading signals...');

    try {
      const response = await fetch(`${API_URL}/api/telegram/signals?limit=5`);
      if (response.ok) {
        const data = await response.json();
        if (data.signals?.length > 0) {
          const latest = data.signals[data.signals.length - 1];
          const sig = latest.signal;
          const summary = sig
            ? `Latest signal: ${sig.direction || 'Unknown'} ${sig.instrument || 'Unknown'}${sig.entry ? ` at ${sig.entry}` : ''}. ${data.signals.length} total signals tracked.`
            : `${data.signals.length} signals tracked. Latest: ${latest.text?.substring(0, 100)}`;
          setDisplayText(summary);
          speakResponse(null, summary);
        } else {
          setDisplayText('No signals yet.');
          speakResponse(null, 'No trading signals detected yet.');
        }
      }
    } catch {
      setDisplayText('Could not check signals.');
      speakResponse(null, 'Could not check signals.');
    }
  }, [speakResponse]);

  const checkTelegramUpdates = useCallback(async () => {
    setStatus('thinking');
    setDisplayText('Checking Telegram...');

    try {
      const response = await fetch(`${API_URL}/api/telegram/updates`);
      if (response.ok) {
        const data = await response.json();
        if (data.count > 0) {
          const summaries = data.messages.slice(-3).map(m =>
            `${m.from}: ${m.text?.substring(0, 80)}`
          );
          const summary = `${data.count} new message${data.count > 1 ? 's' : ''}. ${summaries.join('. ')}`;
          setDisplayText(summary);
          speakResponse(null, summary);
        } else {
          setDisplayText('No new messages.');
          speakResponse(null, 'No new Telegram messages.');
        }
      }
    } catch {
      speakResponse(null, 'Could not check Telegram.');
    }
  }, [speakResponse]);

  // ── Voice commands for screen monitoring ──
  // Extend handleVoiceInput to recognize monitor commands
  const handleVoiceInputExtended = useCallback(async (text) => {
    const lower = text.toLowerCase();

    // Telegram commands
    if (lower.includes('tell juno') || lower.includes('message juno') ||
        lower.includes('send to juno') || lower.includes('ask juno')) {
      // Extract the message after the command keyword
      const junoMsg = text.replace(/^.*(tell|message|send to|ask)\s+juno\s*/i, '').trim() || text;
      await sendToTelegram('juno', junoMsg);
      return;
    }

    if (lower.includes('check signals') || lower.includes('any signals') ||
        lower.includes('trading signals') || lower.includes('what signals')) {
      await checkSignals();
      return;
    }

    if (lower.includes('check telegram') || lower.includes('any messages') ||
        lower.includes('telegram updates') || lower.includes('read my messages')) {
      await checkTelegramUpdates();
      return;
    }

    if (lower.startsWith('send to ') || lower.startsWith('message ')) {
      // "send to [channel] [message]" or "message [channel] [message]"
      const parts = text.replace(/^(send to|message)\s+/i, '').split(/\s+/);
      const channel = parts[0]?.toLowerCase();
      const msg = parts.slice(1).join(' ');
      if (channel && msg) {
        await sendToTelegram(channel, msg);
        return;
      }
    }

    // Live streaming commands
    if (lower.includes('go live') || lower.includes('start streaming') ||
        lower.includes('start the stream') || lower.includes('start broadcast')) {
      await goLive();
      return;
    }

    if (lower.includes('stop stream') || lower.includes('stop live') ||
        lower.includes('end stream') || lower.includes('stop broadcast') ||
        lower.includes('end the stream')) {
      await stopLive();
      return;
    }

    // Screen monitoring commands
    if (lower.includes('watch my screen') || lower.includes('monitor my screen') ||
        lower.includes('start monitoring') || lower.includes('screen share')) {
      if (!screenSharing) {
        setDisplayText('Starting screen share...');
        await startScreenShare();
      }
      setMonitorActive(true);
      monitorIntervalRef.current = setInterval(captureScreen, SCREEN_MONITOR_INTERVAL);
      setDisplayText('Screen monitoring active. I\'ll watch and alert you.');
      speakResponse(null, 'Screen monitoring is now active. I\'ll watch your screen and alert you when I see something important.');
      return;
    }

    if (lower.includes('stop monitoring') || lower.includes('stop watching') ||
        lower.includes('stop screen')) {
      setMonitorActive(false);
      clearInterval(monitorIntervalRef.current);
      stopScreenShare();
      setDisplayText('Screen monitoring stopped.');
      speakResponse(null, 'Screen monitoring stopped.');
      return;
    }

    if (lower.includes('what\'s on my screen') || lower.includes('what\'s on screen') ||
        lower.includes('describe my screen') || lower.includes('read my screen')) {
      if (screenSharing) {
        // One-shot screen analysis
        const canvas = screenCanvasRef.current;
        const video = screenVideoRef.current;
        if (canvas && video && video.videoWidth) {
          canvas.width = Math.min(video.videoWidth, 1280);
          canvas.height = Math.min(video.videoHeight, 720);
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

          setStatus('thinking');
          setDisplayText('Reading your screen...');
          try {
            const response = await fetch(`${API_URL}/api/vision`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: imageBase64,
                prompt: text,
                conversationId,
                voice: voiceId,
              }),
            });
            if (response.ok) {
              const data = await response.json();
              if (data.conversationId) setConversationId(data.conversationId);
              setDisplayText(data.response);
              await speakResponse(data.audio, data.response);
            }
          } catch {}
          return;
        }
      }
      setDisplayText('Share your screen first. Say "watch my screen".');
      speakResponse(null, 'Share your screen first. Say watch my screen.');
      return;
    }

    // Fall through to normal voice handling
    await handleVoiceInput(text);
  }, [handleVoiceInput, screenSharing, startScreenShare, stopScreenShare, captureScreen, conversationId, voiceId, speakResponse]);

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

      {/* Hidden video/canvas for camera + screen capture */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <video ref={screenVideoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={screenCanvasRef} className="hidden" />

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
            <label className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Screen Monitor</span>
              <button
                onClick={toggleMonitor}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  monitorActive ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-white/40'
                }`}
              >
                {monitorActive ? `ON (${monitorCount})` : 'OFF'}
              </button>
            </label>
            {monitorContext && (
              <div className="text-xs text-white/30 px-1">
                Detected: <span className="text-purple-400">{monitorContext}</span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={checkAlerts}
                className="flex-1 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium"
              >
                Alerts
              </button>
              <button
                onClick={fetchAndSpeakBriefing}
                className="flex-1 px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium"
              >
                Briefing
              </button>
              <button
                onClick={async () => {
                  setDisplayText('Running proactive scan...');
                  try {
                    const r = await fetch(`${API_URL}/api/proactive/check`, { method: 'POST' });
                    if (r.ok) {
                      const data = await r.json();
                      const issues = data.detectedIssues?.length || 0;
                      const sugs = data.suggestions?.length || 0;
                      const msg = issues > 0 || sugs > 0
                        ? `Found ${issues} issue${issues !== 1 ? 's' : ''} and ${sugs} suggestion${sugs !== 1 ? 's' : ''}.`
                        : 'All clear. No issues detected.';
                      setDisplayText(msg);
                      speakResponse(null, msg);
                    } else {
                      setDisplayText('Scan failed.');
                    }
                  } catch { setDisplayText('Scan failed.'); }
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-medium"
              >
                AI Scan
              </button>
              <button
                onClick={screenSharing ? stopScreenShare : startScreenShare}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${
                  screenSharing ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                }`}
              >
                {screenSharing ? 'Stop Share' : 'Share Screen'}
              </button>
            </div>
            {/* Streaming destinations */}
            {streamDestinations.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <span className="text-white/40 text-xs font-medium">Stream Destinations</span>
                <div className="mt-1 space-y-1">
                  {streamDestinations.map(d => (
                    <label key={d.id} className="flex items-center justify-between">
                      <span className="text-white/50 text-xs">{d.name}</span>
                      <button
                        onClick={() => toggleDestination(d.id, !d.enabled)}
                        disabled={isLive}
                        className={`px-2 py-0.5 rounded text-xs ${
                          d.enabled ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'
                        } ${isLive ? 'opacity-50' : ''}`}
                      >
                        {d.enabled ? 'ON' : 'OFF'}
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            )}
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
          {/* GO LIVE button */}
          <button
            onClick={isLive ? stopLive : goLive}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isLive
                ? 'bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.5)] animate-pulse'
                : 'bg-red-500/20 hover:bg-red-500/40'
            }`}
          >
            {isLive ? (
              <span className="text-white text-xs font-bold">
                {Math.floor(streamDuration / 60)}:{String(streamDuration % 60).padStart(2, '0')}
              </span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
                <circle cx="12" cy="12" r="8" />
              </svg>
            )}
          </button>

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

          {/* Screen monitor button */}
          <button
            onClick={toggleMonitor}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              monitorActive
                ? 'bg-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.3)]'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                 className={monitorActive ? 'text-orange-400' : 'text-white/60'}>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" x2="16" y1="21" y2="21"/>
              <line x1="12" x2="12" y1="17" y2="21"/>
            </svg>
          </button>
        </div>

        {/* Glasses mode indicator + monitor status */}
        <div className="flex flex-col items-center gap-1">
          {isLive && (
            <span className="text-red-500 text-xs font-mono font-bold animate-pulse">
              LIVE {Math.floor(streamDuration / 60)}:{String(streamDuration % 60).padStart(2, '0')}
            </span>
          )}
          {monitorActive && (
            <span className="text-orange-400/60 text-xs font-mono">
              SCREEN MONITOR ACTIVE {monitorContext ? `// ${monitorContext.toUpperCase()}` : ''}
            </span>
          )}
          <span className="text-white/15 text-xs font-mono tracking-widest">
            LIV8 COMMAND CENTER  //  GLASSES MODE
          </span>
        </div>
      </div>
    </div>
  );
}

export default Glasses;
