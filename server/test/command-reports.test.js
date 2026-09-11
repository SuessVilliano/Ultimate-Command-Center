import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  createReportService,
  defaultSettings,
  periodFor,
  validateSettings,
} from "../lib/command-reports.js";

test("calendar windows respect DST, Monday boundaries and year rollover", () => {
  const spring = periodFor(
    "daily",
    new Date("2026-03-09T12:00:00Z"),
    "America/New_York",
  );
  assert.equal(spring.start, "2026-03-08T05:00:00.000Z");
  assert.equal(spring.end, "2026-03-09T04:00:00.000Z");
  const fall = periodFor(
    "daily",
    new Date("2026-11-02T12:00:00Z"),
    "America/New_York",
  );
  assert.equal((Date.parse(fall.end) - Date.parse(fall.start)) / 3600000, 25);
  assert.equal(
    periodFor("weekly", new Date("2026-09-11T12:00:00Z"), "America/New_York")
      .startDay,
    "2026-08-31",
  );
  assert.equal(
    periodFor("monthly", new Date("2026-01-01T12:00:00Z"), "America/New_York")
      .startDay,
    "2025-12-01",
  );
  assert.equal(
    periodFor("daily", new Date("2026-09-11T12:00:00Z"), "Asia/Kolkata").start,
    "2026-09-09T18:30:00.000Z",
  );
});
test("invalid schedules and recipients are rejected", () => {
  for (const input of [
    { time: "24:00" },
    { timezone: "invalid" },
    { email: true, recipient: "a@b.com,c@d.com" },
    { daily: "true" },
  ])
    assert.throws(() => validateSettings(input));
});
function fixture() {
  const d = new Database(":memory:");
  d.exec(`CREATE TABLE agent_work_items (title TEXT,status TEXT,priority TEXT,updated_at TEXT);
 CREATE TABLE hs_trades (ts TEXT,pnl REAL);
 CREATE TABLE hs_apple_health_daily (date TEXT,steps INTEGER,sleep_hours REAL);
 CREATE TABLE hs_reflections (date TEXT,went_well TEXT,did_not TEXT,adjustment TEXT);
 INSERT INTO agent_work_items VALUES ('Finished follow-up','completed','medium','2026-09-10 15:00:00'),('Waiting on CRM access','blocked','high','2026-09-10T16:00:00Z'),('Boundary excluded','completed','medium','2026-09-11T04:00:00Z');
 INSERT INTO hs_trades VALUES ('2026-09-10 12:00:00',100),('2026-09-10 13:00:00',-25),('2026-09-10 14:00:00',NULL);
 INSERT INTO hs_apple_health_daily VALUES ('2026-09-10',NULL,7);
 INSERT INTO hs_reflections VALUES ('2026-09-10','Kept my commitments','Missed a follow-up','Prepare the next day before signing off');`);
  return d;
}
test("period data excludes boundary records, preserves unknowns and separates current priorities", () => {
  const d = fixture();
  const s = createReportService(d);
  const data = s.buildData(
    "daily",
    new Date("2026-09-11T12:00:00Z"),
    defaultSettings(),
  );
  const value = (label) => data.metrics.find((m) => m.label === label).value;
  assert.equal(value("Completed agent items updated"), 1);
  assert.equal(value("Recorded P&L (source units)"), 75);
  assert.equal(value("Average daily steps"), null);
  assert.equal(value("Failed sync events"), null);
  assert.equal(data.current[0].title, "Waiting on CRM access");
  assert.equal(data.wins.length, 2);
  const privateOff = s.buildData("daily", new Date("2026-09-11T12:00:00Z"), {
    ...defaultSettings(),
    includePersonal: false,
  });
  assert(!privateOff.coverage.some((c) => c.source.includes("Health")));
  assert(!privateOff.wins.includes("Kept my commitments"));
  d.close();
});
test("scheduler persists PDFs and deduplicates notification and email across restart", async () => {
  const d = fixture();
  let sends = 0,
    notifications = 0;
  const options = {
    sendEmail: async () => {
      sends++;
    },
    notify: () => {
      notifications++;
      return { success: true };
    },
  };
  let s = createReportService(d, options);
  s.saveSettings({
    ...defaultSettings(),
    weekly: false,
    monthly: false,
    email: true,
    recipient: "owner@example.com",
  });
  const now = new Date("2026-09-11T12:00:00Z");
  await Promise.all([s.tick(now), s.tick(now)]);
  assert.equal(sends, 1);
  assert.equal(notifications, 1);
  assert.equal(s.list().length, 1);
  const row = s.get(s.list()[0].id);
  assert.equal(Buffer.from(row.pdf).subarray(0, 4).toString(), "%PDF");
  s = createReportService(d, options);
  await s.tick(now);
  assert.equal(sends, 1);
  s.markSeen(row.id);
  assert.equal(s.list()[0].seen, true);
  d.close();
});
test("delivery failure retains PDF and requires explicit retry", async () => {
  const d = fixture();
  let attempts = 0;
  const s = createReportService(d, {
    sendEmail: async () => {
      attempts++;
      throw new Error("SMTP unavailable");
    },
  });
  s.saveSettings({
    ...defaultSettings(),
    weekly: false,
    monthly: false,
    email: true,
    recipient: "owner@example.com",
  });
  const now = new Date("2026-09-11T12:00:00Z");
  await s.tick(now);
  await s.tick(now);
  assert.equal(attempts, 1);
  assert.equal(s.list()[0].status, "ready");
  assert.equal(s.list()[0].emailStatus, "failed");
  await s.retryEmail(s.list()[0].id);
  assert.equal(attempts, 2);
  d.close();
});
test("manual reports never send email and schedules wait until local delivery time", async () => {
  const d = fixture();
  let sends = 0;
  const s = createReportService(d, {
    sendEmail: async () => {
      sends++;
    },
  });
  s.saveSettings({
    ...defaultSettings(),
    email: true,
    recipient: "owner@example.com",
  });
  await s.tick(new Date("2026-09-11T10:59:00Z"));
  assert.equal(s.list().length, 0);
  await s.generate("daily", { now: new Date("2026-09-11T12:00:00Z") });
  assert.equal(sends, 0);
  d.close();
});
