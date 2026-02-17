/**
 * Application Configuration
 *
 * Uses environment variables when deployed, falls back to localhost for development
 */

// API Server URL
// VITE_API_URL should be a full URL (e.g., https://api.example.com)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

// PersonaPlex Voice AI Server
// Host:port of the PersonaPlex WebSocket server (no protocol prefix)
// Can also be overridden via ?worker_addr= query parameter
export const PERSONAPLEX_SERVER = import.meta.env.VITE_PERSONAPLEX_SERVER || 'localhost:8998';

// Feature flags
export const FEATURES = {
  AGENT_TEAM: true,
  VOICE_COMMANDS: true,
  SCHEDULED_ANALYSIS: true,
  KNOWLEDGE_BASE: true
};

export default {
  API_URL,
  PERSONAPLEX_SERVER,
  FEATURES
};
