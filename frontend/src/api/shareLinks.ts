import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";

export interface ShareLink {
  id: string;
  label: string;
  allowed_sections: string[];
  expires_at: string;
  revoked: boolean;
  created_at: string;
  token_url: string;
}

export interface ShareLinkCreated extends ShareLink {
  // token_url inherited from ShareLink
}

export interface ShareLinkInput {
  label: string;
  expires_at: string;
  allowed_sections: string[];
}

export async function listShareLinks(): Promise<ShareLink[]> {
  const res = await apiFetch("/api/share-links");
  if (!res.ok) throw new Error("Failed to load share links");
  return res.json();
}

export async function createShareLink(input: ShareLinkInput): Promise<ShareLinkCreated> {
  const res = await apiFetch("/api/share-links", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create share link");
  return res.json();
}

export async function revokeShareLink(id: string): Promise<void> {
  const res = await apiFetch(`/api/share-links/${id}`, {
    method: "DELETE",
    headers: { ...csrfHeader() },
  });
  if (!res.ok) throw new Error("Failed to revoke share link");
}

export async function deleteShareLink(id: string): Promise<void> {
  const res = await apiFetch(`/api/share-links/${id}/permanent`, {
    method: "DELETE",
    headers: { ...csrfHeader() },
  });
  if (!res.ok) throw new Error("Failed to delete share link");
}

export async function getEmailStatus(): Promise<boolean> {
  const res = await apiFetch("/api/share-links/email-status");
  if (!res.ok) return false;
  const body = await res.json();
  return body?.configured === true;
}

export async function emailShareLink(
  id: string,
  input: { recipient: string; message?: string },
): Promise<void> {
  const res = await apiFetch(`/api/share-links/${id}/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let detail = "Couldn't send the email. The link is still valid — you can copy it instead.";
    try {
      const body = await res.json();
      // 422 validation errors carry an array detail; keep the friendly fallback then.
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // keep fallback
    }
    throw new Error(detail);
  }
}
