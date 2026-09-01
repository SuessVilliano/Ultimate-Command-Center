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
import { executeAction, getAction, listActions, resolveAction, validateAction } from '../lib/juno-action-registry.js';
import { sendChatMessage } from '../lib/telegram-bridge.js';

function confirmationToken(actionId) {
  return `CONFIRM ${actionId}`;
}

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

  app.get('/api/juno/gateway/actions', (req, res) => {
    const auth = authenticateGateway(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    res.json({ ok: true, actions: listActions() });
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
    const action = resolveAction(message, req.body?.action, req.body?.params);
    const registered = action ? getAction(action.name) : null;
    const paperPlanInstruction = isPaperTradingPlanInstruction(message);
    const permission = paperPlanInstruction
      ? { level: 'auto_private_write', requiresConfirmation: false, reason: 'Paper/demo trading-plan configuration only; no live order can be placed' }
      : registered
      ? { level: registered.policy, requiresConfirmation: ['confirm', 'live_trade_confirm'].includes(registered.policy), reason: `Registered action policy: ${registered.policy}` }
      : classifyPermission(message);

    const ledger = appendLedger({
      source: identity.source,
      sessionKey: identity.sessionKey,
      actorKey: identity.actorKey,
      request: message,
      permission,
      status: 'received',
      metadata: { transport: req.body?.transport || identity.source, action },
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

    if (action) {
      const validation = validateAction(action);
      if (!validation.ok) {
        const failed = updateLedger(ledger.id, { status: 'failed', error: validation.error });
        return res.status(422).json({ ok: false, actionId: ledger.id, status: 'failed', error: validation.error, ledger: failed });
      }
    }

    if (permission.requiresConfirmation) {
      let preview = null;
      if (permission.level === 'live_trade_confirm' && action?.name === 'hybrid.trade.execute') {
        try { preview = await executeAction({ name: 'hybrid.trade.preview', params: action.params }, { identity, ledgerId: ledger.id }); }
        catch (error) {
          const failed = updateLedger(ledger.id, { status: 'failed', error: `Trade preview failed: ${error.message}` });
          return res.status(502).json({ ok: false, actionId: ledger.id, status: 'failed', error: failed.error, ledger: failed });
        }
      }
      const held = updateLedger(ledger.id, { status: 'awaiting_confirmation', resultSummary: permission.reason, tools: preview ? [preview] : [] });
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
        confirmationToken: confirmationToken(ledger.id),
        preview,
        ledger: held,
      });
    }

    try {
      updateLedger(ledger.id, { status: 'running' });
      if (action) {
        const executed = await executeAction(action, { identity, ledgerId: ledger.id });
        const finished = updateLedger(ledger.id, { status: 'success', tools: [executed], resultSummary: `${action.name} executed and confirmed by its adapter` });
        const response = `${action.name} completed successfully.`;
        appendSessionMessage(identity, { role: 'assistant', content: response, ledgerId: ledger.id });
        return res.json({ ok: true, actionId: ledger.id, identity, permission, status: 'success', executionConfirmed: true, action, result: executed.data, ledger: finished });
      }
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

  app.post('/api/juno/gateway/actions/:actionId/confirm', async (req, res) => {
    const auth = authenticateGateway(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const ledger = getLedger({ limit: 200 }).find(row => row.id === req.params.actionId);
    if (!ledger) return res.status(404).json({ error: 'Action not found' });
    if (ledger.status !== 'awaiting_confirmation') return res.status(409).json({ error: `Action is ${ledger.status}, not awaiting_confirmation` });
    if (req.body?.confirmation !== confirmationToken(ledger.id)) return res.status(400).json({ error: `Exact confirmation required: ${confirmationToken(ledger.id)}` });
    const action = ledger.metadata?.action;
    const validation = validateAction(action);
    if (!validation.ok) return res.status(422).json({ error: validation.error });
    try {
      updateLedger(ledger.id, { status: 'running', metadata: { ...ledger.metadata, confirmedAt: new Date().toISOString(), confirmedBy: req.body?.userId || 'owner' } });
      const executed = await executeAction(action, { identity: { actorKey: ledger.actorKey, sessionKey: ledger.sessionKey }, ledgerId: ledger.id, confirmed: true });
      const finished = updateLedger(ledger.id, { status: 'confirmed', tools: [...(ledger.tools || []), executed], resultSummary: `${action.name} executed after exact confirmation` });
      return res.json({ ok: true, actionId: ledger.id, status: 'confirmed', executionConfirmed: true, action, result: executed.data, ledger: finished });
    } catch (error) {
      const failed = updateLedger(ledger.id, { status: 'failed', error: error?.message || 'Confirmed action failed' });
      return res.status(502).json({ ok: false, actionId: ledger.id, status: 'failed', error: failed.error, ledger: failed });
    }
  });

  app.post('/api/juno/gateway/telegram/webhook', async (req, res) => {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    const supplied = req.get('x-telegram-bot-api-secret-token');
    if (!expected || supplied !== expected) return res.status(expected ? 403 : 503).json({ error: expected ? 'Invalid Telegram webhook secret' : 'TELEGRAM_WEBHOOK_SECRET is not configured' });
    const message = req.body?.message || req.body?.channel_post;
    if (!message?.text || !message?.chat?.id) return res.json({ ok: true, ignored: true });
    const chatId = String(message.chat.id);
    const allowed = String(process.env.TELEGRAM_ALLOWED_CHAT_IDS || process.env.TELEGRAM_JUNO_CHAT_ID || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!allowed.includes(chatId)) return res.status(403).json({ error: 'Telegram chat is not authorized' });
    try {
      const confirmation = message.text.trim().match(/^CONFIRM\s+([0-9a-f-]{36})$/i);
      const target = confirmation
        ? `/api/juno/gateway/actions/${confirmation[1]}/confirm`
        : '/api/juno/gateway/command';
      const requestBody = confirmation
        ? { confirmation: `CONFIRM ${confirmation[1]}`, userId: 'owner' }
        : { source: 'telegram', transport: 'telegram_webhook', externalId: chatId, userId: 'owner', message: message.text };
      const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3005}${target}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.JUNO_GATEWAY_KEY || ''}` },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000),
      });
      const payload = await response.json().catch(() => ({}));
      const reply = payload.confirmationRequired
        ? `Confirmation required.\n\nPreview: ${JSON.stringify(payload.preview?.data || payload.preview || {}).slice(0, 2500)}\n\nConfirm exactly with: ${payload.confirmationToken}`
        : payload.result?.response || payload.result?.text || payload.result?.message || (payload.executionConfirmed ? `${payload.action?.name || 'Action'} completed.` : payload.error || 'Juno could not complete that request.');
      await sendChatMessage(chatId, reply);
      return res.status(response.ok ? 200 : response.status).json({ ok: response.ok, actionId: payload.actionId, status: payload.status });
    } catch (error) {
      return res.status(502).json({ ok: false, error: error?.message || 'Telegram gateway failed' });
    }
  });
}

export default registerJunoGatewayRoutes;
