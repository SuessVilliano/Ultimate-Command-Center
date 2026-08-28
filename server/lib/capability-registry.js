/**
 * LIV8 Command Center capability registry.
 * This is the machine-readable operating map shared by Juno and specialist agents.
 * Keep it factual: a capability may be described as configured/available only when
 * the corresponding runtime integration exists. External writes remain gated.
 */

export const SOURCE_OF_TRUTH = {
  command_center: 'Primary operator UI and orchestration surface. It should reference source systems rather than duplicate them.',
  nifty: 'Canonical project, task, and team-conversation system.',
  hybrid_journal: 'Canonical trading system for trades, signals, sessions, plans, performance, broker data, QQE and market-cause intelligence.',
  apple_health: 'Canonical broad personal-health/activity data source when ingested from HealthKit.',
  oura: 'Recovery, sleep, readiness, activity and wearable-derived health source; may also write selected data into Apple Health.',
  supabase: 'Structured cross-system relationship/memory/index layer; use source links instead of blindly duplicating source-system state.',
  google_calendar: 'Time/commitment layer. Calendar is not the canonical task database.',
  github: 'Software, repositories, issues, pull requests and deployment source.',
  google_drive: 'Canonical documents/files source where applicable.',
  gohighlevel: 'CRM/client/affiliate/business operational data when configured.',
};

export const CAPABILITIES = [
  {
    id: 'local_ai',
    domain: 'ai',
    source: 'ollama',
    mode: 'read_write_local',
    jobs: ['general reasoning', 'summarization', 'routing', 'drafting', 'agent collaboration', 'vision when supported'],
    notes: 'Qwen3 8B is the default local brain; Gemma 3 4B is the fast/vision worker. Local AI is preferred to paid cloud models.'
  },
  {
    id: 'nifty_ops',
    domain: 'projects',
    source: 'nifty',
    mode: 'read_write_when_mcp_configured',
    jobs: ['read projects', 'read tasks', 'create/update project work', 'read team chats', 'reply to team chats', 'surface blockers and ownership'],
    approval: 'Do not perform destructive/bulk project changes without explicit user intent.'
  },
  {
    id: 'trading_intelligence',
    domain: 'trading',
    source: 'hybrid_journal',
    mode: 'read_analysis',
    jobs: ['sync trades/signals', 'QQE briefing', 'market-cause/regime analysis', 'performance review', 'broker sync', 'compare current setup with history'],
    rules: ['Never invent signal/price/order data.', 'Hybrid Journal remains canonical.']
  },
  {
    id: 'trade_execution',
    domain: 'trading',
    source: 'hybrid_journal',
    mode: 'confirmation_gated_write',
    jobs: ['dry-run order preview', 'controlled live execution'],
    approval: 'Live trade execution requires explicit review and confirmation. Generic agent/MCP routes must not bypass this gate.'
  },
  {
    id: 'health_os',
    domain: 'health',
    source: 'apple_health+oura+health_os',
    mode: 'read_analysis_plus_manual_logs',
    jobs: ['surface BPM/heart-rate trends', 'HRV', 'sleep', 'readiness', 'activity', 'steps', 'exercise', 'recovery', 'body metrics', 'labs', 'opportunities/trends'],
    rules: ['Do not diagnose.', 'Label inferred stress/recovery scores as estimates.', 'Prefer connected measurements over guesses.']
  },
  {
    id: 'calendar',
    domain: 'time',
    source: 'google_calendar',
    mode: 'read_and_confirmation_gated_write_when_configured',
    jobs: ['read schedule', 'identify conflicts', 'find availability', 'draft scheduling actions'],
    approval: 'Creating/updating/deleting calendar events requires explicit user intent.'
  },
  {
    id: 'github',
    domain: 'software',
    source: 'github',
    mode: 'read_write_when_authenticated',
    jobs: ['inspect repos', 'debug code', 'create branches', 'edit code', 'open PRs', 'review PRs', 'merge approved work', 'inspect CI'],
    rules: ['Preserve working systems.', 'Prefer branches/PRs for meaningful changes.', 'Do not delete/archive repos blindly.']
  },
  {
    id: 'drive',
    domain: 'documents',
    source: 'google_drive',
    mode: 'read_write_when_authenticated',
    jobs: ['find docs', 'organize files', 'use docs as source context'],
    approval: 'Destructive file operations require explicit user intent.'
  },
  {
    id: 'supabase',
    domain: 'data',
    source: 'supabase',
    mode: 'read_write_when_authenticated',
    jobs: ['query structured data', 'maintain cross-system source links', 'store normalized relationships/memory indexes'],
    rules: ['Do not duplicate canonical Nifty/Hybrid Journal state unnecessarily.']
  },
  {
    id: 'ghl',
    domain: 'crm',
    source: 'gohighlevel',
    mode: 'read_write_when_configured',
    jobs: ['contacts', 'pipelines', 'opportunities', 'calendars', 'workflows', 'business/affiliate operations'],
    approval: 'Outbound messages, workflow enrollment, and material CRM writes require clear user intent.'
  },
  {
    id: 'agent_team',
    domain: 'orchestration',
    source: 'command_center',
    mode: 'delegate_and_coordinate',
    jobs: ['route work to specialist', 'run multi-agent analysis', 'synthesize specialist outputs', 'track proactive findings', 'surface approvals'],
    rules: ['Agents should use tools/data instead of fabricating.', 'A specialist answer is not proof that an external action occurred.']
  }
];

export const AGENT_JOBS = {
  orchestrator: ['understand intent', 'choose tools/sources', 'route specialist work', 'synthesize results', 'surface next action and approvals'],
  'business-analyst': ['strategy', 'KPIs', 'revenue analysis', 'process design', 'prioritization', 'business opportunity analysis'],
  'content-creator': ['copy', 'content plans', 'campaign concepts', 'scripts', 'repurposing', 'brand messaging'],
  'legal-contracts': ['contract analysis', 'risk spotting', 'compliance research support', 'drafting assistance; never claim to be a lawyer'],
  'dev-ops': ['GitHub/code', 'debugging', 'deployment', 'APIs', 'databases', 'integrations', 'automation infrastructure'],
  'highlevel-specialist': ['GHL support/workflows/CRM', 'affiliate operations context', 'pipelines', 'contacts', 'calendars', 'automation'],
  'hybrid-grid': ['trading analysis', 'Hybrid Journal intelligence', 'signals', 'risk/process review', 'market/regime context; never fabricate market data']
};

export function getCapabilityPrompt() {
  const sources = Object.entries(SOURCE_OF_TRUTH)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const capabilities = CAPABILITIES
    .map(c => `- ${c.id} [${c.mode}] — ${c.jobs.join('; ')}${c.approval ? ` | Approval: ${c.approval}` : ''}${c.rules ? ` | Rules: ${c.rules.join(' ')}` : ''}`)
    .join('\n');

  return `COMMAND CENTER OPERATING MAP\n\nSOURCE OF TRUTH\n${sources}\n\nCAPABILITIES\n${capabilities}\n\nTOOL USE POLICY\n- First determine the correct source system.\n- Read real data before making source-dependent claims.\n- If an integration is not configured/reachable, say so and identify the missing connection.\n- Never pretend an action completed unless the tool/system confirms it.\n- Analysis, summaries, drafts and safe reads may be proactive. External/destructive/high-risk writes require explicit user intent; live trading always requires the dedicated confirmation gate.\n- Prefer one clear next action over a long list when the user is operating the Command Center.`;
}
