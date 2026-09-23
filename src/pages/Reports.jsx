import React, { useEffect, useState } from "react";
import { FileText, Download, RefreshCw, Bell, Mail } from "lucide-react";
import {
  reportKey,
  reportRequest,
  downloadReport,
} from "../lib/command-reports";

export default function Reports() {
  const [key, setKey] = useState(reportKey),
    [unlocked, setUnlocked] = useState(false),
    [settings, setSettings] = useState(null),
    [reports, setReports] = useState([]),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [emailConfigured, setEmailConfigured] = useState(false);
  const load = async () => {
    const data = await reportRequest();
    setReports(data.reports);
    setSettings(data.settings);
    setEmailConfigured(data.emailConfigured);
    setUnlocked(true);
  };
  useEffect(() => {
    if (reportKey()) load().catch((e) => setError(e.message));
  }, []);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const patch = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const input =
    "w-full rounded-lg border border-slate-500/30 bg-transparent p-2.5";
  const button =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500/30 px-3 py-2 text-sm hover:bg-purple-500/10 disabled:opacity-40";
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-purple-950 p-6 text-white border border-purple-500/25">
        <div className="text-xs tracking-widest uppercase text-cyan-300">
          LIV8 / Your progress, in perspective
        </div>
        <h1 className="text-3xl font-bold mt-2 flex gap-3 items-center">
          <FileText />
          Reports
        </h1>
        <p className="text-slate-300 mt-3">
          Wins, setbacks, metrics and what needs your attention. Clean PDF
          recaps, delivered on your schedule.
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-4"
        >
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl bg-emerald-500/10 p-4">
          {notice}
        </div>
      )}
      {!unlocked ? (
        <form
          className="max-w-md space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              sessionStorage.setItem("liv8_report_key", key);
              await load();
            });
          }}
        >
          <h2 className="text-xl font-semibold">Private report access</h2>
          <p className="text-sm opacity-70">
            Enter the report access key configured on your Command Center
            server. It stays in this browser session.
          </p>
          <input
            aria-label="Report access key"
            type="password"
            className={input}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
          />
          <button disabled={busy} className={button}>
            Unlock reports
          </button>
        </form>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-500/25 p-5 space-y-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-xl font-semibold">Delivery preferences</h2>
              <span className="text-sm opacity-60">
                {emailConfigured
                  ? "Email service connected"
                  : "Email service needs setup"}
              </span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {["daily", "weekly", "monthly"].map((c) => (
                <label
                  key={c}
                  className="rounded-xl border border-slate-500/25 p-4 flex gap-3"
                >
                  <input
                    type="checkbox"
                    checked={settings[c]}
                    onChange={(e) => patch(c, e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold capitalize">{c}</span>
                    <span className="block text-xs opacity-60 mt-1">
                      {c === "daily"
                        ? "Yesterday"
                        : c === "weekly"
                          ? "Prior Monday-Sunday"
                          : "Previous calendar month"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                Delivery time
                <input
                  type="time"
                  className={input}
                  value={settings.time}
                  onChange={(e) => patch("time", e.target.value)}
                />
              </label>
              <label>
                Timezone
                <input
                  className={input}
                  value={settings.timezone}
                  onChange={(e) => patch("timezone", e.target.value)}
                  list="report-timezones"
                />
                <datalist id="report-timezones">
                  <option>America/New_York</option>
                  <option>America/Chicago</option>
                  <option>America/Los_Angeles</option>
                  <option>UTC</option>
                </datalist>
              </label>
            </div>
            <p className="text-xs opacity-65">
              Weekly delivery begins Monday; monthly delivery begins on the
              first. After downtime, the server catches up the latest completed
              period. The server must be running for delivery.
            </p>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.popup}
                  onChange={(e) => patch("popup", e.target.checked)}
                />
                <Bell size={16} />
                In-app notification
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.email}
                  onChange={(e) => patch("email", e.target.checked)}
                />
                <Mail size={16} />
                Email with PDF attachment
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.includePersonal}
                  onChange={(e) => patch("includePersonal", e.target.checked)}
                />
                Include health, journal counts and reflections
              </label>
            </div>
            {settings.email && (
              <label className="block">
                Recipient
                <input
                  type="email"
                  className={input}
                  value={settings.recipient}
                  onChange={(e) => patch("recipient", e.target.value)}
                  placeholder="Your email address"
                />
                <span className="text-xs opacity-65">
                  The PDF includes personal data when the option above is
                  enabled.
                </span>
              </label>
            )}
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await reportRequest("/settings", {
                    method: "PUT",
                    body: JSON.stringify(settings),
                  });
                  setNotice("Delivery preferences saved.");
                })
              }
            >
              Save preferences
            </button>
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-xl font-semibold">Report archive</h2>
              <button
                className={button}
                disabled={busy}
                onClick={() => run(load)}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {["daily", "weekly", "monthly"].map((c) => (
                <button
                  className={button}
                  disabled={busy}
                  key={c}
                  onClick={() =>
                    run(async () => {
                      const row = await reportRequest("/generate", {
                        method: "POST",
                        body: JSON.stringify({ cadence: c }),
                      });
                      await load();
                      const data = await reportRequest(`/${row.id}`);
                      setPreview(data.report);
                      setNotice(
                        "PDF generated and saved. Manual generation does not send email.",
                      );
                    })
                  }
                >
                  Generate {c}
                </button>
              ))}
            </div>
            <p className="text-xs opacity-60">
              Generation uses saved preferences and completed calendar periods.
              The archive displays the 100 most recent reports.
            </p>
            {!reports.length && (
              <div className="p-8 rounded-xl border border-dashed border-slate-500/30 text-center opacity-65">
                Your first recap starts here. Generate a report now or wait for
                your scheduled delivery.
              </div>
            )}
            {reports.map((r) => (
              <article
                key={r.id}
                className="rounded-xl border border-slate-500/25 p-4 flex flex-wrap justify-between gap-3"
              >
                <div>
                  <div className="font-semibold capitalize">
                    {r.cadence} recap{" "}
                    <span className="text-xs opacity-60">/ {r.status}</span>
                  </div>
                  <div className="text-sm opacity-70">
                    {r.start} to {r.end} (end exclusive)
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    Created {new Date(r.createdAt).toLocaleString()} · Email:{" "}
                    {r.emailStatus}
                  </div>
                  {(r.error || r.emailError) && (
                    <p className="text-sm text-red-400">
                      {r.error || r.emailError}
                    </p>
                  )}
                </div>
                {r.status === "ready" && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          setPreview((await reportRequest(`/${r.id}`)).report);
                          await reportRequest(`/${r.id}/seen`, {
                            method: "POST",
                          });
                        })
                      }
                    >
                      Overview
                    </button>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          downloadReport(
                            r.id,
                            `liv8-${r.cadence}-${r.start}.pdf`,
                          ),
                        )
                      }
                    >
                      <Download size={16} />
                      PDF
                    </button>
                    {settings.email &&
                      ["failed", "not_requested"].includes(r.emailStatus) && (
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await reportRequest(`/${r.id}/email`, {
                                method: "POST",
                              });
                              await load();
                            })
                          }
                        >
                          Send email
                        </button>
                      )}
                  </div>
                )}
              </article>
            ))}
          </section>
          {preview && (
            <section className="rounded-2xl border border-purple-500/30 p-5 space-y-5">
              <h2 className="text-xl font-semibold capitalize">
                {preview.cadence} overview · {preview.period.label}
              </h2>
              <p>{preview.summary}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {preview.metrics.map((m) => (
                  <div
                    className="rounded-xl bg-purple-500/5 border border-purple-500/15 p-3"
                    key={m.label}
                  >
                    <div className="text-xs opacity-70">{m.label}</div>
                    <div className="text-2xl font-bold mt-1">
                      {m.value ?? "—"}
                    </div>
                    <div className="text-xs opacity-60">
                      {m.delta === null
                        ? "No comparison available"
                        : `${m.delta > 0 ? "+" : ""}${m.delta} vs prior period`}
                    </div>
                  </div>
                ))}
              </div>
              {[
                ["Wins", preview.wins],
                ["Losses and setbacks", preview.setbacks],
                [
                  "Current priorities",
                  preview.current.map((x) => `${x.status}: ${x.title}`),
                ],
              ].map(([title, items]) => (
                <div key={title}>
                  <h3 className="font-semibold">{title}</h3>
                  <ul className="list-disc pl-5 text-sm mt-2 space-y-1">
                    {(items.length ? items : ["No records available."]).map(
                      (v, i) => (
                        <li key={i}>{v}</li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
              <h3 className="font-semibold">Source coverage</h3>
              {preview.coverage.map((c) => (
                <div className="text-sm" key={c.source}>
                  {c.source}: {c.status}
                </div>
              ))}
              {preview.notes.map((n) => (
                <p key={n} className="text-xs opacity-65">
                  {n}
                </p>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
