# LIV8 Local Workspace MCP

Local-first MCP endpoint for Juno/Claude-style clients to work with explicitly allowed Mac folders.

## Goal
Give agents useful filesystem capability without exposing the whole Mac or providing arbitrary shell execution.

## Safety model
- Only paths under `LOCAL_WORKSPACE_ROOTS` are accessible.
- No shell/terminal tool is exposed.
- Sensitive names/paths such as `.env`, SSH material, keychains, credentials, secrets and tokens are blocked.
- Writes require `LOCAL_WORKSPACE_WRITE_ENABLED=true`.
- Cloud deployment should normally leave this disabled; it is intended for the Mac Mini/local bridge.

## MCP endpoint
`POST /api/mcp/workspace`

The server implements MCP initialize, tools/list and tools/call.

Tools:
- `workspace_status`
- `list_files`
- `search_files`
- `read_file`
- `stat_file`
- `write_file`
- `make_directory`

## Example local config
```env
LOCAL_WORKSPACE_ROOTS=/Users/liv8/liv8,/Users/liv8/Documents/LIV8
LOCAL_WORKSPACE_WRITE_ENABLED=true
LOCAL_WORKSPACE_TOKEN=generate-a-long-random-secret
```

Keep the endpoint private behind the local machine, Tailscale, or an authenticated tunnel. Never expose it anonymously to the public internet.
