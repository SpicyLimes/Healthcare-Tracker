import { apiFetch } from "./client";

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  action: string;
  actor_type: "user" | "guest";
  actor_label: string;
  section: string | null;
  record_id: string | null;
  detail: string | null;
}

export interface AuditLogFilters {
  action?: string;
  actor_type?: string;
  section?: string;
  date_from?: string;
  date_to?: string;
}

export async function listAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  params.set("page_size", "500");
  if (filters.action) params.set("action", filters.action);
  if (filters.actor_type) params.set("actor_type", filters.actor_type);
  if (filters.section) params.set("section", filters.section);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const res = await apiFetch(`/api/audit-log?${params}`);
  if (!res.ok) throw new Error("Failed to load audit log");
  return res.json();
}
