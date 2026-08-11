# Highest Self OS — Compatibility Map

**Status:** Phase 0 deliverable (Repository Intelligence)
**Date:** 2026-08-11
**Rule:** Inspect first. Preserve what works. Extend additively. Do not rebuild.

This document maps the **existing Ultimate Command Center** onto the **Highest Self OS**
domain model, and records for each area whether to **preserve / extend / refactor / deprecate**.
It is the factual basis for `HIGHEST_SELF_OS_IMPLEMENTATION_PLAN.md`.

---

## 1. Architecture snapshot (as-built)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 + Vite 5 + TailwindCSS 3 | PWA (`vite-plugin-pwa`), `lucide-react` icons, `recharts` |
| Routing | **State-based `switch`** in `src/App.jsx` (`activePage`) | `react-router-dom` is installed but **not used** for page routing |
| Nav | `src/components/Sidebar.jsx` — flat `menuItems` array (17 items) | Add tabs by extending this array + the `App.jsx` switch |
| Theme / Auth | `src/context/ThemeContext.jsx`, `src/context/AuthContext.jsx` | Dark-first; `VaultLogin` gate; `isAdmin` role |
| State persistence (client) | **`localStorage`** for Dashboard wellness / notes / focus / schedule | Keys under `liv8_*`. Not multi-device, not backed up |
| Backend | Node + Express monolith — `server/server.js` (~6,500 lines, ~200 routes) | Port 3005; `src/config.js` `API_URL` |
| Data (server) | **SQLite** (`better-sqlite3`, `liv8.db`) with optional **Supabase** mirror | `server/lib/database.js`; init pattern `initXxxTables()` per module |
| AI | Multi-provider (Claude / GPT / Gemini / Groq / Kimi) via `server/lib/ai-provider.js` | RAG via `langchain-rag.js`; agent orchestrator |
| Integrations | Freshdesk, GHL, Taskade, TaskMagic, Telegram, Google Calendar, GitHub, market/news APIs | Adapter-ish modules under `server/lib/` |
| Jobs | `server/lib/scheduler.js` (ticket polling 8/12/4/12 EST), proactive engine, daily report | |
| Deploy | `render.yaml` (Render), PWA | |
| Feature flags | `src/config.js` → `FEATURES {}` object | **Reuse this** as the flag mechanism |

**Key structural facts that shape the plan**
1. Navigation is a flat state switch — new domains are cheap to add, no router migration needed.
2. There is **already a `FEATURES` flag object** — the spec's "put risky work behind flags" is satisfied by extending it.
3. Server persistence is a clean per-module `initXxxTables()` + exported functions pattern — **new domains follow the same pattern additively** (zero migration risk to existing tables).
4. The **Dashboard already contains** wellness tracking, a daily schedule template, quick notes, "today focus", a Pomodoro timer, and Mind/Body/Knowledge iconography — it is ~60% of the Highest Self "Today + Self" surface already.

---

## 2. Feature → domain compatibility table

| Existing feature | File(s) | Current data source | Highest Self OS domain | Verdict | Migration risk |
|---|---|---|---|---|---|
| **Dashboard** (wellness, schedule, notes, focus, Pomodoro, greeting) | `src/pages/Dashboard.jsx` (1110 ln) | `localStorage` (`liv8_*`) + `/api/briefing` | **Today + Self** | **Extend** — becomes the Today screen; wire Self modules (intention/reflection) into it | Low (add-only) |
| God Mode Brief | `src/components/GodModeBrief.jsx`, `/api/briefing/god-mode` | server briefing | **Today / AI Coach** | Extend → evolve into evidence-based Coach brief | Low |
| Proactive AI Dashboard | `src/components/ProactiveAIDashboard.jsx`, `proactive-ai-engine.js` | server | **AI Coach / Load Engine** | Extend → feed load + neglect signals | Medium (logic) |
| **Trading Hub** (market/crypto/news, watchlist, movers) | `src/pages/Trading.jsx` (731 ln) | `/api/market/*`, `/api/news/*` | **Wealth → Trading (market data)** | **Preserve + extend** — add "Process" tab (day types, session windows, process score, 12pm cutoff) | Low |
| Trading journal / signals / performance | `/api/journal/*`, `/api/telegram/signals` | SQLite + Telegram | **Wealth → Trading (process)** | Extend → link to `trading_days` process score | Medium |
| GitHub | `src/pages/GitHub.jsx` (994 ln), `github-portfolio.js`, `/api/portfolio` | GitHub API | **Creation → Projects / GitHub graph** | Extend → map repos to `projects` (do not equate commits with value) | Low |
| Projects | `src/pages/Projects.jsx` (970 ln), `src/data/portfolio.js` | **hard-coded JS** | **Wealth/Creation → Businesses & Projects** | **Refactor** → migrate portfolio data into `projects` table with Cash Flow/Asset/Moonshot + Active/Maintenance/Parked/Idea/Archived | Medium (data move; keep JS as seed/fallback) |
| Valuation | `src/pages/Valuation.jsx` (653 ln) | `portfolio.js` | **Wealth → Assets/Cash flow** | Preserve; later read from `projects` | Low |
| Domains | `src/pages/Domains.jsx` (541 ln) | `portfolio.js` | **Wealth/Creation → Assets** | Preserve | Low |
| Actions / Action Items / Action Feed | `Actions.jsx`, `ActionFeed.jsx` | portfolio / server | **Cross-domain tasks** | Preserve; later tag with domain | Low |
| GHL / Tickets | `Tickets.jsx` (3010 ln), `Inbox.jsx`, ticket pipeline | Freshdesk/GHL | **Work / Employment engine** | **Preserve (read/draft-only)** — surface as Work container; keep write-safety boundary | Low but **safety-critical** |
| Agent Team / Agents / Voice Agents | `AgentTeam.jsx`, `Agents.jsx`, `VoiceAgents.jsx`, orchestrator | SQLite | **Creation / AI Coach substrate** | Preserve | Low |
| Content Engine | `ContentEngine.jsx` (707 ln) | server | **Creation → Projects** | Preserve | Low |
| API / MCP Builder | `APIBuilder.jsx` | server | **Tools** | Preserve | Low |
| Integrations | `Integrations.jsx` (874 ln), `integrations.js`, `integration_credentials` | SQLite (creds) | **Integration architecture / Provenance** | Extend → becomes provider registry (Health/Calendar/Repo/Trading/Work adapters) | Low |
| News | `News.jsx` | news-service | **Today context** | Preserve | Low |
| Glasses Mode | `Glasses.jsx` (1427 ln), `/api/alerts/glasses` | server | **Voice/quick-capture surface** | Preserve | Low |
| Voice Dictation / Chat Widget / Send-to-PA | `VoiceDictation.jsx`, `ChatWidget.jsx`, `SendToPA.jsx` | server | **Voice / Quick Capture (§26)** | **Extend** → "Capture idea", "Log a bike ride", "Reflect on today" create drafts | Medium |
| Calendar service | `server/lib/calendar-service.js`, `/api/calendar/*`, `calendar_events` | Google Calendar (read) | **Calendar + Conflict engine** | **Extend** → shared spine; add conflict detection, protected dates, school calendars | Medium |
| Draft queue | `DraftQueue.jsx`, `/api/drafts` | SQLite `drafts` | **Draft-only action boundary (§0)** | Preserve — already models the "draft, don't send" safety pattern | Low |
| Scheduler / daily report / proactive briefing | `scheduler.js`, `daily-report.js`, `proactive-briefing.js` | SQLite | **Automations (§29)** | Extend → morning synthesis, trading cutoff, Sunday review, family horizon | Medium |

---

## 3. Existing tables (do not touch destructively)

`tickets`, `ticket_analysis`, `generated_responses`, `knowledge_base`, `embeddings`,
`scheduled_runs`, `settings`, `agent_interactions`, `casebook`, `drafts`, `sop_log`,
`calendar_events`, `news_items`, `briefings`, `parking_lot`, `pomodoro_sessions`,
`activity_log`, `automation_rules`, `agents`, `agent_knowledge`, `agent_conversations`,
`agent_messages`, `unified_inbox`, `inbox_notifications`, `integration_credentials`,
`conversations`, `conversation_messages`, `memory_facts`, `user_context`,
`task_mappings`, `sync_history`, `sync_config`.

**All new Highest Self tables are additive** (new `CREATE TABLE IF NOT EXISTS`, new
`initHighestSelfTables()` module). No `ALTER`/`DROP` on the above.

---

## 4. Gap analysis (spec ↔ repo)

| Highest Self capability | Exists today? | Gap |
|---|---|---|
| Today screen understandable in <30s | Partial (Dashboard is busy) | Needs a focused, decluttered top-of-Today block (day type, top 1–3, intention, conflicts) |
| Daily intention / night reflection | ❌ | New — but slots into existing Dashboard |
| Weekly review (3 priorities max) | ❌ | New |
| Quarterly audit | ❌ | New |
| Configurable, effective-dated **work schedule** | ❌ (schedule is a client template) | New `work_schedules` table + editor |
| Protected dates / birthdays (recurring) | ❌ | New |
| People (Jovi / Jionni / Justis) + school calendars | ❌ | New |
| Family overlap / all-kids windows / PTO planner | ❌ | New |
| Oura / health adapter, movement, recovery-aware suggestions | ❌ (wellness is manual localStorage) | New `HealthProvider` adapter + `health_daily` |
| Garden / nutrition | ❌ | New |
| Trading **process score** + day types + cutoff state | Partial (market data only) | New process layer on existing Trading page |
| Business classification (Cash Flow/Asset/Moonshot × state) | ❌ (flat portfolio) | New fields on migrated `projects` |
| Idea Orbit + promotion gates | ❌ | New `ideas` table + capture UI |
| **Load engine** (time/energy/attention/money/recovery) | ❌ | New — transparent weighting, not fake AI score |
| Neglect detection | ❌ | New |
| AI Coach with recommendation contract (why/evidence/confidence/type) | Partial (briefings) | Extend to structured contract |
| Provenance / trust on every datum | Partial (`integration_credentials`) | New `source`/provenance columns on new tables |
| 3D Life Map | ❌ | Deferred (Phase 6) |
| Time Machine | ❌ | Deferred (Phase 8) |
| Reset Mode | ❌ | New (small, high value) |

---

## 5. Risk register

| Risk | Area | Mitigation |
|---|---|---|
| **Silent external writes** (send SMS/email, close ticket, place trade, change calendar) | GHL, Telegram, Trading, Calendar | **Hard rule:** default read/draft-only. Reuse `drafts` queue. Any write is explicit, scoped, confirmed, audited. Add a lint check / `SAFE_WRITE` guard. |
| localStorage-only Self data lost on device change | Dashboard | Move intention/reflection/reviews to SQLite; keep localStorage as offline cache |
| Migrating `portfolio.js` breaks Projects/Valuation/Domains | Wealth pages | Keep `portfolio.js` as seed + fallback; read from table behind a flag; migrate, don't delete |
| Over-engineering the generic `life_nodes`/`life_edges` graph too early | Data model | **Defer** the generic graph to Phase 6 (see plan §"Better than the spec"). Use concrete tables first |
| Monolithic `server.js` (6.5k lines) hard to extend safely | Backend | Add new domain routes in **separate route files** (`routes/highest-self-*.js`), register like `nifty-routes.js` |
| Sensitive family/health data in logs | Privacy | Redact; separate raw health from AI summaries; env-only secrets |
| 3D map perf on mobile | Phase 6 | Lazy-load, 2D fallback, same API |

---

## 6. Reusable assets (leverage, don't rebuild)

- **Feature flags:** `src/config.js` `FEATURES`
- **Server table pattern:** `initXxxTables()` + exported CRUD (copy from `proactive-briefing.js`)
- **Separate route registration:** `registerNiftyRoutes(app)` pattern for clean additive endpoints
- **Draft safety queue:** `drafts` table + `DraftQueue.jsx` (the action-boundary model already exists)
- **Calendar spine:** `calendar-service.js` + `calendar_events`
- **AI + RAG + provenance-ish:** `ai-provider.js`, `langchain-rag.js`, `integration_credentials`
- **Dashboard scaffolding:** wellness/schedule/pomodoro/notes components to host Self modules
