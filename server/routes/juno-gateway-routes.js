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

function summarizeResult(result) {
  if (!result) return 'No operator result';
  if (result.approvalRequired) return 'Action held for approval';
  if (result.response) return String(result.response).slice(0, 600);
  return 'Completed';
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
    const permission = classifyPermission(message);

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
