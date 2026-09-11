import { timingSafeEqual } from "node:crypto";
import { createReportService } from "../lib/command-reports.js";
import * as db from "../lib/database.js";
import * as email from "../lib/email-service.js";
import { addNotification } from "../lib/unified-inbox.js";

export function reportAccess(req, res, next) {
  const expected = process.env.REPORTS_ACCESS_TOKEN;
  if (!expected)
    return res.status(503).json({
      error:
        "Set REPORTS_ACCESS_TOKEN on the server to enable private reports.",
    });
  const actual = String(req.headers.authorization || "").replace(
    /^Bearer /,
    "",
  );
  if (
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return res
      .status(401)
      .json({ error: "Unlock reports with your report access key." });
  res.set("Cache-Control", "no-store");
  next();
}
export function registerCommandReportRoutes(app) {
  email.initEmailService();
  let service;
  const getService = () =>
    (service ||= createReportService(db.getDb(), {
      sendEmail: email.sendCommandReport,
      notify: addNotification,
    }));
  app.use("/api/command-reports", reportAccess);
  const handler = (fn) => async (req, res) => {
    try {
      await fn(req, res, getService());
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
  app.get(
    "/api/command-reports",
    handler((req, res, s) =>
      res.json({
        reports: s.list(),
        settings: s.getSettings(),
        emailConfigured: email.isEmailEnabled(),
      }),
    ),
  );
  app.put(
    "/api/command-reports/settings",
    handler((req, res, s) => {
      if (req.body.email && !email.isEmailEnabled())
        throw new Error(
          "Configure SMTP_HOST, SMTP_USER and SMTP_PASS on the server before enabling email delivery.",
        );
      res.json({ settings: s.saveSettings(req.body) });
    }),
  );
  app.post(
    "/api/command-reports/generate",
    handler(async (req, res, s) =>
      res.json(await s.generate(req.body.cadence)),
    ),
  );
  app.get(
    "/api/command-reports/:id/pdf",
    handler((req, res, s) => {
      const row = s.get(req.params.id);
      if (!row || row.status !== "ready")
        return res.status(404).json({ error: "Report not found or not ready" });
      res.set("Content-Type", "application/pdf");
      res.set(
        "Content-Disposition",
        `attachment; filename="liv8-${row.cadence}-${row.period_start}.pdf"`,
      );
      res.send(row.pdf);
    }),
  );
  app.get(
    "/api/command-reports/:id",
    handler((req, res, s) => {
      const row = s.get(req.params.id);
      if (!row) return res.status(404).json({ error: "Report not found" });
      res.json({ report: row.data ? JSON.parse(row.data) : null });
    }),
  );
  app.post(
    "/api/command-reports/:id/seen",
    handler((req, res, s) => {
      s.markSeen(req.params.id);
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/command-reports/:id/email",
    handler(async (req, res, s) => {
      if (!s.getSettings().email)
        throw new Error("Enable email delivery in report settings first");
      res.json(await s.retryEmail(req.params.id));
    }),
  );
  const tick = () => {
    if (!process.env.REPORTS_ACCESS_TOKEN) return;
    try {
      getService()
        .tick()
        .catch((error) =>
          console.error("Command report scheduler:", error.message),
        );
    } catch (error) {
      console.error("Command report startup:", error.message);
    }
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  // Delayed startup lets all source tables and email configuration initialize.
  const startup = setTimeout(tick, 5000);
  startup.unref();
  return () => {
    clearInterval(timer);
    clearTimeout(startup);
  };
}
