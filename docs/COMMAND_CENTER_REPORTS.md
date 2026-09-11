# Command Center reports

Reports is a new sidebar destination, independent of legacy support-ticket PDFs.

## Delivery and access

Set `REPORTS_ACCESS_TOKEN` to a strong random secret on the API server. Enter that key once per browser session in Reports. The existing client-only vault login does not authenticate server requests, so report APIs fail closed without this separate server-side key. Do not put the key in a Vite variable or URL. All report endpoints require it, including downloads. This is an owner workspace feature, not tenant-level enterprise authentication.

Defaults: daily, weekly and monthly generation at 07:00 America/New_York, in-app alerts on, email off. Daily covers yesterday; weekly covers the last complete Monday-Sunday; monthly covers the previous calendar month. The persistent run key prevents duplicate scheduled reports. A one-minute server timer catches up the latest completed period after downtime, including the initial startup; it does not backfill every missed period. Schedules work while the UI is closed, but require an always-running server and persistent SQLite storage (`DB_DATA_DIR`). PDFs are stored in SQLite with their report snapshot. Archive lists the latest 100; there is no automatic deletion.

In-app popups appear while the signed-in app is open and reports have been unlocked in that browser session. A generic ready notification is also added to the existing inbox. These are not operating-system push notifications.

For email attachments configure `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_PORT`, `SMTP_FROM`, `SMTP_SECURE`. Then enable email and save one recipient in Reports. No recipient is inferred. Email delivery uses the existing SMTP service. No actual email was sent during development. A sent state means SMTP acceptance, not confirmed inbox delivery. Failed email leaves the PDF downloadable and exposes an explicit retry button. A `sending` state after a crash is intentionally not retried automatically, to avoid duplicate delivery; inspect the SMTP provider before resetting it.

Manual generation saves a PDF and does not email it automatically. The Send email action explicitly sends an archived PDF. Disabling personal content affects new reports; archives stay unchanged, and the server blocks emailing an older personal report while personal content is disabled.

## Contents and evidence

- Overview, period comparisons, wins, setbacks, current priorities, adjustments, recent connected activity and source coverage.
- Stored agent work updates, task sync history, unified inbox activity and recorded trades.
- Optional Apple Health daily averages, journal entry counts and reflection text. Full journal entry text is excluded.
- Current priorities are captured at generation time; period data uses local calendar bounds converted to UTC. Agent statuses are current statuses for rows updated during the interval, not historical status events.
- Missing tables/fields are unavailable, null health/P&L stays unknown, and every feed reports period coverage. Local records may lag external systems.
- GHL affiliate sales/conversions/revenue and calendar attendance do not have dedicated historical feeds in this implementation and are explicitly identified as unavailable. P&L is recorded source-unit journal data, not broker reconciliation; currencies are not stored.
- No LLM is required; narrative and metrics are grounded in stored records. No medical conclusions or financial forecasts are generated.

## Validation

Node 22:

```
node --test server/test/command-reports.test.js server/test/command-report-routes.test.js
npm run build
```

Tests cover DST, year rollover, Monday windows, invalid settings, unknown data, time boundaries, privacy exclusions, persisted PDFs, schedule deduplication/restart, email failures/manual retry, and authenticated API download. The PDF was rendered and visually inspected with synthetic sample data. The environment's browser automation daemon failed to start, so no browser interaction pass is claimed. Live deployment and SMTP delivery remain deployment checks.
