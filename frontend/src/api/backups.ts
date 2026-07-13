import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";

export interface Backup {
  id: string;
  type: "nightly" | "manual" | "safety" | "uploaded";
  created_at: string;
  size_bytes: number;
  complete: boolean;
}

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null);
  return new Error(typeof body?.detail === "string" ? body.detail : fallback);
}

export async function listBackups(): Promise<Backup[]> {
  const res = await apiFetch("/api/backups");
  if (!res.ok) throw new Error("Failed to load backups");
  return res.json();
}

export async function createBackup(): Promise<Backup> {
  const res = await apiFetch("/api/backups", { method: "POST", headers: { ...csrfHeader() } });
  if (!res.ok) throw await errorFrom(res, "Failed to create backup");
  return res.json();
}

export async function uploadBackup(file: File): Promise<Backup> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch("/api/backups/upload", {
    method: "POST",
    headers: { ...csrfHeader() },
    body: form,
  });
  if (!res.ok) throw await errorFrom(res, "Failed to upload backup");
  return res.json();
}

export async function restoreBackup(id: string, confirm: string): Promise<{ safety_backup_id: string }> {
  const res = await apiFetch(`/api/backups/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ confirm }),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to restore backup");
  return res.json();
}

export async function deleteBackup(id: string): Promise<void> {
  const res = await apiFetch(`/api/backups/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...csrfHeader() },
  });
  if (!res.ok) throw await errorFrom(res, "Failed to delete backup");
}

export function backupDownloadUrl(id: string): string {
  return `/api/backups/${encodeURIComponent(id)}/download`;
}
