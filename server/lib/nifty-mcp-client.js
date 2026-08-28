const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

function parseSse(text) {
  const events = text.split(/\n\n+/);
  for (const event of events) {
    const dataLines = event
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim());
    if (!dataLines.length) continue;
    const payload = dataLines.join('\n');
    if (payload === '[DONE]') continue;
    try {
      return JSON.parse(payload);
    } catch {}
  }
  throw new Error('Nifty MCP returned an unreadable SSE response');
}

export class NiftyMcpClient {
  constructor() {
    this.sessionId = null;
    this.initialized = false;
    this.requestId = 1;
    this.cachedTools = null;
  }

  get configured() {
    return Boolean(process.env.NIFTY_MCP_URL && process.env.NIFTY_MCP_TOKEN);
  }

  get url() {
    return process.env.NIFTY_MCP_URL;
  }

  get token() {
    return process.env.NIFTY_MCP_TOKEN;
  }

  async request(method, params = {}) {
    if (!this.configured) {
      throw new Error('NIFTY_MCP_URL and NIFTY_MCP_TOKEN must be configured');
    }

    const id = this.requestId++;
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {})
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Nifty MCP ${method} failed: ${response.status} ${body}`);
    }

    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) this.sessionId = sessionId;

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    const payload = contentType.includes('text/event-stream') ? parseSse(raw) : JSON.parse(raw || '{}');

    if (payload.error) {
      throw new Error(payload.error.message || `Nifty MCP ${method} returned an error`);
    }
    return payload.result;
  }

  async initialize() {
    if (this.initialized) return;
    await this.request('initialize', {
      protocolVersion: process.env.NIFTY_MCP_PROTOCOL_VERSION || DEFAULT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'liv8-ultimate-command-center',
        version: '1.0.0'
      }
    });

    // MCP initialized notification does not expect a response.
    await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {})
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })
    });

    this.initialized = true;
  }

  async listTools({ refresh = false } = {}) {
    await this.initialize();
    if (this.cachedTools && !refresh) return this.cachedTools;
    const result = await this.request('tools/list', {});
    this.cachedTools = result?.tools || [];
    return this.cachedTools;
  }

  async callTool(name, args = {}) {
    await this.initialize();
    return this.request('tools/call', { name, arguments: args });
  }

  async findTool(matcher) {
    const tools = await this.listTools();
    if (typeof matcher === 'string') {
      return tools.find(tool => tool.name === matcher) || null;
    }
    return tools.find(matcher) || null;
  }

  status() {
    return {
      configured: this.configured,
      initialized: this.initialized,
      hasSession: Boolean(this.sessionId),
      urlConfigured: Boolean(process.env.NIFTY_MCP_URL),
      tokenConfigured: Boolean(process.env.NIFTY_MCP_TOKEN)
    };
  }
}

export const niftyMcp = new NiftyMcpClient();
export default niftyMcp;
