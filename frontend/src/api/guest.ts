import type { DocumentRecord } from "./documents";

export async function guestFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  return fetch(`${path}${sep}token=${encodeURIComponent(token)}`, init);
}

export async function getGuestSections(token: string): Promise<string[]> {
  const res = await guestFetch("/api/guest/sections", token);
  if (!res.ok) throw new Error("Invalid or expired link");
  return res.json();
}

export async function listGuestRecords(section: string, token: string): Promise<unknown[]> {
  const res = await guestFetch(`/api/guest/${section}`, token);
  if (!res.ok) throw new Error("Failed to load records");
  return res.json();
}

export async function getGuestRecord(section: string, recordId: string, token: string): Promise<unknown> {
  const res = await guestFetch(`/api/guest/${section}/${recordId}`, token);
  if (!res.ok) throw new Error("Record not found");
  return res.json();
}

export async function listGuestDocuments(section: string, recordId: string, token: string): Promise<DocumentRecord[]> {
  const res = await guestFetch(`/api/guest/${section}/${recordId}/documents`, token);
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

export function getGuestDownloadUrl(docId: number, token: string): string {
  return `/api/guest/documents/${docId}/download?token=${encodeURIComponent(token)}`;
}
