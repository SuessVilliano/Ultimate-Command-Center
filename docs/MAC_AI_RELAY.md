# Mac Mini AI Relay

The deployed Command Center cannot reach `127.0.0.1:11434` on the Mac mini. The relay worker fixes that by making only outbound HTTPS requests from the Mac to the Command Center API. Ollama is never exposed publicly.

## Required Render setting

Set `LIV8_MAC_BRIDGE_TOKEN` on `liv8-command-center-api` to a long random value. `MAC_AI_BRIDGE_URL` may be left blank when using outbound relay mode.

## Run on the Mac mini

From the Ultimate Command Center repository:

```bash
export LIV8_COMMAND_API_URL=https://liv8-command-center-api.onrender.com
export LIV8_MAC_BRIDGE_TOKEN='the-same-value-used-on-render'
npm run mac-ai-worker
```

Keep Ollama running and install the expected models:

```bash
ollama pull qwen3:8b
ollama pull gemma3:4b
```

## Verification

Open `https://liv8-command-center-api.onrender.com/api/ai/mac-relay/status`. `connected` should be `true` while the worker is running. Then open `/api/ai/local/status`; it should report `ok: true` and `route: outbound-relay`.

All Command Center AI surfaces use the same local AI client: Juno, Agent Team, Team Inbox, Voice Router, floating Commander, and background agent jobs.
