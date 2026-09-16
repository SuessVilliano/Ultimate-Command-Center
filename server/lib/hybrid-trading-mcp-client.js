const DEFAULT_URL = 'https://hybrid-mcp-server.onrender.com/mcp';
const DEFAULT_PROTOCOL_VERSION = '2025-03-26';

function parseSse(text) {
  for (const event of String(text || '').split(/\n\n+/)) {
    const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!data || data === '[DONE]') continue;
    try { return JSON.parse(data); } catch {}
  }
  throw new Error('Hybrid Trading MCP returned an unreadable response');
}

function compactHeaders(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined && value !== null && String(value).length));
}

export class HybridTradingMcpClient {
  constructor() { this.requestId = 1; }

  get url() { return String(process.env.HYBRID_TRADING_MCP_URL || DEFAULT_URL).trim(); }
  get token() { return String(process.env.HYBRID_TRADING_MCP_TOKEN || '').trim(); }
  get configured() { return Boolean(this.url && this.token); }

  headers({ trade = false } = {}) {
    const executionKey = process.env.HYBRID_EXECUTION_API_KEY || process.env.THZ_API_KEY || '';
    return compactHeaders([
      ['Authorization', this.token ? `Bearer ${this.token}` : ''],
      ['Content-Type', 'application/json'],
      ['Accept', 'application/json, text/event-stream'],
      ['X-Hybrid-Mode', trade ? 'trade' : 'read'],
      ['X-Hybrid-Max-Order-Qty', process.env.HYBRID_TRADING_MCP_MAX_ORDER_QTY || process.env.HYBRID_MAX_ORDER_QTY || '5'],
      ['X-Hybrid-Kill-Switch', process.env.HYBRID_TRADING_MCP_KILL_SWITCH || process.env.HYBRID_KILL_SWITCH || '0'],
      ['X-CrossTrade-Token', process.env.CROSSTRADE_TOKEN || ''],
      ['X-CrossTrade-Account', process.env.CROSSTRADE_ACCOUNT || ''],
      ['X-CrossTrade-Base-Url', process.env.CROSSTRADE_BASE_URL || ''],
      ['X-Hybrid-Zone-Url', process.env.HYBRID_EXECUTION_URL || process.env.HYBRID_ZONE_URL || 'https://hybridzone-v2.onrender.com'],
      ['X-Thz-Api-Key', executionKey],
      ['X-Hybrid-Journal-Url', process.env.HYBRID_JOURNAL_URL || ''],
      ['X-Journal-Api-Key', process.env.JOURNAL_API_KEY || ''],
      ['X-Hybrid-Copy-Webhook-Url', process.env.HYBRID_COPY_WEBHOOK_URL || ''],
      ['X-Hybrid-Funding-Url', process.env.HYBRID_FUNDING_URL || ''],
      ['X-Hybrid-Funding-Api-Key', process.env.HYBRID_FUNDING_API_KEY || ''],
    ]);
  }

  async request(method, params = {}, options = {}) {
    if (!this.configured) throw Object.assign(new Error('HYBRID_TRADING_MCP_URL/HYBRID_TRADING_MCP_TOKEN are not configured.'), { status: 503 });
    const response = await fetch(this.url, {
      method: 'POST',
      headers: this.headers(options),
      body: JSON.stringify({ jsonrpc: '2.0', id: this.requestId++, method, params }),
      signal: AbortSignal.timeout(25000),
    });
    const raw = await response.text();
    if (!response.ok) throw Object.assign(new Error(`Hybrid Trading MCP ${method} failed: ${response.status} ${raw.slice(0, 1000)}`), { status: response.status });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('text/event-stream') ? parseSse(raw) : JSON.parse(raw || '{}');
    if (payload?.error) throw Object.assign(new Error(payload.error.message || 'Hybrid Trading MCP error'), { status: 502, data: payload.error });
    return payload?.result;
  }

  async initialize(options = {}) {
    return this.request('initialize', {
      protocolVersion: process.env.HYBRID_TRADING_MCP_PROTOCOL_VERSION || DEFAULT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'liv8-command-center', version: '1.0.0' },
    }, options);
  }

  async listTools(options = {}) {
    const result = await this.request('tools/list', {}, options);
    return result?.tools || [];
  }

  async callTool(name, args = {}, options = {}) {
    const result = await this.request('tools/call', { name, arguments: args }, options);
    if (result?.isError) {
      const text = result?.content?.find?.(item => item?.type === 'text')?.text || `Hybrid Trading MCP tool failed: ${name}`;
      throw Object.assign(new Error(text), { status: 422, data: result });
    }
    if (result?.structuredContent !== undefined) return result.structuredContent;
    for (const item of Array.isArray(result?.content) ? result.content : []) {
      if (item?.type !== 'text' || !item.text) continue;
      try { return JSON.parse(item.text); } catch { return item.text; }
    }
    return result;
  }

  status() {
    return {
      configured: this.configured,
      urlConfigured: Boolean(this.url),
      tokenConfigured: Boolean(this.token),
      endpoint: this.url || null,
    };
  }
}

export const hybridTradingMcp = new HybridTradingMcpClient();
export default hybridTradingMcp;
