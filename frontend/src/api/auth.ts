import { csrfHeader } from "./csrf";
import { apiFetch } from "./client";

export interface CurrentUser {
  id: string;
  email: string;
  role: "admin" | "contributor" | "viewer";
  full_name: string | null;
  timezone: string;
  must_change_password: boolean;
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    let detail = "Invalid credentials";
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // non-JSON body → keep generic message
    }
    throw new Error(detail);
  }
  return (await res.json()) as CurrentUser;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", headers: { ...csrfHeader() } });
}

export async function getMe(): Promise<CurrentUser | null> {
  const res = await apiFetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to load user");
  return (await res.json()) as CurrentUser;
}

export async function refresh(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", { method: "POST", headers: { ...csrfHeader() } });
  return res.ok;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch("/api/auth/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) throw new Error("Password change failed");
}

export async function updateName(fullName: string | null): Promise<CurrentUser> {
  const res = await apiFetch("/api/auth/name", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ full_name: fullName }),
  });
  if (!res.ok) throw new Error("Name update failed");
  return (await res.json()) as CurrentUser;
}

export async function updateTimezone(timezone: string): Promise<CurrentUser> {
  const res = await apiFetch("/api/auth/timezone", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ timezone }),
  });
  if (!res.ok) throw new Error("Timezone update failed");
  return (await res.json()) as CurrentUser;
}
