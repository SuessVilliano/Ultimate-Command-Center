import { API_URL } from "../config";
export const reportKey = () => sessionStorage.getItem("liv8_report_key") || "";
export async function reportRequest(path = "", options = {}) {
  const response = await fetch(`${API_URL}/api/command-reports${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${reportKey()}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Report request failed (${response.status})`);
  }
  return options.pdf ? response.blob() : response.json();
}
export async function downloadReport(id, filename) {
  const blob = await reportRequest(`/${id}/pdf`, { pdf: true });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
