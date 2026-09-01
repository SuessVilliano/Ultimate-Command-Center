import {
  appendLedger,
  appendSessionMessage,
  authenticateGateway,
  classifyPermission,
  gatewayStatus,
  getLedger,
  getSession,
  normalizeIdentity,
  updateLedger,
} from '../lib/juno-gateway.js';
import { compileTradingInstruction, saveTradingPlan } from '../lib/juno-trading-engine.js';

function summarizeResult(result) {
  if (!result) return 'No operator result';
  if (result.approvalRequired) return 'Action held for approval';
  if (result.response) return String(result.response).slice(0, 600);
  return 'Completed';
}

function isPaperTradingPlanInstruction(message = '') {
  const t = String(message).toLowerCase();
  if (/\b(live|real money|real account|funded account|kraken live|prop live)\b/.test(t)) return false;
  const planLanguage = /\b(wait for (the )?orb|opening range|trade signals|trading plan|paper|demo|minimum grade|min score|max risk|risk\s*[0-9.]+\s*%|arm paper|disable trading|stop trading)\b/.test(t);
  const actionLanguage = /\b(wait|trade|take|use|set|make|risk|arm|enable|disable|stop|only)\b/.test(t);
  return planLanguage && actionLanguage;
}

export function registerJunoGatewayRoutes(app, operate) {
  app.get('/api/juno/gateway/status', (req, res) => {
    res.json(gatewayStatus());
  });

  app.get('/api/juno/gateway/ledger', (req, res) => {
    const auth = authenticateGateway(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    res.json({ ok: true, entries: getLedger({ limit: req.query.limit, source: req.query.source, status: req.query.status }) });
  });

  app.get('/api/juno/gateway/session/:source/:externalId', (req, res) => {
    const auth = authenticateGateway(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    res.json(getSession({ source: req.params.source, externalId: req.params.externalId, userId: req.query.userId || 'owner' }));
  });

  app.post('/api/juno/gateway/command', async (req, res) => {
    const auth = authenticateGateway(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'message is required' });

    const identity = normalizeIdentity({
      source: req.body?.source || req.get('x-juno-source') || 'command_center',
      externalId: req.body?.externalId || req.body?.chatId || req.body?.sessionId || 'primary',
      userId: req.body?.userId || 'owner',
    });
    const paperPlanInstruction = isPaperTradingPlanInstruction(message);
    const permission = paperPlanInstruction
      ? { level: 'auto_private_write', requiresConfirmation: false, reason: 'Paper/demo trading-plan configuration only; no live order can be placed' }
      : classifyPermission(message);

    const ledger = appendLedger({
      source: identity.source,
      sessionKey: identity.sessionKey,
      actorKey: identity.actorKey,
      request: message,
      permission,
      status: 'received',
      metadata: { transport: req.body?.transport || identity.source },
    });

    appendSessionMessage(identity, { role: 'user', content: message, ledgerId: ledger.id });

    // Deterministic fast path for natural-language PAPER/DEMO plan updates.
    // This never enables live execution. It only edits Juno's persisted paper plan.
    if (paperPlanInstruction) {
      try {
        updateLedger(ledger.id, { status: 'running' });
        const compiled = compileTradingInstruction(message);
        const plan = saveTradingPlan({ ...compiled.patch, mode: 'PAPER' });
        const response = `Paper trading plan updated. Mode: PAPER. ORB wait: ${plan.waitForOrb ? 'on' : 'off'}. Direction: ${plan.direction}. Minimum grade: ${plan.minGrade}. Minimum score: ${plan.minScore}. Risk cap: ${plan.maxRiskPct}%. ${plan.enabled ? 'Paper routing is armed.' : 'Paper routing is not armed yet.'}`;
        const finished = updateLedger(ledger.id, {
          status: 'success',
          tools: [{ name: 'juno.trading.plan', ok: true }],
          resultSummary: response,
          metadata: { transport: req.body?.transport || identity.source, planId: plan.id, mode: 'PAPER' },
        });
        appendSessionMessage(identity, { role: 'assistant', content: response, ledgerId: ledger.id });
        return res.json({
          ok: true,
          actionId: ledger.id,
          identity,
          permission,
          status: 'success',
          executionConfirmed: true,
          result: { response, compiled, plan, liveExecution: false },
          ledger: finished,
        });
      } catch (error) {
        const failed = updateLedger(ledger.id, { status: 'failed', error: error?.message || 'Trading plan update failed' });
        appendSessionMessage(identity, { role: 'assistant', content: `Trading plan update failed: ${error?.message || 'unknown error'}`, ledgerId: ledger.id });
        return res.status(500).json({ ok: false, actionId: ledger.id, error: error?.message || 'Trading plan update failed', ledger: failed });
      }
    }

    if (permission.requiresConfirmation) {
      const held = updateLedger(ledger.id, { status: 'awaiting_confirmation', resultSummary: permission.reason });
      appendSessionMessage(identity, {
        role: 'assistant',
        content: `Confirmation required: ${permission.reason}`,
        ledgerId: ledger.id,
      });
      return res.status(202).json({
        ok: true,
        actionId: ledger.id,
        identity,
        permission,
        status: 'awaiting_confirmation',
        confirmationRequired: true,
        ledger: held,
      });
    }

    try {
      updateLedger(ledger.id, { status: 'running' });
      const result = await operate(message);

      // The current operator safely executes reads, but its write path is still approval-only.
      // Never claim an automatic write succeeded until a concrete action adapter confirms it.
      if (result?.approvalRequired) {
        const pending = updateLedger(ledger.id, {
          status: 'adapter_required',
          tools: result.toolsUsed || [],
          resultSummary: 'Permission allows this class, but no confirmed write adapter executed it.',
        });
        appendSessionMessage(identity, {
          role: 'assistant',
          content: 'This action class is allowed by policy, but the current tool adapter did not execute a write. It has been recorded as adapter_required.',
          ledgerId: ledger.id,
        });
        return res.status(202).json({
          ok: true,
          actionId: ledger.id,
          identity,
          permission,
          status: 'adapter_required',
          executionConfirmed: false,
          operator: result,
          ledger: pending,
        });
      }

      const tools = result?.toolsUsed || [];
      const failedTools = tools.filter(x => x.ok === false);
      const status = failedTools.length ? 'partial' : 'success';
      const finished = updateLedger(ledger.id, {
        status,
        tools,
        resultSummary: summarizeResult(result),
      });
      appendSessionMessage(identity, { role: 'assistant', content: result?.response || 'Completed', ledgerId: ledger.id });

      return res.json({
        ok: true,
        actionId: ledger.id,
        identity,
        permission,
        status,
        executionConfirmed: status === 'success',
        result,
        ledger: finished,
      });
    } catch (error) {
      const failed = updateLedger(ledger.id, { status: 'failed', error: error?.message || 'Gateway execution failed' });
      appendSessionMessage(identity, { role: 'assistant', content: `Execution failed: ${error?.message || 'unknown error'}`, ledgerId: ledger.id });
      return res.status(500).json({ ok: false, actionId: ledger.id, error: error?.message || 'Gateway execution failed', ledger: failed });
    }
  });
}

export default registerJunoGatewayRoutes;
