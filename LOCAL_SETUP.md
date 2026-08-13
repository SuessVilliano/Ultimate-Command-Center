# Run LIV8 Command Center locally (free, around-the-clock)

This is the recommended way to run the Command Center: on **your own computer**, so the
AI uses **free local/login engines** (no API credits) and the worker can prep drafts
**24/7** while you stay off the screen.

## 0. Get the code onto your computer FIRST

> ⚠️ The most common mistake: running `npm install` from your home folder. The commands
> below only work **inside the project folder**. A desktop *shortcut* to the website is not
> the code — you have to download the repo.

```bash
# Clone the repo and switch to the branch with all the new features:
cd ~
git clone https://github.com/SuessVilliano/Ultimate-Command-Center.git
cd Ultimate-Command-Center
git checkout claude/magical-cerf-1Nd01      # (after it's merged you can use main instead)
```

If you don't have `git`: on the GitHub page click **Code → Download ZIP**, unzip it, then in
Terminal type `cd ` (with a space) and drag the unzipped folder onto the window, press Enter.

You should now be "inside" the project — `pwd` should end in `/Ultimate-Command-Center` and
`ls` should show `package.json`, `server/`, `src/`. Only then continue.

## 1. One-time setup

```bash
# From INSIDE the Ultimate-Command-Center folder:
npm run setup          # installs both the app and the server dependencies

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

### About the "desktop" shortcut

A shortcut/icon you dragged to your desktop just **opens the website** — it does **not** run
the engine. For free AI + around-the-clock drafting you need the app **running on your
machine** (the two commands above / step 3). Once it's running you can absolutely pin a
desktop shortcut to `http://localhost:5173` and use that as your daily icon — just keep the
terminal from step 3 open (or set it up as a background service later).

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

### Connecting each engine (step by step)

**Ollama (recommended default — fully local, no login at all):**
```bash
# 1. Install from https://ollama.com  (Mac/Windows/Linux installer)
# 2. Pull a model:
ollama pull llama3.1            # good general model
# 3. Ollama auto-runs at http://localhost:11434 — that's it.
```
In Settings → AI Engine: toggle **Ollama** on, click **Test connection** (should go green),
then **Set active**.

**Claude (uses your Claude subscription — no API credits):**
```bash
# Install the Claude Code CLI and sign in once:
npm install -g @anthropic-ai/claude-code
claude         # follow the login prompt in the browser
```
Then in Settings: toggle **Claude Subscription** on → **Test connection** → **Set active**.
(The server runs `claude -p "..."` under the hood using your logged-in session.)

**Gemini (uses your Google login — free tier):**
```bash
# Install the Gemini CLI and sign in once:
npm install -g @google/gemini-cli
gemini         # follow the Google login prompt
```
Then in Settings: toggle **Gemini CLI** on → **Test connection** → **Set active**.

> You don't have to put any API keys anywhere for these three. They run as you, on your
> machine. The cloud key boxes (Groq/Gemini/Claude/OpenAI) are only if you'd rather use a
> hosted key instead.

## Always in sync — your AI never starts over

All conversation history, remembered facts, tickets, analyses and drafts live in a local
SQLite database (`server/data/liv8.db`). The chat keeps a **persistent conversation id** in
your browser, so reopening the app or switching tabs continues the *same* conversation with
full context — you don't start from scratch. Because Voice, the dashboard chat, and the
background worker all read/write the same database and the same "Juno" identity, they stay in
sync with each other.

> Keep `server/data/` (don't delete it) to preserve memory. Back it up to keep your history.

## Listening live (no more "every 5 minutes")

The Command Center now **listens** for changes instead of only polling:

1. **Live UI** — the Smart Queue subscribes to a live stream (`/api/stream/events`) and
   updates the instant a ticket changes or a draft becomes ready.
2. **Freshdesk webhooks** — point Freshdesk at the app so new/updated tickets are processed
   immediately:
   - Freshdesk → **Admin → Workflows → Automations → Ticket creation / Ticket updates**
   - Add a rule → action **"Trigger Webhook"** → `POST` to:
     - New tickets: `http://<your-machine>:3005/api/webhooks/freshdesk/created`
     - Updates: `http://<your-machine>:3005/api/webhooks/freshdesk/updated`
   - Body: JSON including the ticket id, e.g. `{ "ticket_id": "{{ticket.id}}" }`
   - To reach your machine from Freshdesk's servers, expose port 3005 with a tunnel
     (e.g. `ngrok http 3005` or a Cloudflare tunnel) and use that URL instead of localhost.
3. **Anything about your account** — any other system (GHL, Twilio, billing) can POST to
   `/api/listen/event` with `{ source, type, data }` and it'll show up live and run through
   the event chains.

The around-the-clock worker still runs as a **safety net** (set `WORKER_INTERVAL_MINUTES`),
but with webhooks configured your queue is essentially real-time.

## 3. Start everything

```bash
npm run start:all     # runs the web app + backend together
```

- App: http://localhost:5173 (or the Vite port shown)
- API: http://localhost:3005

### Run it in the background (no terminal window needed)

`npm run start:all` only runs while that terminal stays open. To keep it running 24/7 and
auto-restart on reboot, use PM2:

```bash
npm install -g pm2
npm run build            # build the web app once
npm run service:start    # starts server + web in the background and saves them
pm2 startup              # then run the one line it prints (enables start-on-boot)
```

Manage it any time: `pm2 ls`, `npm run service:logs`, `pm2 restart all`, `npm run service:stop`.

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
