import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";
import type { ReminderLayout } from "@/lib/reminder-layout";

const jsonWrite = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json", ...csrfHeader() },
  body: JSON.stringify(body),
});

export interface ReminderPageResponse {
  layout: ReminderLayout;
  updated_at: string | null;
}

export const remindersApi = {
  async get(): Promise<ReminderPageResponse> {
    const res = await apiFetch("/api/reminders");
    if (!res.ok) throw new Error("Failed to load reminders");
    return res.json();
  },
  async save(layout: ReminderLayout): Promise<ReminderPageResponse> {
    const res = await apiFetch("/api/reminders", { method: "PUT", ...jsonWrite({ layout }) });
    if (!res.ok) throw new Error("Failed to save reminders");
    return res.json();
  },
};
