# Highest Self OS — Implementation Plan

**Status:** Phase 0 deliverable (additive, phased, reversible)
**Date:** 2026-08-11
**Companion docs:** `HIGHEST_SELF_OS.md` (spec), `HIGHEST_SELF_OS_COMPATIBILITY_MAP.md` (as-built)

> Core rule: extend the existing Ultimate Command Center. Additive migrations, feature
> flags, tests before critical changes, documented rollback. No external writes by default.

---

## 0. "Implement it BETTER than the spec" — my recommended deviations

The ChatGPT blueprint is excellent as a *vision* but, taken literally, it over-builds. These
are the deliberate improvements that make it actually shippable for an ADHD operator who has a
**working** app today:

1. **Defer the generic `life_nodes` / `life_edges` graph until Phase 6 (the 3D map).**
   Building an abstract node/edge graph *first* is the classic trap — you get an elegant schema
   and nothing usable for months. Instead: ship **concrete domain tables** (intentions,
   reflections, projects, people, health) in Phases 1–5, then project them into a graph view
   only when the 3D map needs it. The graph becomes a *read model*, not the source of truth.

2. **The Today screen is the whole product for Phase 1. Declutter before you add.**
   The current Dashboard is powerful but busy. Highest Self's #1 acceptance test is "understand
   the day in <30s". So Phase 1 *reorganizes* the top of the existing Dashboard into a single
   focused block (day type • top 1–3 • intention • conflicts • trading state • one next action),
   with everything else collapsed below. Reuse, don't replace.

3. **Persist Self data server-side from day one.** Today's wellness/focus/schedule live in
   `localStorage`. Move intention/reflection/reviews into SQLite immediately (localStorage stays
   as an offline cache). Otherwise the most personal data is the least durable.

4. **One flag namespace, defaulting OFF.** Extend `src/config.js` `FEATURES` with a
   `HIGHEST_SELF` sub-object. Every new surface ships behind a flag so `master` stays green and
   any phase is instantly reversible by flipping one boolean.

5. **New backend routes go in `server/routes/highest-self-*.js`,** registered like
   `registerNiftyRoutes(app)`. Never grow the 6,500-line `server.js` further.

6. **Safety is a build-time invariant, not a convention.** All Highest Self endpoints are
   read/draft-only. Route any "action" through the existing `drafts` queue. Add a `SAFE_MODE`
   env default and a checklist item in every PR: *"does this write to an external system?"*

7. **Sequence by leverage, not by spec order.** Do Self/Today → Family → Health → Trading →
   Business. The **Family OS is the highest emotional-leverage feature** (protected birthdays,
   all-kids windows, "be there for Justis") and is mostly static data + date math — high value,
   low risk. Prioritize it right after Phase 1, before Health integrations that depend on Oura
   API access.

8. **Recovery/neglect language is supportive, never shaming** (spec §3.2, §9.3, §25.9) — encode
   this as copy constants reviewed once, not scattered strings.

---

## 0.5 User direction — v2 (supersedes ordering above)

Direct clarifications from the operator. These **override the default sequencing** and the
"defer 3D" recommendation where they conflict.

### A. No renaming — features only
Keep every existing name and brand: **LIV8 Command Center, Hybrid, Hybrid Funding, Hybrid
Journal, Trade Hybrid, Smart Life Brokers, LIV8 Health**, etc. This is an *additive feature
upgrade*, not a rebrand. No page titles, product names, or nav labels get renamed — new surfaces
are added alongside the existing ones.

### B. The 3D mind-map is the signature interface — bring it forward
This is the operator's #1 want, not a Phase-6 afterthought. The experience:
- **Notes rendered as a web** — nodes connected by edges, physically tied together.
- **Real zoom** — zoom out for the whole life graph; zoom into a cluster to read the note's detail.
- **Interconnection** — a note links to related notes, projects, domains, ideas.
- **Master plans grow out of clusters** — select/expand a cluster of connected notes and
  **promote it into a "Master Plan"** (a structured, buildable plan node). The mind-map is both
  the *capture* surface and the *planning* surface — Idea Orbit, Life Map, and notes unified into
  one zoomable graph.

**Reconciled approach (still additive, still grounded in data):**
- **Phase 1 now also ships a lightweight graph data layer** — `notes` + `note_links` (and a thin
  `graph_nodes` projection). This is small and concrete; it is *not* the heavy abstract
  `life_nodes/life_edges` schema, which still waits.
- **The mind-map UI moves to Phase 2** (right after Today/Self), rendered first in **2D
  (force-directed web)**, then upgraded to **3D** once it's useful. 2D-first keeps it mobile-
  friendly and fast to ship; same data feeds both.
- **"Master Plan" = a saved cluster** → becomes a plan you can build out (checklist / milestones),
  linked back to the notes it grew from.
- Tech: force-directed 2D first (canvas/SVG, no heavy dep), then evaluate React Three Fiber for
  the 3D view; lazy-loaded; 2D fallback on mobile; same API.

### C. Trading = alert-adherence tracking (wired to the real workflow)
The operator's actual process: pre-plan the week + key levels → wait for an **order block** to
form → **Hybrid AI alert** (or **Auto Hybrid AI** strategy) fires "setup appeared" → get
prepared → price hits the level → **execute**. So the system should measure *"did I trade my
setup, or did I trade randomly?"*
- **Ingest alerts** from the existing **webhook** into an `alerts` table (source: Hybrid AI /
  Auto Hybrid AI / TradingView / Telegram), with symbol, setup type (e.g. order block), level,
  timestamp.
- **Link alerts → trades** from **Hybrid Journal**: for each executed trade, was there a
  preceding valid alert/setup? Tag each trade **on-setup** vs **off-setup (random)**.
- **Alert-adherence score** = of the valid setups that fired, how many did I take per plan; and of
  my trades, how many were on-setup. This *is* the process score — "did I follow my system?" —
  separate from P&L.
- Surface: today's live/pending alerts, order-block watch, "prepared" state, and a weekly
  **setup-adherence** stat. Still **no autonomous order placement.**

### D. Health = body-recomposition + labs formula
Concrete goals, not generic wellness:
- **Body composition:** build lean muscle, get "cut up" / fighter-lean — **sustainably** (reach it
  *and stay there*), tracked toward an **ideal weight** target.
- **Labs to move:** lower **cholesterol**, correct **anemia** — track lab values over time with
  targets and trend, flag when re-testing is due (never diagnose; supportive + evidence-based).
- **A real formula:** a training + nutrition plan for recomposition (progressive strength for
  muscle, iron-forward nutrition for the anemia, heart-healthy fats for cholesterol), reconciled
  so the goals don't fight each other. Store as an editable plan, adjust off Oura recovery + labs.
- **Mind + recovery + me-time:** meditation, stretching/mobility, and **protected "Hour of Me"
  time scheduled in** — first-class blocks, not leftovers.

### Revised leverage order
`Phase 1 Today+Self (+ notes/graph data layer)` → **`Phase 2 Mind-Map (2D web → 3D) + Master
Plans`** → `Phase 3 Trading alert-adherence` → `Phase 4 Health recomposition + labs` →
`Phase 5 Family OS` → `Phase 6 Business/Creation + Idea Orbit (folds into the mind-map)` →
`Phase 7 AI Coach` → `Phase 8 Time Machine + quarterly audit`. Family can move earlier on request;
the mind-map and trading/health specifics are the operator's stated priorities.

---

## 1. Foundations (shared, built once in Phase 1)

**Feature flags** — `src/config.js`:
```js
FEATURES.HIGHEST_SELF = {
  TODAY: false, SELF: false, FAMILY: false, HEALTH: false,
  TRADING_PROCESS: false, BUSINESS_OS: false, IDEA_ORBIT: false,
  LOAD_ENGINE: false, COACH: false, LIFE_MAP_3D: false, TIME_MACHINE: false,
  RESET_MODE: false,
};
```

**Backend module** — `server/lib/highest-self-db.js` exposing `initHighestSelfTables()`
(called once in `server.js` init block, next to the other `initXxxTables()` calls) +
CRUD helpers. **Additive tables only.**

**Routes** — `server/routes/highest-self-routes.js`, `registerHighestSelfRoutes(app)`.

**Provenance** — every new table carries `source` (`manual|oura|calendar|github|trading|
work|derived|ai_inference`) and, where inferred, `confidence` + `inputs_json`. Raw source
data is never overwritten by AI summaries.

**Rollback** — each phase = its own tables + its own flag. Disable = flip flag; hard rollback
= drop the phase's *new* tables. No existing table is ever altered destructively.

---

## 2. Phased delivery

### Phase 1 — Highest Self Core (Today + Self)  ·  flag `TODAY`, `SELF`
**Goal:** open Today, understand the day in <30s; capture intention; reflect at night.

Build:
- `today_intentions` (date, identity, top_outcomes_json ≤3, trading_rule, health_commitment,
  family_commitment, not_doing, notes)
- `today_reflections` (date, went_well, did_not, highest_self_alignment, evidence_json, adjustment)
- `work_schedules` (effective_from/to, tz, recurrence_rule, start/end, metadata) — **configurable,
  effective-dated; no hard-coded workweek**
- `weekly_reviews` (week_start, 5 domain reviews, top_three_json, theme)
- Reorganize `Dashboard.jsx` top into the **Today block** (progressive disclosure; deep analytics
  one layer down). Add a Self panel (Hour of Me composition, intention, night shutdown).
- Basic **Load** (transparent sum of time/attention/energy/recovery weights — no fake precision).

Files: `src/pages/Dashboard.jsx` (extend), new `src/pages/Today.jsx` *(optional split)*,
`src/components/highest-self/*`, `server/lib/highest-self-db.js`, `server/routes/highest-self-routes.js`,
`src/config.js`.
**Tests before change:** snapshot current Dashboard render + localStorage read/write.
**Success:** Today understood in <30s; top 1–3 visible; intention + reflection persist server-side.

### Phase 2 — Family OS  ·  flag `FAMILY`  *(highest emotional leverage — do this early)*
Build: `people`, `protected_dates` (recurring annual, protection level hard/soft/flexible,
travel_required), `school_calendars` + `school_calendar_events`. Seed Jovi/Jionni/Justis +
birthdays from spec §3.2 (all **editable**). Family timeline (year view), overlap detection
(all-kids windows, Jionni long-weekends, Justis multi-day travel windows), PTO candidate
suggestions, 30/60/90-day family horizon. Conflict rule: block heavy business sprints on
protected blocks unless explicitly overridden.
**Success:** user sees the year and knows when family time needs protection. No PTO is auto-requested.

### Phase 3 — Health OS  ·  flag `HEALTH`
Build: `HealthProvider` adapter interface + Oura adapter (implement against the *current* Oura
API/auth at build time — no invented endpoints; tokens in secret storage; graceful on missing
scopes). `health_daily`, `movement_sessions` (bike as both Health activity *and* Family/lifestyle
experience). Garden + nutrition basics. Recovery-aware **recommendations** (never autonomous
calendar edits). Upgrade the Dashboard's manual wellness block to read from Health data with
manual fallback.
**Success:** health/recovery changes daily planning; never presented as medical advice.

### Phase 4 — Trading OS  ·  flag `TRADING_PROCESS`
Build (extend existing `Trading.jsx`, add a **"Process" tab**): `trading_days` (day_type,
bias, scenarios_json, process_score, pnl, rule_violations_json, journal_ref, closed_at).
Weekly day types (Sun no-trade → Mon setup → Tue/Wed/Thu execute → Fri review). Intraday session
windows + **12pm "Trading Closed" state**. Process score separate from P&L ("Did I follow my
system?"). Link existing `/api/journal/*` + Telegram signals. Recovery/readiness context from Phase 3.
**No autonomous order placement — ever.**
**Success:** trading becomes a bounded, professional process that visibly closes after its window.

### Phase 5 — Business / Creation OS + Idea Orbit  ·  flags `BUSINESS_OS`, `IDEA_ORBIT`
Build: migrate `src/data/portfolio.js` → `projects` table (strategic_type Cash Flow/Asset/Moonshot
× operating_state Active/Maintenance/Parked/Idea/Archived; monthly_cost, revenue, recurring,
next_milestone, last_meaningful_activity). Keep `portfolio.js` as seed/fallback. Map GitHub repos
→ projects (commits ≠ value). `ideas` table + Idea Orbit capture (voice → draft) with promotion
gates IDEA→RESEARCH→VALIDATED→PROJECT→ACTIVE. **Active-project capacity limit** → decision screen
before promoting another to Active.
**Success:** user sees what's Active and can deliberately park/kill things. Ideas land without becoming obligations.

### Phase 6 — 3D Life Map  ·  flag `LIFE_MAP_3D`  *(only after 2D data model is stable & useful)*
Now introduce `life_nodes` / `life_edges` as a **read/projection layer** over Phases 1–5 data.
Evaluate React Three Fiber only if compatible; lazy-load; 2D stays primary; mobile + accessibility
fallback; same API as 2D. Visual semantics per spec §16.2 (size/distance/brightness/edge/pulse/halo),
never color alone.
**Success:** 3D reveals relationships/load — not spectacle.

### Phase 7 — AI Coach  ·  flag `COACH`
Evidence retrieval over verified data. **Recommendation contract:** recommendation • why •
evidence used • confidence • fact/rule/inference • optional draft action. Extend existing
briefing/proactive engine. Fewer, better, grounded recommendations. No diagnosis, no trading, no
silent writes.

### Phase 8 — Time Machine + Advanced Intelligence  ·  flag `TIME_MACHINE`
Historical life graph, trend/allocation overlays, correlation exploration, quarterly audit,
30/60/90 horizon. Distinguish planned-future from observed-history.

**Cross-cutting (any phase):** Reset Mode (§32) — small, high value; ship alongside Phase 1 or 2.

---

## 3. Data model (additive tables, new module)

Concrete tables shipped in Phases 1–5 (graph tables deferred to Phase 6):

`today_intentions`, `today_reflections`, `weekly_reviews`, `quarterly_reviews`,
`work_schedules`, `people`, `protected_dates`, `school_calendars`, `school_calendar_events`,
`health_daily`, `movement_sessions`, `trading_days`, `projects`, `ideas`, `load_entries`,
`evidence_events`. **Phase 6:** `life_nodes`, `life_edges` (projection/read model).

Every table: `id`, `created_at`, `updated_at`, `source`, and `metadata_json` for forward-compat.
Full column definitions follow spec §21.

---

## 4. Testing, safety, rollback

- **Before touching Dashboard/Trading:** add render/smoke tests capturing current behavior.
- **Safety gate (every PR):** "Does this perform any external write?" must be *No* unless the
  change is an explicit, confirmed, audited draft-action.
- **Flag default OFF** → merge to `master` safely; enable per-surface for the user only.
- **Rollback:** flip flag (soft) or drop the phase's new tables (hard). Existing tables untouched.
- **Provenance:** raw source rows immutable; AI summaries stored separately with confidence.

---

## 5. Files expected to change (Phase 1)

- `src/config.js` — add `FEATURES.HIGHEST_SELF`
- `src/pages/Dashboard.jsx` — Today block + Self panel (extend)
- `src/components/highest-self/…` — new components (TodayBlock, IntentionCard, ReflectionCard, HourOfMe)
- `src/App.jsx`, `src/components/Sidebar.jsx` — optional "Today"/"Life" nav entries (flagged)
- `server/lib/highest-self-db.js` — new, additive tables + CRUD
- `server/routes/highest-self-routes.js` — new, `registerHighestSelfRoutes(app)`
- `server/server.js` — one init call + one route registration (2 lines)
- `docs/CHANGELOG_HIGHEST_SELF.md` — running log

---

## 6. Sequencing summary

```
Phase 0  Repository intelligence + these docs        ✅ (this deliverable)
Phase 1  Today + Self  (+ Reset Mode)                ← recommended next
Phase 2  Family OS     (highest emotional leverage)
Phase 3  Health OS     (Oura adapter)
Phase 4  Trading OS    (process layer on Trading.jsx)
Phase 5  Business/Creation OS + Idea Orbit
Phase 6  3D Life Map   (graph as read model)
Phase 7  AI Coach      (recommendation contract)
Phase 8  Time Machine + quarterly audit
```

**Acceptance criteria** tracked against spec §34 — the upgrade succeeds only if existing
critical functionality still works, Today is understood in <30s, family anchors are visible
months ahead, trading visibly closes, active projects are limited, ideas land safely, and the
system never mutates external systems without explicit permission.
