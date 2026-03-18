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
