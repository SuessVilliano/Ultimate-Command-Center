# Operator Fabric Security Boundaries

- Do not expose raw OBS WebSocket `4455` publicly.
- Do not expose Local Workspace MCP anonymously.
- Prefer Mac Mini localhost/Tailscale/authenticated tunnel for local tools.
- Filesystem access is allow-listed and sensitive paths are blocked.
- No arbitrary shell command tool is part of the workspace MCP.
- Public Render deployment should not be treated as the local Mac bridge.
- Guardian is advisory only; live trade execution remains behind the dedicated confirmation gate.
- External/destructive writes require explicit user intent and tool confirmation.
