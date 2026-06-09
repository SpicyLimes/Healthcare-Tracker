// frontend/src/api/documents.ts
import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";

export interface DocumentRecord {
  id: number;
  filename: string;
  section: string;
  record_id: string | null;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string | null;
}

export async function listDocumentsForRecord(
  section: string,
  recordId: string,
): Promise<DocumentRecord[]> {
  const res = await apiFetch(`/api/${sectionToPath(section)}/${recordId}/documents`);
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

export async function uploadDocument(
  section: string,
  recordId: string,
  file: File,
): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`/api/${sectionToPath(section)}/${recordId}/documents`, {
    method: "POST",
    headers: { ...csrfHeader() },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Upload failed");
  }
  return res.json();
}

export async function deleteDocument(docId: number): Promise<void> {
  const res = await apiFetch(`/api/documents/${docId}`, {
    method: "DELETE",
    headers: { ...csrfHeader() },
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

export function getDownloadUrl(docId: number): string {
  return `/api/documents/${docId}/download`;
}

export async function listAllDocuments(section?: string): Promise<DocumentRecord[]> {
  const url = section ? `/api/documents?section=${section}` : "/api/documents";
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

// Maps DocumentSection enum values to their URL path segments
function sectionToPath(section: string): string {
  const map: Record<string, string> = {
    surgeries: "surgeries",
    hospitalizations: "hospitalizations",
    vision_history: "vision-history",
    dental_history: "dental-history",
    visit_logs: "visit-logs",
    appointments: "appointments",
    medications: "medications",
    vaccinations: "vaccinations",
    insurances: "insurances",
    ailments: "ailments",
    doctors: "doctors",
    profile: "profile",
  };
  return map[section] ?? section;
}
