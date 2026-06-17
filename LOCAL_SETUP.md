# Run LIV8 Command Center on Your Laptop (Local, Private, Free)

This guide gets the Command Center running **entirely on your Mac** — no Vercel, no
Render, nothing in the cloud. AI runs locally through **Ollama** (free + private), so
ticket data and drafts never leave your machine. That keeps you compliant and safe
from external breaches.

> **Why your old "desktop app" didn't refresh tickets or run AI agents:**
> The app has two halves — a **frontend** (the screen you see) and a **backend
> server** (the part that talks to Freshdesk and the AI). On `command.liv8.co` the
> backend runs 24/7 in the cloud, so everything works. Your desktop shortcut was
> only the frontend with **no backend running on your laptop** — so it had nothing
> to fetch tickets from or run agents with. The launcher below starts **both**, which
> is why it now works locally.

---

## One-time setup (about 10 minutes)

### 1. Install Node.js
Download the **LTS** version from <https://nodejs.org> and install it (just click
through). This is what runs the app.

### 2. Install Ollama (the free local AI)
Download from <https://ollama.com/download>, open it, then download one model.
Open the **Terminal** app and run:

```bash
ollama pull llama3.1
```

That's a one-time ~5 GB download. This is the "brain" your AI agents will use — for
free, on your laptop. (The launcher will also offer to do this for you automatically.)

### 3. Get the project onto your laptop
If you haven't already, download/clone this folder to somewhere easy like your
Desktop or Documents.

---

## Launch it (every day)

**Just double-click `start.command`** in this folder.

The first time, macOS may say it's from an unidentified developer. If so:
**right-click `start.command` → Open → Open**. After that, a normal double-click works.

The launcher will:
1. Check Node + Ollama are ready (and start Ollama / download the model if needed)
2. On first run, open `server/.env` so you can paste your Freshdesk details
3. Install dependencies (first run only)
4. Start the backend **and** frontend together
5. Open the app at **http://localhost:3000**

Leave the small black Terminal window open while you work. Closing it stops the app.

### Your Freshdesk details (so tickets load)
On the very first run you'll be asked to fill these into `server/.env`:

```
FRESHDESK_DOMAIN=yourcompany      # the part before .freshdesk.com
FRESHDESK_API_KEY=xxxxxxxxxxxx     # Freshdesk → Profile Settings → Your API Key
FRESHDESK_AGENT_ID=123456789       # your agent ID
```

Save and close that window, return to the Terminal, and press Return. Tickets will
now refresh just like they did on the website.

---

## Make it feel like a real desktop app (optional)

The app is a PWA, so you can install it with its own icon and window:

- **Chrome / Edge:** open <http://localhost:3000>, click the **install icon** in the
  address bar (a little monitor with a down-arrow) → **Install**.
- It now opens in its own window from Launchpad/Applications — no browser tabs.

You still double-click `start.command` first (that runs the engine); the installed
app is just a cleaner window onto it.

---

## How the AI is wired (Ollama first, cloud as backup)

This local install defaults to:

```
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

Every AI request tries **local Ollama first**. If Ollama is off, or you want more
power for a specific task, it automatically falls back to any cloud keys you've added
(Gemini / Groq / Claude / OpenAI) in **AI Settings** inside the app. If you add no
cloud keys, it stays 100% local.

To change the model or point at a different Ollama machine, open **AI Settings** in
the app and pick **Ollama (Local)**.

---

## Your Freshdesk workflow (voice → draft → paste → you send)

The whole point: the assistant **drafts**, **you send**. It is built to be
**draft-only** — there is no code anywhere that posts a reply to Freshdesk.

Typical flow:
1. Open the **Tickets** page — your real Freshdesk tickets load.
2. Talk to the voice assistant or click a ticket and **Generate Response** (or
   **Pipeline** for the full SOP + history + QA pass).
3. Review the draft. Edit anything you want.
4. Click **Copy & Open in Freshdesk** — this copies the draft to your clipboard and
   opens that exact ticket in Freshdesk.
5. In Freshdesk, click **Reply**, paste (⌘V), read it once more, and hit **Send**
   yourself.

**The AI never sends anything on its own. Sending is always your manual click.**

---

## Troubleshooting

**"Tickets won't load."** Make sure the Terminal window is still open (the backend
must be running) and that your Freshdesk details in `server/.env` are correct. Then
click refresh on the Tickets page.

**"AI agents say offline / disabled."** The buttons enable only when the backend is
online. Confirm the Terminal window shows the server started, and that either Ollama
is running (`ollama list` shows a model) or you've added a cloud key in AI Settings.

**"Ollama is slow the first time."** The model loads into memory on the first request
of a session — give the first answer a few extra seconds, then it's quick.

**Reset the backend config:** delete `server/.env` and double-click `start.command`
again to recreate it.
