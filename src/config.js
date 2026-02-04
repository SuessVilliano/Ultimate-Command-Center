/**
 * Application Configuration
 *
 * Uses environment variables when deployed, falls back to localhost for development
 */

// API Server URL
// VITE_API_URL should be a full URL (e.g., https://api.example.com)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

// Feature flags
export const FEATURES = {
  AGENT_TEAM: true,
  VOICE_COMMANDS: true,
  SCHEDULED_ANALYSIS: true,
  KNOWLEDGE_BASE: true
};

export default {
  API_URL,
  FEATURES
};
