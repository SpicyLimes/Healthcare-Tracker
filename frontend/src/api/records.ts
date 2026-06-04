import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";

const jsonWrite = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json", ...csrfHeader() },
  body: JSON.stringify(body),
});

export interface RecordClient<T, TCreate, TUpdate> {
  list(): Promise<T[]>;
  get(id: string): Promise<T>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  remove(id: string): Promise<void>;
}

export function createRecordClient<T, TCreate, TUpdate>(
  base: string,
): RecordClient<T, TCreate, TUpdate> {
  return {
    async list() {
      const res = await apiFetch(base);
      if (!res.ok) throw new Error(`Failed to load ${base}`);
      return (await res.json()) as T[];
    },
    async get(id) {
      const res = await apiFetch(`${base}/${id}`);
      if (!res.ok) throw new Error(`Failed to load ${base}/${id}`);
      return (await res.json()) as T;
    },
    async create(data) {
      const res = await apiFetch(base, { method: "POST", ...jsonWrite(data) });
      if (!res.ok) throw new Error(`Failed to create in ${base}`);
      return (await res.json()) as T;
    },
    async update(id, data) {
      const res = await apiFetch(`${base}/${id}`, { method: "PUT", ...jsonWrite(data) });
      if (!res.ok) throw new Error(`Failed to update ${base}/${id}`);
      return (await res.json()) as T;
    },
    async remove(id) {
      const res = await apiFetch(`${base}/${id}`, { method: "DELETE", headers: { ...csrfHeader() } });
      if (!res.ok) throw new Error(`Failed to delete ${base}/${id}`);
    },
  };
}
