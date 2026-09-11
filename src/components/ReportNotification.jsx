import React, { useEffect, useState } from "react";
import { reportKey, reportRequest } from "../lib/command-reports";
export default function ReportNotification({ onNavigate }) {
  const [report, setReport] = useState(null);
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!reportKey()) return;
      try {
        const data = await reportRequest();
        if (active)
          setReport(
            data.settings.popup
              ? data.reports.find((r) => r.status === "ready" && !r.seen) ||
                  null
              : null,
          );
      } catch {
        /* Reports may not be unlocked in this session. */
      }
    };
    check();
    const timer = setInterval(check, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  if (!report) return null;
  const dismiss = () => {
    reportRequest(`/${report.id}/seen`, { method: "POST" })
      .then(() => setReport(null))
      .catch(() => setReport(null));
  };
  return (
    <div
      role="status"
      className="fixed bottom-5 left-5 z-50 max-w-sm rounded-xl bg-slate-900 text-white border border-purple-400/50 p-4 shadow-xl"
    >
      <div className="font-semibold capitalize">
        Your {report.cadence} recap is ready
      </div>
      <p className="text-sm text-slate-300 mt-1">
        Review your progress and download the PDF.
      </p>
      <div className="flex gap-4 mt-3">
        <button
          className="text-cyan-300"
          onClick={() => {
            dismiss();
            onNavigate("reports");
          }}
        >
          Open reports
        </button>
        <button className="text-slate-400" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
