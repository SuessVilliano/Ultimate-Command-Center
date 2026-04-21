/**
 * Application Configuration
 *
 * Uses environment variables when deployed, falls back to localhost for development
 */

// API Server URL
// VITE_API_URL should be a full URL (e.g., https://api.example.com)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

// Voicebox Voice Cloning & TTS Server
// Local-first voice cloning studio (https://github.com/SuessVilliano/voicebox)
// Runs on port 8000 in production, 17493 in dev mode
export const VOICEBOX_URL = import.meta.env.VITE_VOICEBOX_URL || 'http://localhost:8000';

// Returns headers to authenticate privileged backend calls. The admin token is
// stored in localStorage (set via the Admin Panel) and sent as X-Admin-Token.
// Returns an empty object when no token is configured so callers can spread
// the result unconditionally.
export function adminAuthHeaders() {
  try {
    const token = localStorage.getItem('liv8_admin_token');
    return token ? { 'X-Admin-Token': token } : {};
  } catch {
    return {};
  }
}

// Feature flags
export const FEATURES = {
  AGENT_TEAM: true,
  VOICE_COMMANDS: true,
  SCHEDULED_ANALYSIS: true,
  KNOWLEDGE_BASE: true
};

export default {
  API_URL,
  VOICEBOX_URL,
  FEATURES
};
