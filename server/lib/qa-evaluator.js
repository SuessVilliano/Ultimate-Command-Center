/**
 * QA Evaluator Agent
 * Evaluates draft responses against SOPs, citation requirements, tone, and completeness.
 * Returns PASS/FAIL with detailed criteria scores and fix suggestions.
 */

import * as ai from './ai-provider.js';
import { getSetting } from './database.js';

// Reuse the SOP context loader from ai-provider (or load directly)
function getSOPContent() {
  try {
    const sopsJson = getSetting('sop_documents', '[]');
    const sops = JSON.parse(sopsJson);
    if (sops.length === 0) return '';
    return sops.map(s => s.content || '').join('\n---\n').substring(0, 4000);
  } catch (e) {
    return '';
  }
}

/**
 * Evaluate a draft response for quality and compliance
 * @param {Object} draft - { draft_text: string }
 * @param {Object} ticket - { subject, description }
 * @returns {Object} - { overall, score, criteria, fixes, sop_citations }
 */
export async function evaluateDraft(draft, ticket) {
  const sopContent = getSOPContent();
  const hasSOP = sopContent.length > 0;

  const prompt = `You are a QA evaluator for customer support ticket responses. Evaluate this draft response against the criteria below.

EVALUATION CRITERIA:
1. SOP_COMPLIANCE: Does the response follow company SOPs? ${hasSOP ? '(SOPs are provided below - check against them)' : '(No SOPs loaded - skip this check, mark as pass)'}
2. NO_HALLUCINATION: Does it only promise things within realistic support capabilities? Does it avoid making up features or timelines?
3. PROPER_TONE: Is it professional, empathetic, and not defensive? Does it acknowledge the customer's frustration?
4. CLEAR_NEXT_STEPS: Does it include specific, actionable steps for the customer?
5. COMPLETENESS: Does it address all parts of the customer's issue?
6. NO_SENSITIVE_DATA: Does it avoid exposing internal systems, credentials, or internal-only information?

TICKET:
Subject: ${ticket.subject || 'N/A'}
Description: ${(ticket.description || ticket.description_text || 'N/A').substring(0, 2000)}

DRAFT RESPONSE TO EVALUATE:
${draft.draft_text}

${hasSOP ? `COMPANY SOPs (check compliance against these):\n${sopContent}` : ''}

Return ONLY valid JSON (no markdown, no backticks):
{
  "overall": "PASS" or "FAIL",
  "score": 0-100,
  "criteria": {
    "sop_compliance": { "pass": true/false, "notes": "brief note" },
    "no_hallucination": { "pass": true/false, "notes": "brief note" },
    "proper_tone": { "pass": true/false, "notes": "brief note" },
    "clear_next_steps": { "pass": true/false, "notes": "brief note" },
    "completeness": { "pass": true/false, "notes": "brief note" },
    "no_sensitive_data": { "pass": true/false, "notes": "brief note" }
  },
  "fixes": ["list of specific fixes if FAIL"],
  "sop_citations": ["SOP sections referenced in the response"]
}`;

  try {
    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1024 }
    );

    // Parse JSON from response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overall: parsed.overall || 'FAIL',
        score: parsed.score || 0,
        criteria: parsed.criteria || {},
        fixes: parsed.fixes || [],
        sop_citations: parsed.sop_citations || [],
        provider: result.provider,
        model: result.model
      };
    }

    return {
      overall: 'FAIL',
      score: 0,
      criteria: {},
      fixes: ['QA evaluator could not parse response'],
      sop_citations: []
    };
  } catch (error) {
    console.error('QA evaluation error:', error.message);
    return {
      overall: 'FAIL',
      score: 0,
      criteria: {},
      fixes: [`QA evaluation failed: ${error.message}`],
      sop_citations: [],
      error: error.message
    };
  }
}

export default { evaluateDraft };
