import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";

const jsonWrite = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json", ...csrfHeader() },
  body: JSON.stringify(body),
});

export interface Note {
  id: string;
  author_user_id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  done: boolean;
  created_at: string;
}

export interface NoteCreate {
  title: string;
  body?: string | null;
  pinned?: boolean;
  done?: boolean;
}

export interface NotePatch {
  title?: string | null;
  body?: string | null;
  pinned?: boolean | null;
  done?: boolean | null;
}

export const notesApi = {
  async list(): Promise<Note[]> {
    const res = await apiFetch("/api/notes");
    if (!res.ok) throw new Error("Failed to load notes");
    return res.json() as Promise<Note[]>;
  },

  async create(data: NoteCreate): Promise<Note> {
    const res = await apiFetch("/api/notes", { method: "POST", ...jsonWrite(data) });
    if (!res.ok) throw new Error("Failed to create note");
    return res.json() as Promise<Note>;
  },

  async patch(id: string, data: NotePatch): Promise<Note> {
    const res = await apiFetch(`/api/notes/${id}`, { method: "PATCH", ...jsonWrite(data) });
    if (!res.ok) throw new Error("Failed to update note");
    return res.json() as Promise<Note>;
  },

  async remove(id: string): Promise<void> {
    const res = await apiFetch(`/api/notes/${id}`, {
      method: "DELETE",
      headers: { ...csrfHeader() },
    });
    if (!res.ok) throw new Error("Failed to delete note");
  },
};
