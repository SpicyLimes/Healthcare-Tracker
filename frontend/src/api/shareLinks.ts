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
