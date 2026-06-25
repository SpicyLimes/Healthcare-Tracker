import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";

export type SubmissionAction = "create" | "update" | "delete";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  submitted_by: string | null;
  submitted_by_label: string;
  section: string;
  action: SubmissionAction;
  record_id: string | null;
  payload: Record<string, unknown>;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_by_label: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export async function listSubmissions(status?: SubmissionStatus): Promise<Submission[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await apiFetch(`/api/submissions?${params}`);
  if (!res.ok) throw new Error("Failed to load submissions");
  return res.json();
}

export async function pendingSubmissionCount(): Promise<number> {
  const res = await apiFetch("/api/submissions/pending-count");
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count as number;
}

export async function approveSubmission(id: string): Promise<Submission> {
  const res = await apiFetch(`/api/submissions/${id}/approve`, {
    method: "POST",
    headers: { ...csrfHeader() },
  });
  if (!res.ok) throw new Error("Failed to approve submission");
  return res.json();
}

export async function rejectSubmission(id: string, rejectReason?: string): Promise<Submission> {
  const res = await apiFetch(`/api/submissions/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ reject_reason: rejectReason ?? null }),
  });
  if (!res.ok) throw new Error("Failed to reject submission");
  return res.json();
}
