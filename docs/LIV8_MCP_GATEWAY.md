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
```

OAuth discovery:

```text
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-authorization-server
```

## Security model

The MCP endpoint is private by default. It accepts either:

1. OAuth Authorization Code + PKCE (preferred for interactive MCP clients such as ChatGPT/custom apps), or
2. `Authorization: Bearer <LIV8_MCP_API_KEY>` for trusted server-to-server clients such as a private gateway or OpenClaw deployment that supports custom headers.

OAuth uses an owner-password consent screen, short-lived signed access tokens, refresh tokens, PKCE S256, Client ID Metadata Documents, and a compatibility Dynamic Client Registration endpoint.

The generic MCP gateway intentionally does **not** expose:

- live trade execution or order modification
- outbound email/SMS/DM sending
- deletes
- bulk destructive operations

Those remain behind their dedicated confirmation/approval surfaces.

## Required server environment

```env
# Public origin of the deployed Node/Express API, no trailing slash.
LIV8_MCP_PUBLIC_BASE_URL=https://your-command-center-api.example.com

# Long random values. Never expose these through VITE_ variables.
LIV8_MCP_AUTH_SECRET=
LIV8_MCP_OWNER_PASSWORD=
LIV8_MCP_API_KEY=

# Optional. Comma-separated hostnames allowed to present OAuth Client ID Metadata Documents.
# Leave empty to allow public HTTPS CIMD clients whose metadata validates their redirect URI.
LIV8_MCP_ALLOWED_CLIENT_HOSTS=

# Used by the unified today view.
COMMAND_CENTER_TIMEZONE=America/New_York
```

`LIV8_MCP_AUTH_SECRET` should be a high-entropy random value. `LIV8_MCP_API_KEY` is optional if all clients will use OAuth, but is useful for trusted machine-to-machine clients.

## Advertised tools

The tool list is intentionally normalized around Command Center concepts rather than exposing every downstream API primitive:

### Operator / system

- `command_center_status`
- `command_center_today`
- `system_capabilities`

### Nifty

- `nifty_list_tasks`
- `nifty_create_task`
- `nifty_update_task`
- `nifty_complete_task`

Nifty remains canonical for project/task state. The Command Center does not create a second local task database.

### Affiliate / HighLevel

- `affiliate_search`
- `affiliate_brief`
- `affiliate_add_note`
- `affiliate_create_followup`

Company CRM operations stay staff-scoped. Follow-up creation writes the task to Nifty and can add an internal CRM note, but never sends outbound communication.

### Calendar

- `calendar_today`
- `calendar_upcoming`

### Trading intelligence

- `trading_status`
- `trading_snapshot`
- `trading_performance`

These are read/analysis tools only. No trade execution capability is exported.

### Health data

- `health_snapshot`

Health data is private behind MCP authentication. The tool retrieves connected measurements; it does not diagnose.

## ChatGPT custom app connection

When the ChatGPT account/workspace supports custom MCP apps / Developer Mode:

1. Create a custom app.
2. Use `https://<command-center-api-host>/mcp` as the MCP endpoint.
3. Choose OAuth authentication.
4. Let ChatGPT scan the tools.
5. Complete the LIV8 owner authorization screen.
6. Review app permissions, especially write tools.

OpenAI's custom-app availability and write-action support depend on the ChatGPT plan/workspace and may change during the MCP beta. The server itself remains usable from other MCP clients and from OpenAI API remote-MCP tooling regardless of the ChatGPT UI rollout.

## Machine-to-machine connection

For a client that supports a custom Bearer header:

```http
POST /mcp
Authorization: Bearer <LIV8_MCP_API_KEY>
Content-Type: application/json
```

Initialize example:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {},
    "clientInfo": { "name": "liv8-test", "version": "1.0.0" }
  }
}
```

Then call `tools/list` and `tools/call` using normal MCP JSON-RPC requests.

## Existing LIV8/Juno compatibility

The earlier internal routes remain available:

```text
GET  /api/liv8-connect/mcp/tools
POST /api/liv8-connect/mcp/call
```

They now use the same normalized tool registry as the remote MCP endpoint. Existing legacy tool names are still accepted internally even though they are not advertised to new MCP clients.

## Operational checks

After deployment:

1. `GET /api/liv8-connect/mcp/status` should report the endpoint, protocol, auth configuration, tool counts, and safety flags.
2. Unauthenticated `POST /mcp` should return `401` plus a `WWW-Authenticate` challenge when auth is configured.
3. OAuth discovery endpoints should return absolute URLs using `LIV8_MCP_PUBLIC_BASE_URL`.
4. An authenticated `initialize` request should return server name `liv8-command-center`.
5. `tools/list` should show the normalized tool registry.
6. `command_center_today` should surface live Nifty + calendar data.
7. `affiliate_brief` should remain staff-scoped.
8. No generic trading-execution, outbound-message, or delete tools should appear.

The automated `server/test/liv8-mcp-contract.test.js` test guards route registration and the high-risk-tool exclusion contract.
