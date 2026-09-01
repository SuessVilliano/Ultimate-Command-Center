import test from 'node:test';
import assert from 'node:assert/strict';
import { getAction, resolveAction, validateAction } from '../lib/juno-action-registry.js';

test('resolves automatic private memory writes', () => {
  const action = resolveAction('Juno remember that tomorrow I want to work on Hybrid Copy');
  assert.equal(action.name, 'memory.remember');
  assert.match(action.params.content, /Hybrid Copy/i);
  assert.equal(getAction(action.name).policy, 'auto_private_write');
});

test('resolves an OBS recording command', () => {
  assert.equal(resolveAction('Open OBS and start recording').name, 'obs.record.start');
});

test('live trades require the dedicated confirmation policy', () => {
  const action = resolveAction('Place a live buy order for 3 MNQ contracts');
  assert.equal(action.name, 'hybrid.trade.execute');
  assert.equal(action.params.mode, 'live');
  assert.equal(action.params.quantity, 3);
  assert.equal(getAction(action.name).policy, 'live_trade_confirm');
});

test('paper trades never route to live execution', () => {
  const action = resolveAction('Paper trade buy 2 MNQ contracts');
  assert.equal(action.name, 'hybrid.trade.paper');
  assert.equal(action.params.mode, 'paper');
  assert.equal(getAction(action.name).policy, 'auto_task_write');
});

test('explicit actions validate required parameters', () => {
  const action = resolveAction('create it', 'gmail.send', { to: 'person@example.com' });
  const result = validateAction(action);
  assert.equal(result.ok, false);
  assert.match(result.error, /subject, body/);
});
