import test from 'node:test';
import assert from 'node:assert/strict';
import { registerLiv8ConnectMcpRoutes } from '../routes/liv8-connect-mcp-routes.js';

function fakeApp() {
  const routes = new Map();
  const capture = method => (path, ...handlers) => routes.set(`${method} ${path}`, handlers);
  return { routes, use: capture('USE'), get: capture('GET'), post: capture('POST'), delete: capture('DELETE'), options: capture('OPTIONS') };
}

function fakeResponse() {
  return {
    statusCode: 200, body: undefined, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    type() { return this; }, send(value) { this.body = value; return this; }, end() { return this; },
  };
}

test('LIV8 MCP registers one remote transport plus OAuth discovery routes', () => {
  const app = fakeApp();
  registerLiv8ConnectMcpRoutes(app);
  for (const route of ['POST /mcp','GET /.well-known/oauth-protected-resource','GET /.well-known/oauth-authorization-server','GET /api/liv8-connect/mcp/status','GET /api/liv8-connect/mcp/tools']) {
    assert.ok(app.routes.has(route), `missing ${route}`);
  }
});

test('advertised MCP tools unify operator, workspace, direct execution and federated trading MCP capabilities', () => {
  const app = fakeApp();
  registerLiv8ConnectMcpRoutes(app);
  const handlers = app.routes.get('GET /api/liv8-connect/mcp/tools');
  const res = fakeResponse();
  handlers.at(-1)({}, res);

  const tools = res.body?.tools || [];
  const names = new Set(tools.map(tool => tool.name));
  assert.ok(tools.length >= 32, 'expected broad unified operating + federated trading tool surface');
  for (const expected of [
    'command_center_today','nifty_list_tasks','affiliate_brief','calendar_today','trading_snapshot',
    'trading_execution_status','trading_mcp_capabilities','trading_accounts','trading_account_snapshot','trading_positions','trading_orders',
    'trading_validate','trading_order_preview','trading_order_paper','trading_live_execute','trading_close_position',
    'trading_copy_to_followers','trading_prop_firm_status','trading_ctrader_mcp_read',
    'workspace_search','workspace_read','workspace_write',
  ]) assert.ok(names.has(expected), `missing ${expected}`);

  for (const prohibited of ['execute_trade','place_trade','close_position','copy_to_followers','send_email','send_message','delete_contact','delete_task']) {
    assert.equal(names.has(prohibited), false, `${prohibited} must not be generically exposed`);
  }

  for (const toolName of ['trading_live_execute','trading_close_position','trading_copy_to_followers']) {
    const tool = tools.find(item => item.name === toolName);
    assert.equal(tool?.annotations?.readOnlyHint, false, `${toolName} must be a write`);
    assert.equal(tool?.annotations?.destructiveHint, true, `${toolName} must be marked destructive`);
    assert.deepEqual(tool?.inputSchema?.properties?.confirmation?.enum, ['CONFIRM_LIVE_TRADE']);
  }

  const destructive = tools.filter(tool => tool.annotations?.destructiveHint === true).map(tool => tool.name).sort();
  assert.deepEqual(destructive, ['trading_close_position','trading_copy_to_followers','trading_live_execute','workspace_write'].sort());

  const writes = tools.filter(tool => tool.annotations?.readOnlyHint === false);
  assert.ok(writes.length > 0);
  assert.ok(writes.every(tool => typeof tool.annotations?.destructiveHint === 'boolean'));
});
