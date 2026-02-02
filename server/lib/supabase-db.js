/**
 * LIV8 Command Center - Supabase Database Module
 * Cloud-based persistence for production deployments
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;
let isInitialized = false;

/**
 * Initialize Supabase client
 */
export function initSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('Supabase not configured - SUPABASE_URL or SUPABASE_ANON_KEY missing');
    return null;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    isInitialized = true;
    console.log('Supabase client initialized');
    return supabase;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error.message);
    return null;
  }
}

/**
 * Check if Supabase is available and initialized
 */
export function isSupabaseAvailable() {
  return isInitialized && supabase !== null;
}

/**
 * Get Supabase client
 */
export function getSupabase() {
  return supabase;
}

/**
 * Initialize database tables in Supabase
 * Run this once to set up the schema
 */
export async function initSupabaseTables() {
  if (!supabase) return false;

  // Note: In Supabase, you typically create tables via the dashboard or migrations
  // This function checks if tables exist and creates them if needed using RPC or direct SQL
  console.log('Supabase tables should be created via Supabase dashboard or migrations');
  return true;
}

// ============================================
// SETTINGS OPERATIONS (Critical for API keys)
// ============================================

/**
 * Get a setting from Supabase
 */
export async function getSetting(key, defaultValue = null) {
  if (!supabase) return defaultValue;

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - this is fine, return default
        return defaultValue;
      }
      console.error('Supabase getSetting error:', error.message);
      return defaultValue;
    }

    return data?.value ?? defaultValue;
  } catch (error) {
    console.error('Supabase getSetting exception:', error.message);
    return defaultValue;
  }
}

/**
 * Set a setting in Supabase
 */
export async function setSetting(key, value) {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Supabase setSetting error:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Supabase setSetting exception:', error.message);
    return false;
  }
}

/**
 * Get all settings from Supabase
 */
export async function getAllSettings() {
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) {
      console.error('Supabase getAllSettings error:', error.message);
      return {};
    }

    const settings = {};
    for (const row of data || []) {
      settings[row.key] = row.value;
    }
    return settings;
  } catch (error) {
    console.error('Supabase getAllSettings exception:', error.message);
    return {};
  }
}

// ============================================
// AGENT INTERACTIONS
// ============================================

/**
 * Log an agent interaction to Supabase
 */
export async function logAgentInteraction(agentId, type, input, output, context = '', success = true) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('agent_interactions')
      .insert({
        agent_id: agentId,
        interaction_type: type,
        input_data: JSON.stringify(input),
        output_data: JSON.stringify(output),
        context,
        success,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase logAgentInteraction error:', error.message);
      return null;
    }

    return data?.id;
  } catch (error) {
    console.error('Supabase logAgentInteraction exception:', error.message);
    return null;
  }
}

/**
 * Get agent interaction history from Supabase
 */
export async function getAgentHistory(agentId, limit = 50) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('agent_interactions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase getAgentHistory error:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Supabase getAgentHistory exception:', error.message);
    return [];
  }
}

// ============================================
// TICKETS (Optional - for full migration)
// ============================================

/**
 * Upsert a ticket to Supabase
 */
export async function upsertTicket(ticket) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('tickets')
      .upsert({
        freshdesk_id: ticket.id,
        subject: ticket.subject,
        description: ticket.description_text || ticket.description || '',
        status: ticket.status,
        priority: ticket.priority,
        requester_name: ticket.requester?.name || '',
        requester_email: ticket.requester?.email || '',
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        raw_data: JSON.stringify(ticket),
        synced_at: new Date().toISOString()
      }, { onConflict: 'freshdesk_id' });

    if (error) {
      console.error('Supabase upsertTicket error:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Supabase upsertTicket exception:', error.message);
    return null;
  }
}

/**
 * Get tickets by status from Supabase
 */
export async function getTicketsByStatus(statuses = [2, 3]) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .in('status', statuses)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getTicketsByStatus error:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Supabase getTicketsByStatus exception:', error.message);
    return [];
  }
}

// ============================================
// CONVERSATION MEMORY
// ============================================

/**
 * Save conversation to Supabase
 */
export async function saveConversation(conversationId, messages, metadata = {}) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('conversations')
      .upsert({
        id: conversationId,
        messages: JSON.stringify(messages),
        metadata: JSON.stringify(metadata),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.error('Supabase saveConversation error:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Supabase saveConversation exception:', error.message);
    return null;
  }
}

/**
 * Get conversation from Supabase
 */
export async function getConversation(conversationId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Supabase getConversation error:', error.message);
      return null;
    }

    if (data) {
      data.messages = JSON.parse(data.messages || '[]');
      data.metadata = JSON.parse(data.metadata || '{}');
    }

    return data;
  } catch (error) {
    console.error('Supabase getConversation exception:', error.message);
    return null;
  }
}

export default {
  initSupabase,
  isSupabaseAvailable,
  getSupabase,
  initSupabaseTables,
  getSetting,
  setSetting,
  getAllSettings,
  logAgentInteraction,
  getAgentHistory,
  upsertTicket,
  getTicketsByStatus,
  saveConversation,
  getConversation
};
