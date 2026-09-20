import test from 'node:test';
import assert from 'node:assert/strict';

process.env.HYBRID_EXECUTION_URL = 'https://gateway.test';
process.env.HYBRID_EXECUTION_API_KEY = 'test-execution-key';

const { registerHybridJournalMcpRoutes } = await import('../routes/hybrid-journal-mcp-routes.js');

function fakeApp() {
  const routes = new Map();
  const capture = method => (path, ...handlers) => routes.set(`${method} ${path}`, handlers);
  return { routes, get: capture('GET'), post: capture('POST') };
}

function fakeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

async function invoke(app, method, path, req = {}) {
  const handlers = app.routes.get(`${method} ${path}`);
  assert.ok(handlers, `missing ${method} ${path}`);
  const res = fakeResponse();
  await handlers.at(-1)({ query: {}, body: {}, ...req }, res);
  return res;
}

test('gateway status rejects the SPA HTML catch-all instead of reporting a false connection', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('<!doctype html><title>Hybrid Zone</title>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });

  try {
    const app = fakeApp();
    registerHybridJournalMcpRoutes(app);
    const res = await invoke(app, 'GET', '/api/trading/hybrid-journal/status');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.executionGateway.reachable, false);
    assert.equal(res.body.executionGateway.verified, undefined);
    assert.match(res.body.executionGateway.error, /non-JSON response/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('account snapshot proxy returns typed Kraken paper account data', async () => {
  const originalFetch = global.fetch;
  let requestedUrl = '';
  global.fetch = async url => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      ok: true,
      broker: 'kraken',
      mode: 'paper',
      account: { balances: { USD: { available: 100000, total: 100000 } } },
      orders: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const app = fakeApp();
    registerHybridJournalMcpRoutes(app);
    const res = await invoke(app, 'GET', '/api/trading/execution/account-snapshot', { query: { broker: 'kraken', mode: 'paper' } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.account.balances.USD.available, 100000);
    assert.equal(requestedUrl, 'https://gateway.test/api/execution/account-snapshot?broker=kraken&mode=paper');
  } finally {
    global.fetch = originalFetch;
  }
});
