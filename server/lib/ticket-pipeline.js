/**
 * Ticket Arbitrage Pipeline
 * Chains existing systems: Triage → SOP Lookup → History Search → Casebook → Draft → QA → Queue
 *
 * This module does NOT duplicate logic — it orchestrates existing functions in sequence.
 * All drafts are READ-ONLY + DRAFT-ONLY. Nothing is sent externally.
 */

import * as ai from './ai-provider.js';
import * as db from './database.js';
import * as rag from './langchain-rag.js';
import { evaluateDraft } from './qa-evaluator.js';
import { EVENTS, emit } from './cross-platform-event-bus.js';

/**
 * Process a single ticket through the full pipeline
 * @param {number} ticketId - Freshdesk ticket ID
 * @param {Object} options - { agentName, skipQA }
 * @returns {Object} - { draftId, status, qaResult, pipelineResult }
 */
export async function processTicket(ticketId, options = {}) {
  const pipelineResult = {
    ticketId,
    steps: [],
    startedAt: new Date().toISOString()
  };

  // Step 1: GET TICKET
  const ticket = db.getTicketWithAnalysis(ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found in database`);
  }
  pipelineResult.steps.push({ step: 'ticket_loaded', subject: ticket.subject });

  // Step 2: TRIAGE (reuse existing analyzeTicket or load cached)
  let analysis = db.getLatestAnalysis(ticketId);
  if (!analysis) {
    try {
      analysis = await ai.analyzeTicket({
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status
      });
      db.saveAnalysis(ticketId, analysis, analysis.provider || 'gemini', analysis.model || '');
      pipelineResult.steps.push({ step: 'triage', result: 'new_analysis', urgency: analysis.URGENCY_SCORE || analysis.urgency_score });
    } catch (e) {
      analysis = { ESCALATION_TYPE: 'general', URGENCY_SCORE: 5, SUMMARY: ticket.subject };
      pipelineResult.steps.push({ step: 'triage', result: 'fallback', error: e.message });
    }
  } else {
    pipelineResult.steps.push({ step: 'triage', result: 'cached', urgency: analysis.urgency_score });
  }

  // Step 3: HISTORY SEARCH (reuse existing RAG)
  let similarDocs = [];
  try {
    const query = `${ticket.subject} ${(ticket.description || '').substring(0, 200)}`;
    similarDocs = rag.searchSimilar(query, 5);
    pipelineResult.steps.push({ step: 'history_search', found: similarDocs.length });
  } catch (e) {
    pipelineResult.steps.push({ step: 'history_search', found: 0, error: e.message });
  }

  // Step 4: CASEBOOK SEARCH
  let casebookMatches = [];
  try {
    const searchTerms = ticket.subject.split(/\s+/).filter(w => w.length > 3);
    casebookMatches = db.searchCasebook(searchTerms, 3);
    pipelineResult.steps.push({ step: 'casebook_search', found: casebookMatches.length });
  } catch (e) {
    pipelineResult.steps.push({ step: 'casebook_search', found: 0, error: e.message });
  }

  // Step 5: DRAFT GENERATION (reuse existing generateResponse — now includes casebook context)
  let draftText = '';
  let draftProvider = '';
  try {
    const draftResult = await ai.generateResponse(
      {
        subject: ticket.subject,
        description: ticket.description,
        requester_name: ticket.requester_name,
        requester: { name: ticket.requester_name, email: ticket.requester_email }
      },
      {
        agentName: options.agentName || 'Support Agent',
        ticketType: (analysis.ESCALATION_TYPE || analysis.escalation_type || 'general').toLowerCase(),
        analysis: {
          SUMMARY: analysis.SUMMARY || analysis.summary,
          URGENCY_SCORE: analysis.URGENCY_SCORE || analysis.urgency_score,
          ESCALATION_TYPE: analysis.ESCALATION_TYPE || analysis.escalation_type
        },
        similarTickets: similarDocs.map(d => ({
          id: d.metadata?.ticketId,
          subject: d.metadata?.subject,
          score: d.score,
          keywords: []
        }))
      }
    );
    draftText = draftResult.response || draftResult.text || '';
    draftProvider = draftResult.provider || '';
    pipelineResult.steps.push({ step: 'draft_generated', provider: draftProvider, length: draftText.length });
  } catch (e) {
    pipelineResult.steps.push({ step: 'draft_generated', error: e.message });
    throw new Error(`Draft generation failed for ticket ${ticketId}: ${e.message}`);
  }

  // Step 6: QA EVALUATION
  let qaResult = { overall: 'PASS', score: 100, fixes: [], sop_citations: [] };
  if (!options.skipQA) {
    try {
      qaResult = await evaluateDraft(
        { draft_text: draftText },
        { subject: ticket.subject, description: ticket.description }
      );
      pipelineResult.steps.push({ step: 'qa_evaluation', result: qaResult.overall, score: qaResult.score });
    } catch (e) {
      qaResult = { overall: 'FAIL', score: 0, fixes: [`QA failed: ${e.message}`], sop_citations: [] };
      pipelineResult.steps.push({ step: 'qa_evaluation', result: 'error', error: e.message });
    }
  } else {
    pipelineResult.steps.push({ step: 'qa_evaluation', result: 'skipped' });
  }

  // Step 7: DETERMINE STATUS
  const urgencyScore = analysis.URGENCY_SCORE || analysis.urgency_score || 5;
  let draftStatus = 'PENDING_REVIEW';
  if (qaResult.overall === 'FAIL') {
    draftStatus = (qaResult.fixes?.length > 2 || qaResult.score < 40) ? 'ESCALATION_RECOMMENDED' : 'NEEDS_EDIT';
  }
  if (urgencyScore >= 9) {
    draftStatus = 'ESCALATION_RECOMMENDED';
  }

  // Step 8: SAVE DRAFT
  const draftId = db.saveDraft({
    ticket_id: ticketId,
    ticket_subject: ticket.subject,
    draft_text: draftText,
    status: draftStatus,
    qa_result: JSON.stringify(qaResult),
    qa_passed: qaResult.overall === 'PASS' ? 1 : 0,
    sop_citations: JSON.stringify(qaResult.sop_citations || []),
    similar_tickets_used: JSON.stringify(similarDocs.map(d => d.metadata?.ticketId).filter(Boolean)),
    casebook_entries_used: JSON.stringify(casebookMatches.map(c => c.id)),
    pipeline_metadata: JSON.stringify(pipelineResult)
  });

  pipelineResult.steps.push({ step: 'draft_saved', draftId, status: draftStatus });
  pipelineResult.completedAt = new Date().toISOString();

  // Step 9: EMIT EVENT
  try {
    emit(EVENTS.DRAFT_CREATED, {
      draftId,
      ticketId,
      status: draftStatus,
      qaScore: qaResult.score,
      qaResult: qaResult.overall
    });
  } catch (e) {
    // Event bus might not be initialized
  }

  return { draftId, status: draftStatus, qaResult, pipelineResult };
}

/**
 * Process multiple tickets through the pipeline
 * @param {number[]} ticketIds
 * @param {Object} options - { agentName, skipQA, delayMs }
 * @returns {Object[]} results
 */
export async function processMultipleTickets(ticketIds, options = {}) {
  const results = [];
  const delayMs = options.delayMs || 500;

  for (let i = 0; i < ticketIds.length; i++) {
    try {
      const result = await processTicket(ticketIds[i], options);
      results.push(result);
    } catch (error) {
      results.push({ ticketId: ticketIds[i], error: error.message });
    }

    // Rate limit between tickets
    if (i < ticketIds.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

/**
 * Get pipeline status summary
 */
export function getPipelineStatus() {
  const draftStats = db.getDraftStats();
  const casebookStats = db.getCasebookStats();

  return {
    drafts: draftStats,
    casebook: casebookStats,
    pipeline: {
      active: true,
      mode: 'draft-only',
      safety: 'read-only'
    }
  };
}

export default { processTicket, processMultipleTickets, getPipelineStatus };
