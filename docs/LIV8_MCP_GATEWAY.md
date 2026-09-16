# LIV8 Command Center MCP Gateway

LIV8 Command Center exposes one authenticated remote MCP surface so ChatGPT, Claude, OpenClaw, Juno, and other MCP-compatible clients can use the same source-of-truth integrations instead of rebuilding each connection per AI client.

## Endpoint

Production clients connect to:

```text
https://<command-center-api-host>/mcp
```

The MCP endpoint uses Streamable HTTP with JSON responses and the `2025-11-25` MCP protocol handshake. It is stateless at the transport layer.

Human-readable status:

```text
GET /api/liv8-connect/mcp/status
GET /api/mcp/status
```

OAuth discovery:

```text
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-authorization-server
```

## One MCP, not competing MCP endpoints

There is one `/mcp` transport. Workspace tools, Nifty, HighLevel, calendar, Hybrid Journal, health, trading intelligence, and gated live execution are advertised through that same authenticated registry.

## Security model

The MCP endpoint is private by default. It accepts either OAuth Authorization Code + PKCE or a trusted machine-to-machine Bearer API key.

Normal writes require `liv8.write` scope. Real-money trade execution has additional gates:

1. `liv8.write` permission on the MCP connection.
2. `LIV8_MCP_LIVE_TRADING_ENABLED=true` on the server.
3. Optional broker allowlist in `LIV8_MCP_LIVE_TRADING_BROKERS`.
4. Every live call must include `confirmation: "CONFIRM_LIVE_TRADE"`.
5. The downstream Hybrid execution route independently requires the same confirmation before it can submit a live order.
6. Broker/API credentials and account permissions remain downstream; the MCP gateway does not contain broker secrets.

The MCP does **not** expose a raw unrestricted `place_trade`, raw cTrader write primitive, outbound email/SMS/DM sending, contact/task deletion, or bulk destructive operations. cTrader raw MCP access is read-only; writes go through the confirmation-gated live execution path.

`workspace_write` and `trading_live_execute` are intentionally marked destructive in MCP tool annotations so clients can surface appropriate confirmation UX.

## Required server environment

```env
LIV8_MCP_PUBLIC_BASE_URL=https://your-command-center-api.example.com
LIV8_MCP_AUTH_SECRET=
LIV8_MCP_OWNER_PASSWORD=
LIV8_MCP_API_KEY=
LIV8_MCP_ALLOWED_CLIENT_HOSTS=
COMMAND_CENTER_TIMEZONE=America/New_York

# Real-money MCP trading
LIV8_MCP_LIVE_TRADING_ENABLED=true
LIV8_MCP_LIVE_TRADING_BROKERS=kraken,ctrader,hybrid-journal

# Downstream execution gateway
HYBRID_EXECUTION_URL=https://hybridzone-api.onrender.com
HYBRID_EXECUTION_API_KEY=
```

Never expose any of the MCP auth or broker/execution keys through `VITE_` variables.

## Advertised tools

The unified registry exposes the normal Command Center tools, workspace tools, and a dedicated trading-execution lane.

### Operator / system

- `command_center_status`
- `command_center_today`
- `system_capabilities`

### Nifty

- `nifty_list_tasks`
- `nifty_create_task`
- `nifty_update_task`
- `nifty_complete_task`

Nifty remains canonical for project/task state.

### Affiliate / HighLevel

- `affiliate_search`
- `affiliate_brief`
- `affiliate_add_note`
- `affiliate_create_followup`

Company CRM operations stay staff-scoped.

### Calendar

- `calendar_today`
- `calendar_upcoming`

### Trading intelligence

- `trading_status`
- `trading_snapshot`
- `trading_performance`

### Trading execution

- `trading_execution_status` — MCP + Hybrid execution readiness, confirmation phrase and broker allowlist
- `trading_positions` — live or paper positions by broker
- `trading_orders` — live or paper orders by broker
- `trading_order_preview` — preview/validate without placing an order
- `trading_order_paper` — paper/demo execution
- `trading_live_execute` — **real live execution**, double-confirmation gated
- `trading_ctrader_mcp_read` — discover/call read-only cTrader MCP tools

The live execution tool ultimately uses the existing Command Center route:

```text
POST /api/trading/hybrid-journal/order-execute
```

That route already supports the Hybrid execution gateway/Kraken path and the Hybrid Journal `place_trade` path for other supported broker adapters. It requires `CONFIRM_LIVE_TRADE` independently of the MCP layer.

### Health data

- `health_snapshot`

### Allow-listed workspace

- `workspace_status`
- `workspace_list`
- `workspace_search`
- `workspace_read`
- `workspace_stat`
- `workspace_write`
- `workspace_mkdir`

Workspace reads/writes remain constrained by the existing root allow-list and local write toggle.

## Recommended live-trade sequence

An MCP client should not jump directly from an idea to execution. The intended workflow is:

```text
trading_execution_status
        ↓
trading_order_preview
        ↓
user reviews broker / account / symbol / side / size / price / stops
        ↓
trading_live_execute + confirmation="CONFIRM_LIVE_TRADE"
        ↓
trading_orders / trading_positions
        ↓
Hybrid Journal sync + reporting
```

This supports real trading while keeping the final capital-moving action explicit.

## cTrader / MCP trader connections

Use `trading_ctrader_mcp_read` with `listTools:true` to discover a configured cTrader connection's MCP tools. Read-only tools can then be called through the same MCP surface. Write-capable cTrader actions are intentionally rejected on the raw proxy and must flow through `trading_live_execute` so confirmation, broker/account rules, and auditing stay centralized.

## ChatGPT custom app connection

When the ChatGPT account/workspace supports custom MCP apps / Developer Mode:

1. Create a custom app.
2. Use `https://<command-center-api-host>/mcp` as the MCP endpoint.
3. Choose OAuth authentication.
4. Let ChatGPT scan the tools.
5. Complete the LIV8 owner authorization screen.
6. Grant `liv8.write` only when you want the client to be able to perform writes/live trading.
7. Review every real trade before providing the live confirmation phrase.

The same server can also be used from OpenAI API remote-MCP tooling, Claude, OpenClaw, or other compatible clients.

## Machine-to-machine connection

```http
POST /mcp
Authorization: Bearer <LIV8_MCP_API_KEY>
Content-Type: application/json
```

Initialize, then call `tools/list` and `tools/call` using normal MCP JSON-RPC requests.

## Existing LIV8/Juno compatibility

The earlier internal routes remain available:

```text
GET  /api/liv8-connect/mcp/tools
POST /api/liv8-connect/mcp/call
```

They use the same unified tool registry.

## Operational checks

After deployment:

1. `/api/liv8-connect/mcp/status` reports the MCP endpoint and auth readiness.
2. `/api/mcp/status` reports the unified extension set and whether live MCP trading is armed.
3. Unauthenticated `/mcp` returns `401` when MCP auth is configured.
4. `tools/list` includes `trading_execution_status`, preview, paper, live execute, positions/orders, and cTrader read tools.
5. `trading_live_execute` is marked destructive and requires the exact confirmation enum.
6. With live trading disabled, `trading_live_execute` returns 403 before reaching the broker.
7. With live trading enabled but a missing/invalid confirmation, execution is rejected.
8. With a broker allowlist configured, non-allowlisted brokers are rejected.
9. The downstream execution gateway must still independently accept the live request.
10. `trading_orders` and `trading_positions` should confirm the resulting broker state after an accepted order.

The automated `server/test/liv8-mcp-contract.test.js` test guards the unified tool contract and live-execution confirmation schema.