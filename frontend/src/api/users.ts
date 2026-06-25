import { csrfHeader } from "./csrf";
import { apiFetch } from "./client";

export interface ManagedUser {
  id: string;
  email: string;
  role: "admin" | "contributor" | "viewer";
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export async function listUsers(): Promise<ManagedUser[]> {
  const res = await apiFetch("/api/users");
  if (!res.ok) throw new Error("Failed to list users");
  return (await res.json()) as ManagedUser[];
}

export async function createUser(
  email: string,
  password: string,
  role: "admin" | "contributor" | "viewer",
  full_name?: string | null,
): Promise<ManagedUser> {
  const res = await apiFetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ email, password, role, full_name: full_name || null }),
  });
  if (!res.ok) throw new Error("Failed to create user");
  return (await res.json()) as ManagedUser;
}

export async function updateUser(
  id: string,
  payload: { role?: "admin" | "contributor" | "viewer"; is_active?: boolean; full_name?: string | null },
): Promise<ManagedUser> {
  const res = await apiFetch(`/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return (await res.json()) as ManagedUser;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await apiFetch(`/api/users/${id}`, { method: "DELETE", headers: { ...csrfHeader() } });
  if (!res.ok) throw new Error("Failed to delete user");
}
