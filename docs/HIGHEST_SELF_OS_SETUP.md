# Highest Self OS — Setup & Launch (Mac mini)

Everything here is **additive** to the existing LIV8 Command Center. Nothing was
renamed. All Highest Self surfaces are **read/draft-only** — the app never places
trades, sends messages, or mutates external systems on its own.

---

## 1. One-time install

From the repo root:

```bash
# Frontend deps (repo root)
npm install

# Backend deps
cd server && npm install && cd ..
```

Requires Node 18+ (Node 20/22 fine). SQLite is bundled via `better-sqlite3`.

---

## 2. Environment variables

Create/edit **`server/.env`** (never commit it). Only add what you use — every
integration degrades gracefully if its key is missing.

```bash
# --- AI (at least one recommended so Juno/the coach works) ---
ANTHROPIC_API_KEY=...
# or OPENAI_API_KEY=...  / GEMINI_API_KEY=...

# --- Oura (Health OS recovery) ---
# Personal Access Token from https://cloud.ouraring.com/personal-access-tokens
OURA_ACCESS_TOKEN=your_oura_personal_access_token

# --- Hybrid Journal (Trading Process import) ---
HYBRID_JOURNAL_TOKEN=your_hybrid_journal_token
HYBRID_JOURNAL_URL=https://<your-journal-api-base>      # e.g. https://journal.tradehybrid.co/api
HYBRID_JOURNAL_TRADES_PATH=/trades                      # the trades list endpoint
# optional, defaults shown:
# HYBRID_JOURNAL_AUTH_HEADER=Authorization
# HYBRID_JOURNAL_AUTH_SCHEME=Bearer

# --- GitHub (Business & Creation repo sync) ---
GITHUB_TOKEN=ghp_...            # (whatever the existing github-portfolio module uses)

# --- Server ---
PORT=3005
DB_DATA_DIR=./data              # SQLite persistence dir
```

The **frontend** reads the API base from `VITE_API_URL` (defaults to
`http://localhost:3005`). For local Mac use, the default is correct.

---

## 3. Launch on the Mac mini

**Dev mode (recommended for daily use — hot reload + server together):**

```bash
npm run start:all
```

This runs the Vite dev server (UI) and the Node API server concurrently. Then open:

- **App:** http://localhost:3001  (Vite prints the exact port — usually 3001)
- **API:** http://localhost:3005/health  (should return `{"status":"ok",...}`)

**Run pieces separately (two terminals):**

```bash
npm run server     # API on :3005
npm run dev        # UI (Vite) on :3001
```

**Production-style (build once, serve static):**

```bash
npm run build      # outputs dist/
npm run server     # API
npm run preview    # serves the built UI
```

---

## 4. Turn the integrations on (in the app)

- **Health OS → "Sync Oura"** — pulls readiness/sleep/activity (needs `OURA_ACCESS_TOKEN`).
- **Trading Process → "Sync Hybrid Journal"** — imports trades for adherence
  (needs `HYBRID_JOURNAL_TOKEN` + `HYBRID_JOURNAL_URL`). Dedups by journal ref.
- **Trading Process → webhook URL** — point your Hybrid AI / TradingView alert at:
  `http://<host>:3005/api/hs/trading/webhook` (records the setup only — never trades).
- **Business & Creation → "Sync GitHub"** — maps your repos into projects
  (commit activity ≠ strategic value; states stay editable).

---

## 5. Smoke test (optional, from a terminal)

```bash
curl -s localhost:3005/health
curl -s "localhost:3005/api/hs/today"
curl -s "localhost:3005/api/hs/projects"
curl -s "localhost:3005/api/hs/family/horizon?days=180"
curl -s "localhost:3005/api/hs/health/oura/status"
curl -s "localhost:3005/api/hs/trading/hybrid-journal/status"
```

All return JSON. `configured:false` on Oura/Hybrid Journal just means that env
var isn't set yet.

---

## 6. Data & safety notes

- All Highest Self data lives in new `hs_*` SQLite tables in `DB_DATA_DIR` — no
  existing Command Center tables were changed. Back up that folder to keep history.
- If the API server is down, the Highest Self pages still work via a
  **localStorage fallback** and sync back to SQLite once the server returns.
- Feature flags live in `src/config.js` under `FEATURES.HIGHEST_SELF` — flip any
  surface off without touching code paths.
- The AI (Juno) is briefed on Highest Self OS in `server/lib/system-prompt.js`
  and is instructed never to take external write actions.
