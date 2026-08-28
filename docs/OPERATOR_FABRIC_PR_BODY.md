## Operator Fabric

This release turns the Command Center into a local-first operator fabric.

### Core changes
- Creator Control Room embeds/launches Content Engine, Clipped It and OBS Remote.
- Local Workspace MCP gives Juno/Claude-style clients allow-listed Mac file tools with no shell execution.
- Trading Guardian qualifies Hybrid AI alerts against MNQ Bible + QQE + risk/session rules.
- Hybrid AI alert parser understands ENTRY/TP1/TP2/TP3/SL lifecycle messages.
- Juno hierarchy defines executive operator → specialist leads → workers.
- Desktop voice-router placement and env/config docs updated.

### Safety
- Guardian cannot execute trades.
- Existing live-trade confirmation gate remains authoritative.
- Workspace MCP blocks sensitive paths and requires explicit write enablement.
- Raw OBS WebSocket must remain private.

### QA
See `docs/OPERATOR_FABRIC_QA.md`.
