// frontend/src/components/DocumentsPanel.tsx
import { useEffect, useRef, useState } from "react";
import {
  deleteDocument,
  getDownloadUrl,
  listDocumentsForRecord,
  uploadDocument,
  type DocumentRecord,
} from "../api/documents";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  section: string;
  recordId: string;
  isAdmin: boolean;
}

export default function DocumentsPanel({ section, recordId, isAdmin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!expanded) return;
    listDocumentsForRecord(section, recordId)
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [expanded, section, recordId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setUploadError(`File type "${file.type}" is not allowed.`);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File exceeds the 20 MB size limit.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    try {
      const doc = await uploadDocument(section, recordId, file);
      setDocs((prev) => [doc, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(docId: number) {
    try {
      await deleteDocument(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      setUploadError("Failed to delete document");
    }
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ fontSize: "0.8rem", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        aria-expanded={expanded}
      >
        {expanded ? "▲" : "▶"} Documents ({docs.length})
      </button>

      {expanded && (
        <div style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
          {uploadError && <p role="alert" style={{ color: "red", fontSize: "0.85rem" }}>{uploadError}</p>}

          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFileChange}
                aria-label="Upload document"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}
              >
                {loading ? "Uploading…" : "Upload"}
              </button>
            </>
          )}

          {docs.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#666" }}>No documents attached.</p>
          ) : (
            <table style={{ fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ paddingRight: "1rem" }}>
                      <a
                        href={getDownloadUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {doc.filename}
                      </a>
                    </td>
                    <td style={{ paddingRight: "1rem", color: "#666" }}>{formatBytes(doc.file_size)}</td>
                    <td style={{ paddingRight: "1rem", color: "#666" }}>
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          style={{ fontSize: "0.8rem" }}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
