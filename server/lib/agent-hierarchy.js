export const JUNO_AGENT_HIERARCHY = {
  executive: {
    id: 'juno',
    role: 'Executive Operator',
    owns: ['daily operating picture','routing','prioritization','approvals','cross-domain synthesis'],
  },
  leads: [
    { id: 'trading-lead', role: 'Trading Lead', owns: ['Hybrid Journal','Trading Guardian','QQE','market cause','risk/process review'] },
    { id: 'content-lead', role: 'Content Lead', owns: ['Content Engine','Clipped It','OBS Remote','scripts','repurposing','publishing workflow'] },
    { id: 'devops-lead', role: 'Systems Lead', owns: ['GitHub','deployments','MCP','Mac workspace bridge','integrations'] },
    { id: 'business-lead', role: 'Business Lead', owns: ['Nifty','GHL','affiliate operations','Smart Life Brokers','KPIs'] },
    { id: 'wellbeing-lead', role: 'Wellbeing Lead', owns: ['Health OS','Oura','Apple Health','family','Highest Self'] },
  ],
  policy: {
    safeReads: 'automatic',
    draftsAndAnalysis: 'automatic',
    externalWrites: 'approval-gated',
    destructiveWrites: 'approval-gated',
    liveTrading: 'dedicated confirmation gate only',
    filesystem: 'allow-listed roots only; no arbitrary shell execution',
  },
};

export function hierarchyPrompt() {
  return `JUNO OPERATING HIERARCHY\n- Juno is the executive operator.\n- Route domain work to the appropriate specialist lead.\n- Leads may delegate bounded analysis/drafting/research tasks to workers.\n- Workers return evidence/results to their lead; leads synthesize to Juno.\n- Juno surfaces only what needs the user's attention, decisions, or approvals.\n- Never claim an external action occurred unless a tool confirms it.\n- Safe reads/analysis can be proactive. Writes are approval-gated. Live trading always uses the dedicated confirmation gate.`;
}
