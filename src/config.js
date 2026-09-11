/**
 * Application Configuration
 *
 * Production must never silently fall back to a localhost API. Localhost is
 * allowed only while the frontend itself is running on localhost/127.0.0.1.
 */

const isBrowser = typeof window !== 'undefined';
const hostname = isBrowser ? window.location.hostname : '';
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

const configuredApiUrl = import.meta.env.VITE_API_URL;
export const API_URL = configuredApiUrl || (isLocalHost ? 'http://localhost:3005' : 'https://liv8-command-center-api.onrender.com');

// Voicebox is a local Mac service. Cloud builds may probe it, but cloud AI/TTS
// must not depend on it. Browser/Edge/server TTS remains the production path.
export const VOICEBOX_URL = import.meta.env.VITE_VOICEBOX_URL || 'http://localhost:8000';

export const FEATURES = {
  AGENT_TEAM: true,
  VOICE_COMMANDS: true,
  SCHEDULED_ANALYSIS: true,
  KNOWLEDGE_BASE: true,
  HIGHEST_SELF: {
    TODAY: true,
    LIFE_MAP: true,
    HEALTH: true,
    TRADING: true,
    FAMILY: true,
    BUSINESS: true,
    GLANCE: true,
  }
};

export default {
  API_URL,
  VOICEBOX_URL,
  FEATURES
};
