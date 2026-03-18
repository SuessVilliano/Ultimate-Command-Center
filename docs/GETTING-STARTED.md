# LIV8 Command Center - Getting Started

Quick guide to set up and use the Command Center's full capabilities.

---

## 1. Installation

```bash
# Clone the repo
git clone https://github.com/SuessVilliano/Ultimate-Command-Center.git
cd Ultimate-Command-Center

# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

## 2. Configuration

### Backend (.env)

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your API keys. At minimum, you need ONE AI provider:

| Provider | Key | Cost |
|----------|-----|------|
| Groq | `GROQ_API_KEY` | **Free** (recommended to start) |
| Gemini | `GEMINI_API_KEY` | Free tier available |
| Claude | `ANTHROPIC_API_KEY` | Paid |
| OpenAI | `OPENAI_API_KEY` | Paid |

Get a free Groq key at: https://console.groq.com/keys

### Frontend (.env)

```bash
cp .env.example .env
```

Set `VITE_API_URL=http://localhost:3005` (or your server URL).

## 3. Running

```bash
# Terminal 1: Start the backend
cd server && npm start

# Terminal 2: Start the frontend
npm run dev
```

The backend runs on port 3005, frontend on port 3001.

## 4. First Steps

### Open the Chat
Click the purple/cyan bot icon in the bottom-right corner. The LIV8 Commander will greet you with a daily brief.

### Voice Features
- **Speak to type:** Tap the green mic button, speak your message, and it appears as text
- **AI reads responses:** Toggle the purple speaker icon to hear AI responses aloud
- **PersonaPlex (advanced):** Tap the phone icon for full-duplex voice conversation (requires PersonaPlex server)

### Set Up External API Access

1. Generate your first API key:
```bash
curl -X POST http://localhost:3005/api/bootstrap-key \
  -H "Content-Type: application/json" \
  -d '{"name": "My Admin Key"}'
```

2. Save the key securely - it's only shown once!

3. Test it:
```bash
curl http://localhost:3005/api/v1/status \
  -H "Authorization: Bearer liv8_your_key"
```

See [API.md](./API.md) for full endpoint documentation.

### Set Up MCP (for Claude Desktop / Cursor)

See [MCP.md](./MCP.md) for setup instructions.

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Dashboard │ │ Chat Bot │ │  Voice   │ │ Agents   │  │
│  │          │ │ (Widget) │ │ STT/TTS  │ │  Panel   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────┴────────────────────────────────┐
│                 Backend (Express.js)                      │
│                                                          │
│  ┌─── Internal API ──────────────────────────────────┐  │
│  │ /api/chat, /api/tickets, /api/pipeline, etc.      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─── External API v1 (authenticated) ───────────────┐  │
│  │ /api/v1/tickets, /api/v1/chat, /api/v1/drafts     │  │
│  │ /api/v1/knowledge, /api/v1/memory, /api/v1/webhook │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─── Services Layer ────────────────────────────────┐  │
│  │ AI Provider │ RAG │ Pipeline │ Memory │ Scheduler │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─── Database ──────────────────────────────────────┐  │
│  │ SQLite (local) + Supabase (cloud, optional)       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              MCP Server (stdio transport)                 │
│  Connects Claude Desktop, Cursor, Windsurf, and         │
│  custom AI agents to all Command Center capabilities     │
└─────────────────────────────────────────────────────────┘
```

## 6. Key Features

| Feature | Where |
|---------|-------|
| AI Chat (multi-model) | Chat widget, API, MCP |
| Ticket Triage | Chat, API, MCP, scheduled |
| Draft Response Generation | Pipeline, API, MCP |
| Knowledge Base (RAG) | API, MCP, chat |
| Voice Input (STT) | Chat widget mic button |
| Voice Output (TTS) | Chat widget speaker toggle |
| Memory & Learning | Auto + API + MCP |
| Agent Routing | Chat, API, MCP |
| Integrations | GHL, Freshdesk, Taskade, Nifty, ClickUp |
| Webhooks (inbound) | API v1 |
| Webhooks (outbound) | n8n, TaskMagic |
| Scheduled Automation | Cron-based polling |
| Market Data | Dashboard, API |
| Daily Reports | Email, API |

## 7. Integrations

| Platform | Setup |
|----------|-------|
| **GoHighLevel** | Add `GHL_API_KEY` and `GHL_LOCATION_ID` to `.env` |
| **Freshdesk** | Add `FRESHDESK_DOMAIN`, `FRESHDESK_API_KEY`, `FRESHDESK_AGENT_ID` |
| **Taskade** | Add `TASKADE_API_KEY` |
| **Nifty PM** | OAuth flow via `/api/nifty/auth/url` |
| **Supabase** | Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` |
| **n8n** | Add `N8N_WEBHOOK_URL` |
| **TaskMagic** | Add `TASKMAGIC_WEBHOOK_URL` |
| **Zapier/Make** | Use External API v1 endpoints with your API key |

## 8. Deployment

See [../DEPLOY.md](../DEPLOY.md) for Render deployment instructions.

For the MCP server in production, point Claude Desktop to your deployed server's `mcp-server.js` or wrap it in an SSE transport for remote access.
