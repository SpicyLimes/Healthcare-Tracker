import { csrfHeader } from "./csrf";
import { apiFetch } from "./client";

export interface ManagedUser {
  id: string;
  email: string;
  role: "admin" | "contributor" | "viewer";
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  must_change_password: boolean;
  temp_password_expires_at: string | null;
}

export async function listUsers(): Promise<ManagedUser[]> {
  const res = await apiFetch("/api/users");
  if (!res.ok) throw new Error("Failed to list users");
  return (await res.json()) as ManagedUser[];
}

export interface CreateUserInput {
  email: string;
  role: "admin" | "contributor" | "viewer";
  full_name?: string | null;
  password?: string;
  send_onboarding_email?: boolean;
  expires_minutes?: number;
  notes?: string | null;
}

export type CreatedUser = ManagedUser & { email_sent: boolean | null };

export async function createUser(input: CreateUserInput): Promise<CreatedUser> {
  const res = await apiFetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ ...input, full_name: input.full_name || null }),
  });
  if (!res.ok) throw new Error("Failed to create user");
  return (await res.json()) as CreatedUser;
}

export async function resetUserPassword(
  id: string,
  expiresMinutes: number,
  notes: string | null,
): Promise<void> {
  const res = await apiFetch(`/api/users/${id}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ expires_minutes: expiresMinutes, notes }),
  });
  if (!res.ok) throw new Error("Failed to reset password");
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
