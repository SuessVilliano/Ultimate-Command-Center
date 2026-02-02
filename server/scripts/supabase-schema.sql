-- LIV8 Command Center - Supabase Schema
-- Run this SQL in your Supabase project's SQL Editor
-- Go to: https://supabase.com/dashboard > Your Project > SQL Editor

-- Settings table (REQUIRED for API key persistence)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent interactions table (for tracking AI agent activity)
CREATE TABLE IF NOT EXISTS agent_interactions (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  context TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table (for chat history persistence)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  messages JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets table (optional - for Freshdesk ticket sync)
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  freshdesk_id BIGINT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status INTEGER NOT NULL,
  priority INTEGER,
  requester_name TEXT,
  requester_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket analysis table (optional - for AI analysis storage)
CREATE TABLE IF NOT EXISTS ticket_analysis (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(freshdesk_id),
  escalation_type TEXT,
  urgency_score INTEGER,
  summary TEXT,
  suggested_response TEXT,
  action_items JSONB,
  ai_provider TEXT DEFAULT 'gemini',
  model_used TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge base table (optional - for learning from resolved tickets)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  resolution TEXT,
  keywords JSONB,
  category TEXT,
  embedding_id TEXT,
  indexed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_agent ON agent_interactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_created ON agent_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_freshdesk ON tickets(freshdesk_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for server-side use with service key)
-- For anon key access, these policies allow full access
CREATE POLICY "Allow all for settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for agent_interactions" ON agent_interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON settings TO anon, authenticated;
GRANT ALL ON agent_interactions TO anon, authenticated;
GRANT ALL ON conversations TO anon, authenticated;
GRANT ALL ON tickets TO anon, authenticated;
GRANT ALL ON ticket_analysis TO anon, authenticated;
GRANT ALL ON knowledge_base TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
