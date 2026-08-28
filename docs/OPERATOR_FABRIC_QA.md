# Operator Fabric QA Checklist

Release scope: Creator Control Room, Local Workspace MCP, Trading Guardian, desktop voice-router placement.

## Required automated checks
- production frontend build succeeds
- server boots without syntax/import errors
- MCP initialize/tools list works for `/api/mcp/workspace`
- workspace path traversal and sensitive paths are rejected
- workspace writes are disabled unless explicitly enabled
- Trading Guardian parses all six Hybrid AI alert types
- raw ENTRY alert remains advisory and requires further qualification
- TP/SL alerts are lifecycle events, not fresh entries
- live trading remains outside Guardian and behind existing confirmation gate
- Creator Control Room renders with missing URLs and degrades to setup instructions
- Content Engine remains accessible inside Creator Control Room
- desktop voice router is visible above sidebar layer

## Manual hardware acceptance
- OBS Remote reachable from Mac Mini private endpoint
- OBS websocket remains private (never expose raw 4455)
- Claude/Juno workspace MCP can list/read allowed folder
- write test creates a harmless file inside allowed root
- attempt to read `.env`, `.ssh`, keychain, token/credential-named paths fails
- Clipped It compartment loads deployed/local app
- Hybrid Journal MCP enriches an ENTRY alert when configured

## Production rule
Do not enable local filesystem MCP on the public Render API. Run it on the Mac Mini/private bridge with a strong token and allow-listed roots.
