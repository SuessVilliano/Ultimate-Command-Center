/**
 * LIV8 Command Center - Live Stream Relay
 *
 * Receives WebMediaRecorder chunks from the browser via WebSocket
 * and pipes them through FFmpeg to multiple RTMP destinations.
 *
 * Architecture:
 *   Browser (MediaRecorder webm/opus) → WebSocket → FFmpeg → RTMP destinations
 */

import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';
import { getSetting, setSetting } from './database.js';

// Active stream state
let activeStream = null;
let ffmpegProcess = null;
let wss = null;

// Default destinations (loaded from env/database)
const defaultDestinations = [];

/**
 * Load streaming destinations from env vars and database
 */
function loadDestinations() {
  const destinations = [];

  // Viloud
  const viloudUrl = process.env.VILOUD_RTMP_URL;
  const viloudKey = process.env.VILOUD_STREAM_KEY;
  if (viloudUrl && viloudKey) {
    destinations.push({
      id: 'viloud',
      name: 'Viloud - Trade Hybrid TV',
      rtmpUrl: viloudUrl,
      streamKey: viloudKey,
      enabled: true,
    });
  }

  // GoKollab
  const gokollabUrl = process.env.GOKOLLAB_RTMP_URL;
  const gokollabKey = process.env.GOKOLLAB_STREAM_KEY;
  if (gokollabUrl && gokollabKey) {
    destinations.push({
      id: 'gokollab',
      name: 'GoKollab Community',
      rtmpUrl: gokollabUrl,
      streamKey: gokollabKey,
      enabled: true,
    });
  }

  // YouTube Live
  const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
  if (youtubeKey) {
    destinations.push({
      id: 'youtube',
      name: 'YouTube Live',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: youtubeKey,
      enabled: false, // Off by default
    });
  }

  // Twitch
  const twitchKey = process.env.TWITCH_STREAM_KEY;
  if (twitchKey) {
    destinations.push({
      id: 'twitch',
      name: 'Twitch',
      rtmpUrl: 'rtmp://live.twitch.tv/app',
      streamKey: twitchKey,
      enabled: false,
    });
  }

  // Facebook Live
  const facebookKey = process.env.FACEBOOK_STREAM_KEY;
  if (facebookKey) {
    destinations.push({
      id: 'facebook',
      name: 'Facebook Live',
      rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp',
      streamKey: facebookKey,
      enabled: false,
    });
  }

  // Custom RTMP destinations (up to 3)
  for (let i = 1; i <= 3; i++) {
    const url = process.env[`CUSTOM_RTMP_URL_${i}`];
    const key = process.env[`CUSTOM_RTMP_KEY_${i}`];
    const name = process.env[`CUSTOM_RTMP_NAME_${i}`];
    if (url && key) {
      destinations.push({
        id: `custom_${i}`,
        name: name || `Custom Stream ${i}`,
        rtmpUrl: url,
        streamKey: key,
        enabled: false,
      });
    }
  }

  // Load enabled state from database
  try {
    const saved = getSetting('stream_destinations', null);
    if (saved) {
      const savedState = JSON.parse(saved);
      for (const dest of destinations) {
        if (savedState[dest.id] !== undefined) {
          dest.enabled = savedState[dest.id];
        }
      }
    }
  } catch {}

  return destinations;
}

/**
 * Get all configured destinations (with keys masked)
 */
export function getDestinations() {
  const destinations = loadDestinations();
  return destinations.map(d => ({
    id: d.id,
    name: d.name,
    rtmpUrl: d.rtmpUrl,
    enabled: d.enabled,
    hasKey: !!d.streamKey,
  }));
}

/**
 * Toggle a destination on/off
 */
export function toggleDestination(id, enabled) {
  const destinations = loadDestinations();
  const dest = destinations.find(d => d.id === id);
  if (!dest) throw new Error(`Destination ${id} not found`);

  // Save to database
  try {
    const saved = getSetting('stream_destinations', '{}');
    const state = JSON.parse(saved);
    state[id] = enabled;
    setSetting('stream_destinations', JSON.stringify(state));
  } catch {}

  return { id, enabled };
}

/**
 * Get current stream status
 */
export function getStreamStatus() {
  return {
    isLive: !!activeStream,
    startedAt: activeStream?.startedAt || null,
    destinations: activeStream?.destinations?.map(d => d.name) || [],
    duration: activeStream ? Math.floor((Date.now() - activeStream.startedAt) / 1000) : 0,
    viewers: activeStream?.viewers || 0,
  };
}

/**
 * Start a live stream to enabled destinations
 * Returns the FFmpeg process — browser sends data via WebSocket
 */
export function startStream(options = {}) {
  if (activeStream) {
    throw new Error('Stream already active. Stop it first.');
  }

  const destinations = loadDestinations().filter(d => d.enabled);
  if (destinations.length === 0) {
    throw new Error('No streaming destinations enabled. Enable at least one in settings.');
  }

  // Build FFmpeg command for multi-destination streaming
  // Input: pipe from WebSocket (webm/opus from MediaRecorder)
  // Output: re-encode to flv and tee to all RTMP destinations
  const ffmpegArgs = [
    '-y',
    // Input from stdin (piped from WebSocket)
    '-i', 'pipe:0',
    // Video: re-encode to H.264 for RTMP compatibility
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', '2500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-pix_fmt', 'yuv420p',
    '-g', '60', // Keyframe every 2s at 30fps
    '-r', '30',
    // Audio: re-encode to AAC
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    // Output format
    '-f', 'flv',
  ];

  if (destinations.length === 1) {
    // Single destination — direct output
    const dest = destinations[0];
    const rtmpFull = `${dest.rtmpUrl}${dest.streamKey}`;
    ffmpegArgs.push(rtmpFull);
  } else {
    // Multiple destinations — use tee muxer
    const teeOutputs = destinations.map(dest => {
      const rtmpFull = `${dest.rtmpUrl}${dest.streamKey}`;
      return `[f=flv]${rtmpFull}`;
    }).join('|');
    ffmpegArgs.splice(-2); // Remove -f flv
    ffmpegArgs.push('-f', 'tee', '-map', '0:v', '-map', '0:a', teeOutputs);
  }

  console.log(`Starting FFmpeg stream to ${destinations.length} destination(s):`, destinations.map(d => d.name).join(', '));

  ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  ffmpegProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    // Only log important FFmpeg messages, not the constant progress output
    if (msg.includes('Error') || msg.includes('error') || msg.includes('Opening') || msg.includes('Output')) {
      console.log('[FFmpeg]', msg.trim().substring(0, 200));
    }
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
    activeStream = null;
    ffmpegProcess = null;
  });

  ffmpegProcess.on('error', (err) => {
    console.error('FFmpeg error:', err);
    activeStream = null;
    ffmpegProcess = null;
  });

  activeStream = {
    startedAt: Date.now(),
    destinations,
    viewers: 0,
    ffmpeg: ffmpegProcess,
  };

  return { success: true, destinations: destinations.map(d => d.name) };
}

/**
 * Stop the current live stream
 */
export function stopStream() {
  if (!activeStream) {
    return { success: true, message: 'No active stream' };
  }

  try {
    // Close FFmpeg stdin to trigger graceful shutdown
    if (ffmpegProcess?.stdin) {
      ffmpegProcess.stdin.end();
    }
    // Kill after 3s if it doesn't exit gracefully
    setTimeout(() => {
      if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
      }
    }, 3000);
  } catch (err) {
    console.error('Error stopping stream:', err);
  }

  const duration = Math.floor((Date.now() - activeStream.startedAt) / 1000);
  activeStream = null;
  ffmpegProcess = null;

  return { success: true, duration };
}

/**
 * Initialize WebSocket server for receiving stream data
 * Attach to an existing HTTP server
 */
export function initStreamWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws/stream' });

  wss.on('connection', (ws) => {
    console.log('Stream WebSocket connected');

    ws.on('message', (data) => {
      // Pipe raw media data to FFmpeg
      if (ffmpegProcess?.stdin?.writable) {
        try {
          ffmpegProcess.stdin.write(data);
        } catch (err) {
          console.error('Error writing to FFmpeg:', err.message);
        }
      }
    });

    ws.on('close', () => {
      console.log('Stream WebSocket disconnected');
      // Don't auto-stop — user might reconnect
    });

    ws.on('error', (err) => {
      console.error('Stream WebSocket error:', err.message);
    });
  });

  console.log('Stream WebSocket server initialized at /ws/stream');
  return wss;
}

export default {
  getDestinations,
  toggleDestination,
  getStreamStatus,
  startStream,
  stopStream,
  initStreamWebSocket,
};
