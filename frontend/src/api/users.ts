import type { CurrentUser } from "./auth";
import { csrfHeader } from "./csrf";
import { apiFetch } from "./client";

export interface ManagedUser extends CurrentUser {
  is_active: boolean;
  created_at: string;
}

export async function listUsers(): Promise<ManagedUser[]> {
  const res = await apiFetch("/api/users");
  if (!res.ok) throw new Error("Failed to list users");
  return (await res.json()) as ManagedUser[];
}

export async function createUser(email: string, password: string, role: "admin" | "viewer"): Promise<ManagedUser> {
  const res = await apiFetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) throw new Error("Failed to create user");
  return (await res.json()) as ManagedUser;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await apiFetch(`/api/users/${id}`, { method: "DELETE", headers: { ...csrfHeader() } });
  if (!res.ok) throw new Error("Failed to delete user");
}
