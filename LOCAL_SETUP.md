# Run LIV8 Command Center locally (free, around-the-clock)

This is the recommended way to run the Command Center: on **your own computer**, so the
AI uses **free local/login engines** (no API credits) and the worker can prep drafts
**24/7** while you stay off the screen.

## 1. One-time setup

```bash
# Install app + server dependencies
npm install
cd server && npm install && cd ..

# Copy env templates and fill in Freshdesk (so the worker can read tickets)
cp .env.example .env
cp server/.env.example server/.env
```

In `server/.env`, the important bits for going credit-free:

```bash
AI_PROVIDER=ollama          # free local engine — the default
WORKER_ENABLED=true         # around-the-clock drafting
WORKER_INTERVAL_MINUTES=10
FRESHDESK_DOMAIN=yourdomain # so the worker can fetch your tickets
FRESHDESK_API_KEY=...
FRESHDESK_AGENT_ID=...       # optional: only your tickets
```

## 2. Pick a free AI engine (choose one in Settings → AI Engine)

You can toggle these any time from the **AI Settings** panel; the free local one is default.

| Engine | What it uses | Setup |
| --- | --- | --- |
| **Ollama** (default) | Local models on your machine | Install from [ollama.com](https://ollama.com), then `ollama pull llama3.1` |
| **Claude subscription** | Your logged-in `claude` CLI | Install Claude Code CLI and sign in — no API key |
| **Gemini CLI** | Your Google login | Install the `gemini` CLI and sign in — free tier |

Each engine has a **Test connection** button in Settings so you can confirm it's reachable
before making it active. If the active engine ever fails, the app automatically falls back
to the next available free engine.

## 3. Start everything

```bash
npm run start:all     # runs the web app + backend together
```

- App: http://localhost:5173 (or the Vite port shown)
- API: http://localhost:3005

Leave it running and the **continuous worker** will fetch tickets, analyze them, and prepare
draft replies on the interval you set — **it never sends anything**. Open the **Tickets** page
to see the **Smart Queue** (New · Recent · Ready-to-copy · Needs-you) and copy a draft with one click.

## 4. Talk to it (focus mode)

Open the LIV8 Commander chat (text or voice) and say things like:

- "let's focus on GHL tickets"
- "what's urgent right now?"
- "walk me through the new ones"
- "exit focus"

In focus mode the AI is grounded in that slice of your command center — real ticket data and
the drafts it already prepared — so it can summarize and work resolutions with you, then point
you to the ready-to-copy draft.
