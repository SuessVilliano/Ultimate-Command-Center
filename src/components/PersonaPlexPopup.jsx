import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  X,
  Minus,
  Monitor,
  Phone,
  Wifi,
  WifiOff,
  ChevronDown,
} from 'lucide-react';
import Recorder from 'opus-recorder';

// ── Voice options ──────────────────────────────────────────────
const VOICE_OPTIONS = [
  // Natural female
  { value: 'NATF0.pt', label: 'Natural Female 1' },
  { value: 'NATF1.pt', label: 'Natural Female 2' },
  { value: 'NATF2.pt', label: 'Natural Female 3' },
  { value: 'NATF3.pt', label: 'Natural Female 4' },
  // Natural male
  { value: 'NATM0.pt', label: 'Natural Male 1' },
  { value: 'NATM1.pt', label: 'Natural Male 2' },
  { value: 'NATM2.pt', label: 'Natural Male 3' },
  { value: 'NATM3.pt', label: 'Natural Male 4' },
  // Varied female
  { value: 'VARF0.pt', label: 'Varied Female 1' },
  { value: 'VARF1.pt', label: 'Varied Female 2' },
  { value: 'VARF2.pt', label: 'Varied Female 3' },
  { value: 'VARF3.pt', label: 'Varied Female 4' },
  { value: 'VARF4.pt', label: 'Varied Female 5' },
  // Varied male
  { value: 'VARM0.pt', label: 'Varied Male 1' },
  { value: 'VARM1.pt', label: 'Varied Male 2' },
  { value: 'VARM2.pt', label: 'Varied Male 3' },
  { value: 'VARM3.pt', label: 'Varied Male 4' },
  { value: 'VARM4.pt', label: 'Varied Male 5' },
];

const DEFAULT_SYSTEM_PROMPT =
  `You are an AI assistant integrated into LIV8 Command Center — a voice-enabled operations dashboard for managing projects, support tickets, GitHub repos, AI agent teams, domain portfolios, integrations (Freshdesk, ClickUp, GitHub), news monitoring, and automated workflows. You help users navigate the app, find information, manage tasks, troubleshoot issues, and operate the platform hands-free. Be concise and helpful.`;

// ── Binary protocol helpers ────────────────────────────────────
const MSG_HANDSHAKE = 0x00;
const MSG_AUDIO    = 0x01;
const MSG_TEXT     = 0x02;
const MSG_CONTROL  = 0x03;
const MSG_PING     = 0x06;

const CTRL_START   = 0x00;

function encodeMessage(type, payload) {
  const typeBuf = new Uint8Array([type]);
  if (!payload || payload.length === 0) return typeBuf;
  const merged = new Uint8Array(1 + payload.length);
  merged[0] = type;
  merged.set(payload instanceof Uint8Array ? payload : new Uint8Array(payload), 1);
  return merged;
}

function decodeMessage(data) {
  const arr = new Uint8Array(data);
  return { type: arr[0], payload: arr.slice(1) };
}

// ── Server address resolution ──────────────────────────────────
function getServerAddress() {
  // 1) query param  ?worker_addr=
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('worker_addr');
  if (fromQuery) return fromQuery;

  // 2) env var
  const fromEnv = import.meta.env.VITE_PERSONAPLEX_SERVER;
  if (fromEnv) return fromEnv;

  // 3) fallback
  return 'localhost:8998';
}

// ── Component ──────────────────────────────────────────────────
export default function PersonaPlexPopup() {
  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [screen, setScreen] = useState('setup'); // 'setup' | 'active'

  // Setup form
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [selectedVoice, setSelectedVoice] = useState('NATF0.pt');

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected | connecting | connected | error
  const [transcript, setTranscript] = useState('');
  const [aiLevel, setAiLevel] = useState(0);
  const [userLevel, setUserLevel] = useState(0);
  const [micActive, setMicActive] = useState(false);

  // Refs
  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const decoderWorkerRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio level monitoring ──────────────────────────────────
  const startLevelMonitoring = useCallback((stream) => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setUserLevel(Math.min(avg / 128, 1));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Analyser not critical
    }
  }, []);

  // ── Connect to PersonaPlex ──────────────────────────────────
  const connect = useCallback(async () => {
    setConnectionStatus('connecting');
    setTranscript('');

    const serverAddr = getServerAddress();
    const textSeed = Math.floor(Math.random() * 100000);
    const audioSeed = Math.floor(Math.random() * 100000);

    const wsUrl =
      `wss://${serverAddr}/api/chat?` +
      `text_temperature=0.7&text_topk=25&audio_temperature=0.8&audio_topk=250` +
      `&pad_mult=0&text_seed=${textSeed}&audio_seed=${audioSeed}` +
      `&repetition_penalty_context=64&repetition_penalty=1.0` +
      `&text_prompt=${encodeURIComponent(systemPrompt)}` +
      `&voice_prompt=${encodeURIComponent(selectedVoice)}`;

    try {
      // ── AudioContext + Worklet ─────────────────────────────
      const audioCtx = new AudioContext({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;

      await audioCtx.audioWorklet.addModule('/moshi-processor.js');
      const workletNode = new AudioWorkletNode(audioCtx, 'moshi-processor');
      workletNode.connect(audioCtx.destination);
      workletNodeRef.current = workletNode;

      // Listen for stats from worklet to drive AI visualizer
      workletNode.port.onmessage = (e) => {
        if (e.data && typeof e.data.delay === 'number') {
          // If there's buffered audio, AI is "speaking"
          setAiLevel(e.data.delay > 0.05 ? 0.6 + Math.random() * 0.4 : 0);
        }
      };

      // ── Opus decoder worker ────────────────────────────────
      const decoderWorker = new Worker('/decoderWorker.min.js');
      decoderWorkerRef.current = decoderWorker;

      decoderWorker.onmessage = (e) => {
        // Decoded PCM Float32 buffers → send to worklet
        if (e.data && e.data.length) {
          const pcm = new Float32Array(e.data);
          workletNode.port.postMessage({ type: 'audio', frame: pcm, micDuration: 0 });
        }
      };

      // Init decoder: 24kHz mono
      decoderWorker.postMessage({
        command: 'init',
        decoderSampleRate: 24000,
        outputBufferSampleRate: 24000,
      });

      // ── WebSocket ──────────────────────────────────────────
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setScreen('active');

        // Send start control
        ws.send(encodeMessage(MSG_CONTROL, new Uint8Array([CTRL_START])));

        // Ping keepalive every 5s
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(encodeMessage(MSG_PING, null));
          }
        }, 5000);

        // Start mic
        startMic(ws, audioCtx);
      };

      ws.onmessage = (event) => {
        const { type, payload } = decodeMessage(event.data);

        switch (type) {
          case MSG_AUDIO:
            // Send opus data to decoder worker
            decoderWorker.postMessage(
              { command: 'decode', pages: payload.buffer },
              [payload.buffer]
            );
            break;
          case MSG_TEXT: {
            const text = new TextDecoder().decode(payload);
            setTranscript((prev) => prev + text);
            break;
          }
          case MSG_HANDSHAKE:
          case MSG_CONTROL:
          case MSG_PING:
            // Protocol messages — no UI action needed
            break;
          default:
            break;
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        cleanupPing();
      };
    } catch (err) {
      console.error('PersonaPlex connect error:', err);
      setConnectionStatus('error');
    }
  }, [systemPrompt, selectedVoice, startLevelMonitoring]);

  // ── Mic recording via opus-recorder ─────────────────────────
  const startMic = useCallback(async (ws, audioCtx) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;
      startLevelMonitoring(stream);

      const recorder = new Recorder({
        encoderPath: '/encoderWorker.min.js',
        mediaTrackConstraints: {
          sampleRate: 24000,
          channelCount: 1,
        },
        encoderSampleRate: 24000,
        encoderFrameSize: 960,     // 40ms frames at 24kHz
        encoderApplication: 2048,  // VOIP
        streamPages: true,
        sourceNode: audioCtx.createMediaStreamSource(stream),
      });

      recorder.ondataavailable = (opusData) => {
        if (ws.readyState === WebSocket.OPEN) {
          const chunk = new Uint8Array(opusData);
          ws.send(encodeMessage(MSG_AUDIO, chunk));
        }
      };

      await recorder.start();
      recorderRef.current = recorder;
      setMicActive(true);
    } catch (err) {
      console.error('Mic start error:', err);
      setMicActive(false);
    }
  }, [startLevelMonitoring]);

  // ── Disconnect everything ───────────────────────────────────
  const disconnect = useCallback(() => {
    cleanupPing();

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (recorderRef.current) {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
      recorderRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (decoderWorkerRef.current) {
      decoderWorkerRef.current.terminate();
      decoderWorkerRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'reset' });
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    setMicActive(false);
    setAiLevel(0);
    setUserLevel(0);
    setConnectionStatus('disconnected');
    setScreen('setup');
  }, []);

  const cleanupPing = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  // ── Screen capture ──────────────────────────────────────────
  const captureScreen = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      track.stop();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);

      // Send screenshot info as text so the AI knows a capture happened
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const msg = '[User shared a screenshot of their screen]';
        const encoded = new TextEncoder().encode(msg);
        ws.send(encodeMessage(MSG_TEXT, encoded));
      }
      setTranscript((prev) => prev + '\n[Screenshot captured]\n');
    } catch (err) {
      console.error('Screen capture error:', err);
    }
  }, []);

  // ── Toggle popup ────────────────────────────────────────────
  const toggleOpen = () => {
    if (isOpen && connectionStatus === 'connected') {
      // Don't close while connected — user should end first
      return;
    }
    setIsOpen(!isOpen);
  };

  const handleMinimize = () => {
    setIsOpen(false);
  };

  // ── Status dot color ────────────────────────────────────────
  const statusColor = {
    disconnected: 'bg-gray-400',
    connecting: 'bg-yellow-400 animate-pulse',
    connected: 'bg-green-400',
    error: 'bg-red-400',
  }[connectionStatus];

  const statusLabel = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection Error',
  }[connectionStatus];

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      {/* Floating action button */}
      <button
        onClick={toggleOpen}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-500 scale-0 opacity-0 pointer-events-none'
            : 'bg-emerald-500 hover:bg-emerald-400'
        }`}
        title="AI Voice Assistant"
      >
        <Mic className="w-6 h-6 text-white" />
      </button>

      {/* Popup panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 origin-bottom-right ${
          isOpen
            ? 'scale-100 opacity-100'
            : 'scale-0 opacity-0 pointer-events-none'
        }`}
        style={{ height: 480, background: '#0f1117', border: '1px solid rgba(16, 185, 129, 0.3)' }}
      >
        {/* ── Header ───────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)' }}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
            <span className="text-white text-sm font-semibold">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/70 text-xs mr-1">{statusLabel}</span>
            <button
              onClick={handleMinimize}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Minimize"
            >
              <Minus className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* ── Setup screen ─────────────────────────────── */}
        {screen === 'setup' && (
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
            {/* System prompt */}
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-32 bg-gray-800/80 text-gray-200 text-xs rounded-lg p-2.5 border border-gray-700 focus:border-emerald-500 focus:outline-none resize-none"
                placeholder="Describe the AI's role..."
              />
            </div>

            {/* Voice selector */}
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Voice</label>
              <div className="relative">
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-gray-800/80 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Server info */}
            <div className="text-xs text-gray-500 mt-1">
              Server: <span className="text-gray-400 font-mono">{getServerAddress()}</span>
            </div>

            {/* Connect error */}
            {connectionStatus === 'error' && (
              <div className="text-xs text-red-400 bg-red-400/10 rounded-lg p-2">
                Failed to connect. Check that the PersonaPlex server is running and accessible.
              </div>
            )}

            {/* Start button */}
            <button
              onClick={connect}
              disabled={connectionStatus === 'connecting'}
              className={`mt-auto w-full py-3 rounded-xl text-white font-semibold text-sm transition-all ${
                connectionStatus === 'connecting'
                  ? 'bg-emerald-700 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]'
              }`}
            >
              {connectionStatus === 'connecting' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                'Start Conversation'
              )}
            </button>
          </div>
        )}

        {/* ── Active conversation screen ───────────────── */}
        {screen === 'active' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Audio visualizers */}
            <div className="flex items-center justify-center gap-8 py-4 px-4 shrink-0">
              {/* AI visualizer */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-12 h-12 rounded-full border-2 border-emerald-500 flex items-center justify-center transition-all duration-100"
                  style={{
                    boxShadow: aiLevel > 0.1
                      ? `0 0 ${aiLevel * 20}px rgba(16, 185, 129, ${aiLevel * 0.6})`
                      : 'none',
                    transform: `scale(${1 + aiLevel * 0.15})`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center"
                    style={{ transform: `scale(${0.5 + aiLevel * 0.5})` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-emerald-400"
                      style={{ opacity: 0.4 + aiLevel * 0.6 }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">AI</span>
              </div>

              {/* User visualizer */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-12 h-12 rounded-full border-2 border-blue-500 flex items-center justify-center transition-all duration-100"
                  style={{
                    boxShadow: userLevel > 0.1
                      ? `0 0 ${userLevel * 20}px rgba(59, 130, 246, ${userLevel * 0.6})`
                      : 'none',
                    transform: `scale(${1 + userLevel * 0.15})`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center"
                    style={{ transform: `scale(${0.5 + userLevel * 0.5})` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-blue-400"
                      style={{ opacity: 0.4 + userLevel * 0.6 }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-blue-400 font-medium">You</span>
              </div>
            </div>

            {/* Mic status indicator */}
            <div className="flex items-center justify-center gap-1.5 pb-2 shrink-0">
              {micActive ? (
                <>
                  <Mic className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400">Mic active — speak freely</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] text-red-400">Mic inactive</span>
                </>
              )}
            </div>

            {/* Transcript area */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <div className="text-xs text-gray-400 mb-2 font-medium">Transcript</div>
              <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                {transcript || (
                  <span className="text-gray-500 italic">AI response will appear here...</span>
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            {/* Bottom controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 shrink-0">
              <button
                onClick={captureScreen}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                title="Capture screen"
              >
                <Monitor className="w-3.5 h-3.5" />
                Screen
              </button>

              <button
                onClick={disconnect}
                className="flex items-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-sm text-white font-semibold transition-colors active:scale-95"
              >
                <Phone className="w-4 h-4 rotate-[135deg]" />
                End
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
