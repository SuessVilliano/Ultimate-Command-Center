# Highest Self OS — Changelog

All changes additive. No existing pages/names renamed. Read/draft-only throughout.

## Build 4 — Integrations, AI awareness, docs, tested
- **GitHub → Projects**: `POST /api/hs/projects/sync-github` maps repos into
  `hs_projects` (dedup by repo_url/name; commit activity informs last_activity,
  never strategic value). "Sync GitHub" button on Business & Creation.
- **Hybrid Journal button**: "Sync Hybrid Journal" on Trading Process (status +
  import); webhook URL shown for Hybrid AI / TradingView alerts.
- **AI awareness**: `system-prompt.js` CORE_IDENTITY now briefs Juno on all
  Highest Self OS surfaces, the kids + protected dates, trading adherence, health
  recomposition, and a new rule: never take external write actions.
- **Docs**: `HIGHEST_SELF_OS_SETUP.md` (env + Mac launch), this changelog.
- **Tested**: server boots with `hs_*` tables + `/api/hs/*` routes registered;
  live-hit /health, /today, /projects, /family/horizon, notes, webhook,
  intention, oura/hybrid-journal status. Frontend build passes.

## Build 3 — Business/Creation OS + Idea Orbit + Today + Hybrid Journal adapter
- `hs_projects`, `hs_ideas`, `hs_settings`; Cash Flow/Asset/Moonshot ×
  Active/Maintenance/Parked/Idea/Archived; focus-capacity cap; Idea Orbit with
  promotion gates (activation blocked past cap).
- Unified **Today** glance: day type, intention, top 1–3, one next action via a
  transparent decision hierarchy, glance cards.
- Hybrid Journal adapter (env-configurable, read-only, dedup import).

## Build 2 — Family OS + Oura + Hybrid Journal import
- `hs_people`, `hs_protected_dates`, `hs_family_events`; seeded Jovi/Jionni/Justis
  + protected birthdays. Family horizon, all-kids overlap windows, PTO candidates.
- Oura adapter (v2 usercollection, read-only) + Health OS recovery panel.
- `POST /api/hs/trading/import` bulk trade import.

## Build 1 — Core surfaces
- `hs_notes`/`hs_note_links`/`hs_master_plans`, intentions, reflections,
  hour-of-me, weekly reviews, trade alerts/trades/adherence, body metrics, labs,
  health daily + seeded recomposition plan.
- Pages: Life Map (canvas force-graph → Master Plans), Highest Self (intention/
  Hour of Me/reflection), Health OS (recomp + labs), Trading Process (alert
  adherence, 12pm close). Feature-flagged; localStorage fallback.
- Backend wired into `server.js` (one init + one route registration).

## Build 0 — Planning
- `HIGHEST_SELF_OS.md`, `HIGHEST_SELF_OS_COMPATIBILITY_MAP.md`,
  `HIGHEST_SELF_OS_IMPLEMENTATION_PLAN.md`.
