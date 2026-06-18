// frontend/src/api/summary.ts
import { csrfHeader } from "./csrf";

export interface SummaryRequest {
  sections: string[];
  include_patient_header?: boolean;
  date_from?: string | null;
  date_to?: string | null;
  prepared_for?: string | null;
  title?: string;
}

/** Admin: POST selection, return rendered HTML string. */
export async function generateSummary(req: SummaryRequest): Promise<string> {
  const res = await fetch("/api/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to generate summary");
  return res.text();
}

/** Guest: POST selection with share token, return rendered HTML string. */
export async function generateGuestSummary(req: SummaryRequest, token: string): Promise<string> {
  const res = await fetch(`/api/summary/guest?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to generate summary");
  return res.text();
}

/** Open rendered HTML in a new tab for printing / save-as-PDF. */
export function openSummaryInNewTab(html: string): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay to allow the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
