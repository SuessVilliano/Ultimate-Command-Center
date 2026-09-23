import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import * as db from "../lib/database.js";
import { registerCommandReportRoutes } from "../routes/command-report-routes.js";

test("private report API denies unauthenticated access, saves preferences and downloads PDF", async () => {
  const old = process.env.REPORTS_ACCESS_TOKEN;
  process.env.REPORTS_ACCESS_TOKEN = "local-test-key";
  db.initDatabase(":memory:");
  const app = express();
  app.use(express.json());
  const stop = registerCommandReportRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/command-reports`;
  const headers = {
    Authorization: "Bearer local-test-key",
    "Content-Type": "application/json",
  };
  try {
    assert.equal((await fetch(base)).status, 401);
    const original = await (await fetch(base, { headers })).json();
    assert.equal(original.settings.timezone, "America/New_York");
    const save = await fetch(base + "/settings", {
      method: "PUT",
      headers,
      body: JSON.stringify({ ...original.settings, includePersonal: false }),
    });
    assert.equal(save.status, 200);
    const generated = await fetch(base + "/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ cadence: "daily" }),
    });
    assert.equal(generated.status, 200);
    const report = await generated.json();
    assert.equal(report.status, "ready");
    assert.equal((await fetch(`${base}/${report.id}/pdf`)).status, 401);
    const pdf = await fetch(`${base}/${report.id}/pdf`, { headers });
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      "%PDF",
    );
    assert.equal(
      (
        await fetch(base + "/generate", {
          method: "POST",
          headers,
          body: JSON.stringify({ cadence: "bad" }),
        })
      ).status,
      400,
    );
    assert.equal((await fetch(`${base}/missing/pdf`, { headers })).status, 404);
    delete process.env.REPORTS_ACCESS_TOKEN;
    assert.equal((await fetch(base, { headers })).status, 503);
  } finally {
    stop();
    await new Promise((resolve) => server.close(resolve));
    db.getDb().close();
    if (old === undefined) delete process.env.REPORTS_ACCESS_TOKEN;
    else process.env.REPORTS_ACCESS_TOKEN = old;
  }
});
