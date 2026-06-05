import { apiFetch } from "./client";

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  action: "create" | "update" | "delete" | "share_link_access";
  actor_type: "user" | "guest";
  actor_label: string;
  section: string | null;
  record_id: string | null;
  detail: string | null;
}

export interface AuditLogFilters {
  page?: number;
  action?: string;
  actor_type?: string;
  section?: string;
  date_from?: string;
  date_to?: string;
}

export async function listAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.action) params.set("action", filters.action);
  if (filters.actor_type) params.set("actor_type", filters.actor_type);
  if (filters.section) params.set("section", filters.section);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const url = `/api/audit-log${params.size ? `?${params}` : ""}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed to load audit log");
  return res.json();
}
