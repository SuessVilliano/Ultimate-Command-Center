# Making the AI + Voice Actually Work (Free Version)

This guide covers the few settings only you can flip. All the code fixes are already done — these are the server-side switches and keys.

**Golden rule:** every API key lives on the **server (Render)**, never in the browser. That's what keeps your keys private. You do NOT paste keys into the app UI anymore — do it in the Render dashboard.

---

## 1. Turn on the FREE AI (Gemini or Groq)

The AI runs entirely on your server. It just needs one free key set as an environment variable.

**Option A — Google Gemini (recommended, default provider):**
1. Go to https://aistudio.google.com/app/apikey and click **Create API key** (free).
2. In Render → your `liv8-command-center-api` service → **Environment** tab.
3. Add: `GEMINI_API_KEY` = _your key_
4. Save. Render redeploys automatically.

**Option B — Groq (free, very fast Llama/Qwen):**
1. Get a free key at https://console.groq.com/keys
2. In Render, add `GROQ_API_KEY` = _your key_ (Groq is tried first when present).

You only need **one** of these. Both are free. The browser never sees the key — the app calls your server, and the server calls Gemini/Groq.

---

## 2. Connect REAL ticket data (stop the fake numbers)

The AI now pulls live Freshdesk tickets, but it needs your Freshdesk credentials on the server. In Render → Environment, set:

- `FRESHDESK_DOMAIN` = the part before `.freshdesk.com` (e.g. `liv8` for `liv8.freshdesk.com`)
- `FRESHDESK_API_KEY` = your Freshdesk API key (Freshdesk → Profile Settings → **Your API Key**)
- `FRESHDESK_AGENT_ID` = _(optional)_ your agent ID, to scope tickets to you

Once set:
- Tickets load **automatically on every server start** (new: startup sync).
- If the database is ever empty when you ask, the AI does a **live fetch** before answering — so it can no longer invent ticket numbers. If tickets truly can't be loaded, it now says so instead of guessing.

> GoHighLevel: set `GHL_API_KEY` and `GHL_LOCATION_ID` if you use GHL. Note GHL's ticket-style data comes through Freshdesk in this app — Freshdesk is the ticket source of truth.

---

## 3. Turn on the Proactive AI (optional)

The proactive engine (auto-detects urgent tickets, drafts replies) is **off by default** to protect your free AI quota. To turn it on, in Render → Environment set:

- `PROACTIVE_AI_ENABLED` = `true`
- `PROACTIVE_CHECK_INTERVAL` = `15` _(minutes between checks; raise to 30–60 to use less quota)_
- `PROACTIVE_AUTO_ACTIONS` = `false` _(keep false so it drafts but doesn't send/escalate on its own)_

Heads up: on the free Gemini tier, checking every 15 min all day can use a lot of your daily quota. Start at 30–60 min if you notice the chat getting rate-limited.

---

## 4. Voice / microphone notes

**What changed:** the desktop microphone (talk-to-text) now explicitly asks for mic permission before listening, and shows a clear red message if it's blocked — instead of silently doing nothing.

For the mic to work in any browser:
- The app must be opened over **https://** (or `localhost`). Plain `http://` blocks the mic. Your Render/`command.liv8.co` URL is already HTTPS. ✅
- The **first time**, the browser will ask to allow the microphone — click **Allow**. If you accidentally blocked it, click the padlock/camera icon in the address bar and switch the mic to **Allow**, then reload.
- Use **Chrome or Edge** on desktop. Firefox does not support browser speech recognition and will show a notice.

The "AI voice" (spoken replies) is generated on the server and works independently of the mic — that's why it worked even when the mic didn't.

---

## Quick checklist

- [ ] `GEMINI_API_KEY` (or `GROQ_API_KEY`) set in Render → free AI works
- [ ] `FRESHDESK_DOMAIN` + `FRESHDESK_API_KEY` set → real ticket data, no fake numbers
- [ ] (optional) `PROACTIVE_AI_ENABLED=true` → proactive help
- [ ] App opened over HTTPS, mic permission allowed in the browser → desktop mic works
