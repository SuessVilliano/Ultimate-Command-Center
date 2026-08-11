# HIGHEST SELF OS — Governing Specification

**Status:** Master implementation specification for the existing Ultimate Command Center.
**Core rule:** Inspect first. Preserve what works. Extend additively. Do not rebuild from scratch.
**Safety boundary:** Read-only / draft-only for all external systems by default. No silent
messages, posts, ticket changes, trades, or calendar mutations. Any write must be explicit,
scoped, permissioned, auditable, and user-confirmed.

> This file is the canonical reference. Companion analysis lives in
> `HIGHEST_SELF_OS_COMPATIBILITY_MAP.md` and `HIGHEST_SELF_OS_IMPLEMENTATION_PLAN.md`.

---

## 1. North Star
Answer one question: **"Am I living the life I said I wanted to live?"** Beyond tasks/apps, the
system surfaces where life is overloaded, what's neglected, what deserves attention today, what
to deliberately *not* do, whether health supports performance, whether family gets protected
time, whether trading follows process over emotion, whether employment serves without consuming
identity, whether businesses become assets, and whether ideas are captured without becoming
obligations. **Optimize alignment, not raw task completion.**

## 2–3. Core life model & domains
Root: **HIGHEST SELF** → five first-class, *interconnected* domains (a graph, not folders):
**SELF, FAMILY, HEALTH, WEALTH, CREATION.** Objects have relationships (e.g. Bike → Health +
Family; Oura → Health + Trading readiness; GitHub repo → Creation project).

- **SELF** — Hour of Me (default 60 min: Mind / Identity / Body / Knowledge, flexible
  composition), daily intention, night reflection, goals, ADHD focus controls, weekly review,
  quarterly audit.
- **FAMILY** — make family time proactive, not leftover. Children: **Jovi** (Watergrass
  Elementary, Wesley Chapel; lives with user), **Jionni** (Innovation, Orlando), **Justis**
  (Riverwood, Sandy Springs/Atlanta). All school/custody details **editable**. Protected
  birthdays (recurring annual): User Aug 6 · Mom Aug 17 · Jovi Nov 22 · Jovi's mom Dec 16 ·
  Jionni's mom Feb 1 · Justis's mom Feb 1 · Jionni Feb 25 · **Justis Apr 23 (hard protect —
  "be there")**. Family engine: normalize school-off dates, detect all-kids overlaps, flag
  high-value windows, suggest PTO, show travel lead time, protect family blocks from business
  sprints. Supportive visibility only — never shaming.

## 4. Health engine
Inputs via adapters: Oura, Apple Health, manual, weight/body-comp, sleep, readiness, activity,
bike rides, walking, mobility/PT, strength, nutrition adherence, hydration, labs, garden,
subjective energy/stress. Wearable scores are **not diagnoses.** Pillars: Movement, Nutrition,
Recovery, Sleep, Mobility, Strength, Biomarkers, Environment/food system. Bike = health activity
*and* family/lifestyle experience. Garden is first-class (Health→Nutrition, Self→Restoration,
Family→Shared). Recovery-aware **recommendations** (e.g. "downgrade tonight's optional build
block") — never autonomous calendar mutations.

## 5. Trading OS
Weekly rhythm: **Sun** no-trade (family/recovery) · **Mon** research/setup (A+ discretionary) ·
**Tue/Wed/Thu** primary execution · **Fri** review/no-trade (never revenge-trade). Intraday:
5:30 scan → 6–8 execution → 8–9 secondary → 9–10 step away → 10–12 final window → **12:00
Trading Closed.** Separate **process quality** from **P&L** ("Did I follow my system?"). Preserve
and extend the existing trading dashboard. **No autonomous order placement.**

## 6. Employment / Work engine
Employment = current financial floor, not identity. Current schedule: Tue–Sat ~9–5 (possible
future Mon–Fri). **Do not hard-code the workweek — make it configurable & effective-dated.**
Surface work conflicts vs trading/family/appointments/travel explicitly. External work systems
read/draft-only.

## 7. Wealth / Business engine
Wealth = Trading, Employment, Businesses, Investments, Assets, Cash flow, Recurring revenue.
Two classifications per project: **Strategic type** (CASH FLOW / ASSET / MOONSHOT) × **Operating
state** (ACTIVE / MAINTENANCE / PARKED / IDEA / ARCHIVED). Only a limited number ACTIVE.
Inventory the ecosystem (Smart Life Brokers, LIV8/Elevate, Hybrid Funding, Trade Hybrid, Hybrid
Journal, etc.) and ask why each exists, cash/compound, cost, attention, last advanced, next
milestone. Capacity rule: default ~2 deep build blocks/week (configurable), not every evening.

## 8. Creation engine + Idea Orbit
Pipeline **IDEA → RESEARCH → VALIDATED → PROJECT → ACTIVE** with explicit promotion gates; ideas
never auto-activate. GitHub repos map to project/domain/status/activity — **commit volume ≠
strategic value.**

## 9. Load engine
Every node can consume/produce TIME, ENERGY, ATTENTION, MONEY, RECOVERY, VALUE (optional: stress,
family/health/financial value, leverage, urgency, joy). **Transparent, explainable weighting —
no fake "AI precision" score.** Compare vs daily/weekly capacity, recovery, fixed obligations.
Detect overload (too many active projects, late-night builds, poor sleep + high load, sprint
during family week) and neglect (health below baseline, no reflection, stalled primary business,
unplanned family event). Never guilt-heavy.

## 10. Growth engine
Loop: **INTENTION → ACTION → EVIDENCE → REFLECTION → ADJUSTMENT → GROWTH.** Always distinguish
claimed intention vs observed evidence vs AI inference. Never present inference as fact.

## 11–14. Rhythms & reviews
Weekly template (Sun family/reset → Mon CEO/prep → Tue–Thu execute → Fri review/family → Sat
life) that **adapts to configured work schedule and protected family events.** Daily template
(morning Hour of Me + trading windows → 12pm close → afternoon work → evening decision tree:
protected family? recovery low? build night? else family/life → night shutdown). **Weekly
Review** (Sun, ~30 min, 5 questions, **max 3 priorities**). **Quarterly Highest Self Audit**
(score 12 areas, 90-day theme, ≤3 outcomes).

## 15. 2D Command Mode
The existing dashboard stays the fastest operational interface (DO/CHECK/OPEN/EXECUTE). Suggested
nav: Today · Life · Family · Health · Trading · Wealth · Creation · Work · Calendar · Reviews ·
Tools · Settings — **map to existing architecture rather than blindly replacing.** The **Today**
screen is the highest-value surface (day type, Highest Self state, recovery snapshot, load, top
1–3, intention, trading state, work shift, family events, health commitment, conflicts, shutdown).

## 16–17. 3D Life Map & Time Machine
3D map = strategic visualization over the **same** data (not a separate DB): node size =
importance, distance = priority, brightness = activity, edges = relationships, pulse = recent
activity, halo = protected, warning = conflict, dimmed = parked, outer orbit = ideas. Never
color alone. Time Machine adds a time dimension (today/week/30d/quarter/year/custom); distinguish
planned-future from observed-history.

## 18. AI Coach
Reasoning layer over **verified data**, not a motivational chatbot. **Response contract:**
recommendation • why • evidence used • confidence • fact/rule/inference • optional action. No
medical diagnosis, no autonomous trading, no silent external mutations.

## 19–20. Calendar/conflict & PTO planning
Calendar is the shared spine (manual, school, birthdays, work, PTO, travel, trading windows,
health, business/family blocks). Conflict types across work/family/trading/travel/recovery.
Events markable **hard / soft / flexible** protect. Annual PTO planner suggests candidates &
consecutive days — **never auto-requests PTO.**

## 21. Data model (conceptual)
Use existing DB conventions; additive only. Core entities: `life_domains`, `life_nodes`,
`life_edges`, `people`, `protected_dates`, `school_calendars`, `school_calendar_events`,
`daily_intentions`, `daily_reflections`, `health_daily`, `movement_sessions`, `trading_days`,
`projects`, `ideas`, `load_entries`, `weekly_reviews`, `quarterly_reviews`, `evidence_events`,
`work_schedules`. (Column detail per source spec.)

## 22–24. Provenance, integrations, privacy
Every datum knows its source (manual/oura/calendar/github/trading/work/derived/ai_inference).
Store AI inputs/timestamp/confidence; never overwrite raw sources. Adapter interfaces:
HealthProvider, CalendarProvider, RepoProvider, TradingProvider, TaskProvider, WorkProvider.
Oura: implement against the current supported API/auth; tokens in secret storage; graceful on
missing scopes. Privacy: secrets in env only, encrypt sensitive tokens at rest, least privilege,
disconnect/revoke controls, separate raw health from AI summaries, export/delete, no personal
data in logs/analytics.

## 25–28. ADHD UX, voice, notifications, scorecards
ADHD principles: **max 3 priorities**, progressive disclosure, one obvious next action, instant
idea capture without activation, Now/Next/Later, voice capture, no broken-streak shame, surface
conflicts early, "parking a project = success", deep analytics one layer from Today. Voice/quick
capture creates **drafts**, never risky external actions. Notifications scarce & meaningful.
Prefer **domain scorecards with evidence** over one giant life score.

## 29–32. Automations, "What should I do now?", collisions, Reset Mode
Automations are internal/recommendation-first: morning synthesis, 12pm trading cutoff (UI only),
evening load check, Sunday review compile, family horizon (30/60/90), project-overload decision
screen. "What should I do now?" decision hierarchy: hard obligation → safety/health → protected
family → trading window → employment → weekly priority → movement/recovery → admin → creation →
idea. Family/business collision rule: near all-kids weeks/birthdays, don't launch, reduce build
load, front-load work, surface PTO early. **Reset Mode** for bad weeks: show only sleep/recovery,
required work, family obligations, basic movement, one business priority, trading-if-ready;
capture everything else to Later. "What is the minimum viable week that keeps life stable?"

## 33. Implementation phases
0 Repository intelligence → 1 Highest Self core (Today/Self) → 2 Family OS → 3 Health OS →
4 Trading OS → 5 Business/Creation OS → 6 3D Life Map → 7 AI Coach → 8 Time Machine + audit.
(See `HIGHEST_SELF_OS_IMPLEMENTATION_PLAN.md` for the sequenced, repo-specific version.)

## 34. Acceptance criteria
Existing functionality still works · Today understood in <30s · top 1–3 identifiable · family
anchors visible months ahead · work-schedule changes don't break planning · trading visibly
closes · health influences recommendations · active projects visibly limited · ideas land in
Idea Orbit · every AI recommendation explains why · raw evidence distinguishable from inference ·
3D and 2D share data · works on mobile · Reset Mode exists · **no external mutation without
explicit permission.**

## 37. Product principles (never lose these)
Life before dashboard · alignment before productivity · systems before goals · process before
trading outcome · family time scheduled not leftover · health is infrastructure · employment is a
container not an identity · business must earn attention · ideas are not obligations · recovery is
productive · three priorities beat nineteen · evidence beats self-story · AI inference identifies
itself · 2D executes, 3D explains · the user is the final decision-maker.
