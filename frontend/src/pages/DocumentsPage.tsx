import { useEffect, useState } from "react";
import { listAllDocuments, getDownloadUrl, type DocumentRecord } from "../api/documents";

const SECTIONS = [
  "surgeries", "hospitalizations", "vision_history", "dental_history",
  "visit_logs", "appointments", "medications", "vaccinations",
  "insurances", "ailments", "doctors", "profile",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [section, setSection] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listAllDocuments(section || undefined)
      .then((data) => { setError(""); setDocs(data); })
      .catch(() => setError("Failed to load documents"));
  }, [section]);

  return (
    <section style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Documents</h1>
      {error && <p role="alert">{error}</p>}

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
        Filter by section:
        <select value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections</option>
          {SECTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>

      {docs.length === 0 && !error ? (
        <p>No documents found.</p>
      ) : docs.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Section</th>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Filename</th>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Size</th>
              <th style={{ textAlign: "left", paddingRight: "1rem" }}>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td style={{ paddingRight: "1rem" }}>
                  <span style={{ background: "#e8f4fd", padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.8rem" }}>
                    {doc.section.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={{ paddingRight: "1rem" }}>{doc.filename}</td>
                <td style={{ paddingRight: "1rem" }}>{formatBytes(doc.file_size)}</td>
                <td style={{ paddingRight: "1rem" }}>
                  {new Date(doc.uploaded_at).toLocaleDateString()}
                </td>
                <td>
                  <a href={getDownloadUrl(doc.id)} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
