import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export const CADENCES = ["daily", "weekly", "monthly"];
export const defaultSettings = () => ({
  timezone: "America/New_York",
  time: "07:00",
  daily: true,
  weekly: true,
  monthly: true,
  popup: true,
  email: false,
  recipient: "",
  includePersonal: true,
});
const localParts = (date, timezone) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
const dateKey = (p) => `${p.year}-${p.month}-${p.day}`;
const shift = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
function midnight(day, timezone) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let value = target;
  for (let i = 0; i < 5; i++) {
    const p = localParts(new Date(value), timezone);
    const delta =
      target - Date.parse(`${dateKey(p)}T${p.hour}:${p.minute}:00Z`);
    if (!delta) break;
    value += delta;
  }
  return new Date(value).toISOString();
}
export function periodFor(cadence, now, timezone) {
  if (!CADENCES.includes(cadence)) throw new Error("Invalid report cadence");
  const today = dateKey(localParts(now, timezone));
  let endDay = today;
  let startDay;
  if (cadence === "daily") startDay = shift(endDay, -1);
  if (cadence === "weekly") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    endDay = shift(today, -((weekday + 6) % 7));
    startDay = shift(endDay, -7);
  }
  if (cadence === "monthly") {
    endDay = `${today.slice(0, 7)}-01`;
    startDay = `${shift(endDay, -1).slice(0, 7)}-01`;
  }
  return {
    startDay,
    endDay,
    start: midnight(startDay, timezone),
    end: midnight(endDay, timezone),
    label: `${startDay} through ${shift(endDay, -1)}`,
  };
}
export function validateSettings(input) {
  const s = { ...defaultSettings(), ...input };
  new Intl.DateTimeFormat("en", { timeZone: s.timezone }).format();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))
    throw new Error("Choose a valid delivery time");
  for (const key of [...CADENCES, "popup", "email", "includePersonal"])
    if (typeof s[key] !== "boolean") throw new Error(`Invalid ${key} setting`);
  s.recipient = String(s.recipient || "").trim();
  if (s.email && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s.recipient))
    throw new Error("Enter one valid recipient email");
  return Object.fromEntries(
    Object.keys(defaultSettings()).map((key) => [key, s[key]]),
  );
}

export function createReportService(
  database,
  {
    sendEmail = async () => {
      throw new Error("Email delivery is not configured");
    },
    notify = () => ({ success: true }),
  } = {},
) {
  database.exec(`CREATE TABLE IF NOT EXISTS command_report_settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS command_reports (
      id TEXT PRIMARY KEY, run_key TEXT UNIQUE NOT NULL, cadence TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
      created_at TEXT NOT NULL, status TEXT NOT NULL, data TEXT, pdf BLOB, error TEXT,
      email_status TEXT NOT NULL DEFAULT 'not_requested', email_error TEXT, email_recipient TEXT,
      notified INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL DEFAULT 0);
  `);
  let busy = false;
  const getSettings = () =>
    JSON.parse(
      database
        .prepare("SELECT value FROM command_report_settings WHERE id=1")
        .get()?.value || JSON.stringify(defaultSettings()),
    );
  const saveSettings = (input) => {
    const s = validateSettings(input);
    database
      .prepare(
        "INSERT INTO command_report_settings VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      )
      .run(JSON.stringify(s));
    return s;
  };
  const hasTable = (name) =>
    !!database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(name);
  function collect(period, personal) {
    const coverage = [];
    function rows(table, column, label, dates = false) {
      if (!hasTable(table)) {
        coverage.push({ source: label, status: "Unavailable", count: null });
        return [];
      }
      try {
        const expr = dates ? column : `datetime(${column})`;
        const a = dates ? period.startDay : period.start;
        const b = dates ? period.endDay : period.end;
        const data = database
          .prepare(
            `SELECT * FROM ${table} WHERE ${expr} >= ${dates ? "?" : "datetime(?)"} AND ${expr} < ${dates ? "?" : "datetime(?)"} ORDER BY ${column}`,
          )
          .all(a, b);
        coverage.push({
          source: label,
          status: data.length ? "Recorded data" : "No records in this period",
          count: data.length,
        });
        return data;
      } catch {
        coverage.push({
          source: label,
          status: "Source schema unavailable",
          count: null,
        });
        return [];
      }
    }
    const work = rows("agent_work_items", "updated_at", "Agent work updates");
    const sync = rows(
      "sync_history",
      "created_at",
      "Nifty / connected task sync",
    );
    const activity = rows("unified_inbox", "created_at", "Connected activity");
    const trades = rows("hs_trades", "ts", "Recorded trades");
    const reflections = personal
      ? rows("hs_reflections", "date", "Daily reflections", true)
      : [];
    const health = personal
      ? rows(
          "hs_apple_health_daily",
          "date",
          "Apple Health daily records",
          true,
        )
      : [];
    const journal = personal
      ? rows("life_journal_entries", "date", "Journal", true)
      : [];
    const metric = (label, value, source) => ({
      label,
      value:
        coverage.find((c) => c.source === source)?.count === null
          ? null
          : value,
      source,
    });
    const recordedPnl = trades.filter(
      (t) => t.pnl !== null && Number.isFinite(Number(t.pnl)),
    );
    const avg = (key) => {
      const values = health
        .filter((h) => h[key] !== null && Number.isFinite(Number(h[key])))
        .map((h) => Number(h[key]));
      return values.length
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
            10
        : null;
    };
    const metrics = [
      metric(
        "Completed agent items updated",
        work.filter((w) => w.status === "completed").length,
        "Agent work updates",
      ),
      metric(
        "Blocked agent items updated",
        work.filter((w) => w.status === "blocked").length,
        "Agent work updates",
      ),
      metric(
        "Failed sync events",
        sync.filter((s) => ["failed", "error"].includes(s.status)).length,
        "Nifty / connected task sync",
      ),
      metric(
        "Connected activity records",
        activity.length,
        "Connected activity",
      ),
      metric("Recorded trades", trades.length, "Recorded trades"),
      metric(
        "Trades with positive P&L",
        recordedPnl.filter((t) => t.pnl > 0).length,
        "Recorded trades",
      ),
      metric(
        "Trades with negative P&L",
        recordedPnl.filter((t) => t.pnl < 0).length,
        "Recorded trades",
      ),
      metric(
        "Recorded P&L (source units)",
        recordedPnl.length
          ? Math.round(
              recordedPnl.reduce((a, t) => a + Number(t.pnl), 0) * 100,
            ) / 100
          : null,
        "Recorded trades",
      ),
    ];
    if (personal)
      metrics.push(
        metric(
          "Average daily steps",
          avg("steps"),
          "Apple Health daily records",
        ),
        metric(
          "Average sleep hours",
          avg("sleep_hours"),
          "Apple Health daily records",
        ),
        metric("Journal entries", journal.length, "Journal"),
      );
    const wins = [
      ...work
        .filter((w) => w.status === "completed")
        .map((w) => `Completed: ${w.title}`),
      ...reflections
        .filter((r) => r.went_well)
        .map((r) => `${r.date}: ${r.went_well}`),
    ];
    const setbacks = [
      ...work
        .filter((w) => w.status === "blocked")
        .map((w) => `Blocked: ${w.title}`),
      ...sync
        .filter((s) => ["error", "failed"].includes(s.status))
        .map(
          (s) => `${s.source_platform || "Task"} sync ${s.status}: ${s.action}`,
        ),
      ...reflections
        .filter((r) => r.did_not)
        .map((r) => `${r.date}: ${r.did_not}`),
    ];
    const adjustments = reflections
      .filter((r) => r.adjustment)
      .map((r) => r.adjustment);
    return {
      metrics,
      wins: wins.slice(0, 20),
      setbacks: setbacks.slice(0, 20),
      adjustments: adjustments.slice(0, 10),
      coverage,
      activity: activity
        .slice(-25)
        .reverse()
        .map((a) => ({ title: a.title, source: a.source, at: a.created_at })),
    };
  }
  function buildData(cadence, now, settings) {
    const period = periodFor(cadence, now, settings.timezone);
    const previous = periodFor(
      cadence,
      new Date(period.start),
      settings.timezone,
    );
    const data = collect(period, settings.includePersonal);
    const prior = collect(previous, settings.includePersonal);
    data.metrics = data.metrics.map((m, i) => ({
      ...m,
      previous: prior.metrics[i]?.value ?? null,
      delta:
        m.value !== null && prior.metrics[i]?.value != null
          ? Math.round((m.value - prior.metrics[i].value) * 100) / 100
          : null,
    }));
    const current = hasTable("agent_work_items")
      ? database
          .prepare(
            "SELECT title,status,priority FROM agent_work_items WHERE status IN ('queued','working','blocked','awaiting_approval','approved') ORDER BY CASE status WHEN 'blocked' THEN 0 WHEN 'awaiting_approval' THEN 1 ELSE 2 END, updated_at DESC LIMIT 15",
          )
          .all()
      : [];
    const total = data.coverage.reduce((n, c) => n + (c.count || 0), 0);
    return {
      ...data,
      cadence,
      period,
      previousPeriod: previous.label,
      timezone: settings.timezone,
      generatedAt: now.toISOString(),
      includePersonal: settings.includePersonal,
      current,
      summary: total
        ? `${total} source records reviewed across ${data.coverage.filter((c) => c.count > 0).length} reporting feeds. ${current.length ? `${current.length} current work items are highlighted for attention.` : "No current work items found in the agent queue."}`
        : "No recorded activity was available for this period. Check the source coverage before interpreting these results.",
      notes: [
        "Source records can overlap; their total is not a count of unique actions.",
        "Agent results reflect current status of items updated in the period, not a historical completion ledger.",
        "Trade P&L is recorded journal data in source units; it is not a verified broker statement. Currency is not stored, so do not combine accounts with different currencies.",
        "GHL sales, affiliate conversions, revenue, and calendar attendance are not inferred from inbox records. Dedicated historical feeds are not available in this report.",
        "Current priorities are a snapshot at generation time. Reports use locally stored data; empty periods do not prove that no external activity occurred.",
        ...(settings.includePersonal
          ? [
              "Health averages cover available daily records only; journal text is excluded, while daily reflection text is included.",
            ]
          : ["Personal health, journal and reflection data excluded."]),
      ],
    };
  }
  const metadata = (row) =>
    row && {
      id: row.id,
      cadence: row.cadence,
      start: row.period_start,
      end: row.period_end,
      createdAt: row.created_at,
      status: row.status,
      error: row.error,
      emailStatus: row.email_status,
      emailError: row.email_error,
      seen: !!row.seen,
    };
  const list = () =>
    database
      .prepare(
        "SELECT id,cadence,period_start,period_end,created_at,status,error,email_status,email_error,seen FROM command_reports ORDER BY created_at DESC LIMIT 100",
      )
      .all()
      .map(metadata);
  const get = (id) =>
    database.prepare("SELECT * FROM command_reports WHERE id=?").get(id);
  async function deliver(row, settings) {
    if (settings.popup && !row.notified) {
      const result = notify({
        type: "report",
        title: `${row.cadence} Command Center recap ready`,
        message: "Your PDF report is ready in Reports.",
        source: "command-reports",
        link: "/?page=reports",
      });
      if (result?.success)
        database
          .prepare("UPDATE command_reports SET notified=1 WHERE id=?")
          .run(row.id);
    }
    if (!settings.email || row.email_status !== "not_requested") return;
    if (!settings.includePersonal && JSON.parse(row.data).includePersonal) {
      database
        .prepare(
          "UPDATE command_reports SET email_status='failed',email_error=? WHERE id=?",
        )
        .run(
          "This archived PDF includes personal data. Generate a new report with personal data excluded before emailing.",
          row.id,
        );
      return;
    }
    const claimed = database
      .prepare(
        "UPDATE command_reports SET email_status='sending',email_recipient=? WHERE id=? AND email_status='not_requested'",
      )
      .run(settings.recipient, row.id);
    if (!claimed.changes) return;
    try {
      await sendEmail({
        recipient: settings.recipient,
        filename: `liv8-${row.cadence}-${row.period_start}.pdf`,
        pdf: row.pdf,
        report: JSON.parse(row.data),
      });
      database
        .prepare(
          "UPDATE command_reports SET email_status='sent',email_error=NULL WHERE id=?",
        )
        .run(row.id);
    } catch (error) {
      database
        .prepare(
          "UPDATE command_reports SET email_status='failed',email_error=? WHERE id=?",
        )
        .run(error.message, row.id);
    }
  }
  async function generate(
    cadence,
    { now = new Date(), scheduled = false } = {},
  ) {
    const settings = getSettings();
    const period = periodFor(cadence, now, settings.timezone);
    const key = scheduled
      ? `${cadence}:${period.start}:${settings.timezone}`
      : randomUUID();
    let row = database
      .prepare("SELECT * FROM command_reports WHERE run_key=?")
      .get(key);
    if (row?.status === "ready") {
      if (scheduled) await deliver(row, settings);
      return metadata(get(row.id));
    }
    if (
      row?.status === "building" &&
      Date.now() - Date.parse(row.created_at) < 600000
    )
      return metadata(row);
    const id = row?.id || randomUUID();
    database
      .prepare(
        `INSERT INTO command_reports (id,run_key,cadence,period_start,period_end,created_at,status) VALUES (?,?,?,?,?,?,'building')
      ON CONFLICT(run_key) DO UPDATE SET status='building',error=NULL,created_at=excluded.created_at`,
      )
      .run(
        id,
        key,
        cadence,
        period.startDay,
        period.endDay,
        new Date().toISOString(),
      );
    try {
      const data = buildData(cadence, now, settings);
      const pdf = await renderReportPDF(data);
      database
        .prepare(
          "UPDATE command_reports SET status='ready',data=?,pdf=? WHERE id=?",
        )
        .run(JSON.stringify(data), pdf, id);
    } catch (error) {
      database
        .prepare(
          "UPDATE command_reports SET status='failed',error=? WHERE id=?",
        )
        .run(error.message, id);
      throw error;
    }
    if (scheduled) await deliver(get(id), settings);
    return metadata(get(id));
  }
  async function tick(now = new Date()) {
    if (busy) return;
    busy = true;
    try {
      const s = getSettings(),
        p = localParts(now, s.timezone);
      if (`${p.hour}:${p.minute}` < s.time) return;
      // Every tick catches up the latest completed period, including after downtime.
      for (const cadence of CADENCES)
        if (s[cadence]) await generate(cadence, { now, scheduled: true });
    } finally {
      busy = false;
    }
  }
  return {
    getSettings,
    saveSettings,
    buildData,
    generate,
    tick,
    list,
    get,
    markSeen: (id) =>
      database.prepare("UPDATE command_reports SET seen=1 WHERE id=?").run(id),
    async retryEmail(id) {
      const row = get(id);
      if (!row || row.status !== "ready")
        throw new Error("Report is not ready");
      if (row.email_status === "sent" || row.email_status === "sending")
        throw new Error(
          "Email is sent or delivery is still uncertain; inspect delivery before retrying",
        );
      database
        .prepare(
          "UPDATE command_reports SET email_status='not_requested' WHERE id=?",
        )
        .run(id);
      await deliver(get(id), getSettings());
      return metadata(get(id));
    },
  };
}

export function renderReportPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 48,
      bufferPages: true,
      info: {
        Title: `LIV8 ${data.cadence} Command Center recap`,
        Author: "LIV8 Command Center",
      },
    });
    doc.registerFont(
      "ReportRegular",
      fileURLToPath(new URL("../assets/fonts/DejaVuSans.ttf", import.meta.url)),
    );
    doc.registerFont(
      "ReportBold",
      fileURLToPath(
        new URL("../assets/fonts/DejaVuSans-Bold.ttf", import.meta.url),
      ),
    );
    doc.font("ReportRegular");
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const clean = (s) =>
      String(s ?? "")
        .replace(/[^\x20-\x7E\n]/g, " ")
        .slice(0, 1800);
    const room = (height = 60) => {
      if (doc.y + height > 725) doc.addPage();
    };
    const heading = (title) => {
      room(65);
      doc
        .moveDown(0.7)
        .font("ReportBold")
        .fontSize(14)
        .fillColor("#6d28d9")
        .text(title, 48, doc.y, { width: 516 });
      doc.moveDown(0.5);
    };
    const para = (text) => {
      doc
        .font("ReportRegular")
        .fontSize(10)
        .fillColor("#334155")
        .text(clean(text), 48, doc.y, { width: 516, lineGap: 3 });
      doc.moveDown(0.45);
    };
    doc.rect(0, 0, 612, 125).fill("#101827");
    doc.fillColor("#a5f3fc").fontSize(10).text("LIV8 / COMMAND CENTER", 48, 34);
    doc
      .fillColor("#ffffff")
      .font("ReportBold")
      .fontSize(27)
      .text(
        `${data.cadence[0].toUpperCase() + data.cadence.slice(1)} recap`,
        48,
        55,
      );
    doc
      .font("ReportRegular")
      .fontSize(10)
      .fillColor("#cbd5e1")
      .text(`${data.period.label} | ${data.timezone}`, 48, 94);
    doc.y = 148;
    heading("Overview");
    para(data.summary);
    heading("Metrics / previous period comparison");
    para(
      `Previous period: ${data.previousPeriod}. A dash means unavailable, not zero.`,
    );
    for (const m of data.metrics) {
      room(38);
      const y = doc.y;
      doc.rect(48, y, 516, 33).fill("#f1f5f9");
      doc
        .font("ReportRegular")
        .fontSize(10)
        .fillColor("#334155")
        .text(clean(m.label), 58, y + 8, { width: 320 });
      doc
        .font("ReportBold")
        .fontSize(12)
        .text(m.value === null ? "-" : String(m.value), 385, y + 7, {
          width: 65,
          align: "right",
        });
      doc
        .font("ReportRegular")
        .fontSize(9)
        .text(
          m.delta === null
            ? "No baseline"
            : `${m.delta > 0 ? "+" : ""}${m.delta} vs prior`,
          455,
          y + 9,
          { width: 98, align: "right" },
        );
      doc.y = y + 38;
    }
    doc.addPage();
    for (const [title, items, fallback] of [
      ["Wins", data.wins, "No wins recorded in the available feeds."],
      [
        "Losses and setbacks",
        data.setbacks,
        "No setbacks recorded in the available feeds.",
      ],
      [
        "Current priorities",
        data.current.map((x) => `${x.status}: ${x.title}`),
        "No current agent queue items available.",
      ],
      [
        "Adjustments and next steps",
        data.adjustments.length
          ? data.adjustments
          : [
              "Review blocked items and pending approvals.",
              "Check missing source data before acting on the metrics.",
            ],
        "",
      ],
      [
        "Recent connected activity",
        data.activity.map((a) => `${a.source} | ${a.title}`),
        "No connected activity records available.",
      ],
    ]) {
      heading(title);
      for (const item of items.length ? items : [fallback]) {
        room(45);
        para(`- ${item}`);
      }
    }
    doc.addPage();
    heading("Source coverage");
    for (const c of data.coverage)
      para(
        `${c.source}: ${c.status}${c.count === null ? "" : ` (${c.count})`}`,
      );
    heading("How to read this report");
    data.notes.forEach(para);
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .font("ReportRegular")
        .fontSize(8)
        .fillColor("#64748b")
        .text(`LIV8 | Private recap | ${i + 1} / ${pages.count}`, 48, 751, {
          lineBreak: false,
        });
    }
    doc.end();
  });
}
