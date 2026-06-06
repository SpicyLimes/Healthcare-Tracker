// frontend/src/components/DocumentsPanel.tsx
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Trash2, Upload } from "lucide-react";
import {
  deleteDocument,
  getDownloadUrl,
  listDocumentsForRecord,
  uploadDocument,
  type DocumentRecord,
} from "../api/documents";
import { Button } from "@/components/ui/button";

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
    <div className="mt-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Documents ({docs.length})
      </Button>

      {expanded && (
        <div className="mt-2 pl-2">
          {uploadError && (
            <p role="alert" className="mb-2 text-xs text-destructive">
              {uploadError}
            </p>
          )}

          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Upload document"
              />
              <Button
                variant="outline"
                size="sm"
                className="mb-3 h-7 gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Upload className="h-3 w-3" />
                {loading ? "Uploading…" : "Upload Document"}
              </Button>
            </>
          )}

          {docs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents attached.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="py-1 pr-3">
                      <a
                        href={getDownloadUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {doc.filename}
                      </a>
                    </td>
                    <td className="py-1 pr-3 text-muted-foreground">
                      {formatBytes(doc.file_size)}
                    </td>
                    <td className="py-1 pr-3 text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="py-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(doc.id)}
                          aria-label="Delete document"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
