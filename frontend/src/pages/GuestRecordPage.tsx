// frontend/src/pages/GuestRecordPage.tsx
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getGuestRecord, listGuestDocuments, getGuestDownloadUrl } from "../api/guest";
import { useGuest } from "../auth/GuestContext";
import GuestLayout from "../components/GuestLayout";
import type { DocumentRecord } from "../api/documents";

export default function GuestRecordPage() {
  const { section = "", recordId = "" } = useParams<{ section: string; recordId: string }>();
  const [searchParams] = useSearchParams();
  const { token } = useGuest();
  const rawToken = token || searchParams.get("token") || "";
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rawToken) { setExpired(true); return; }
    getGuestRecord(section, recordId, rawToken)
      .then((r) => setRecord(r as Record<string, unknown>))
      .catch(() => setExpired(true));
    listGuestDocuments(section, recordId, rawToken)
      .then(setDocs)
      .catch(() => { setDocs([]); setError("Failed to load documents"); });
  }, [section, recordId, rawToken]);

  if (expired) return <GuestLayout expired>{null}</GuestLayout>;

  return (
    <GuestLayout>
      <h1 style={{ textTransform: "capitalize" }}>{section.replace(/_/g, " ")} — Record</h1>
      {error && <p role="alert">{error}</p>}
      {record && (
        <table style={{ marginBottom: "1rem" }}>
          <tbody>
            {Object.entries(record)
              .filter(([k]) => k !== "id")
              .map(([k, v]) => (
                <tr key={k}>
                  <th style={{ textAlign: "left", paddingRight: "1rem", fontWeight: "normal", color: "#666" }}>
                    {k.replace(/_/g, " ")}
                  </th>
                  <td>{v === null || v === undefined ? "—" : String(v)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {docs.length > 0 && (
        <>
          <h2>Documents</h2>
          <ul>
            {docs.map((doc) => (
              <li key={doc.id}>
                <a href={getGuestDownloadUrl(doc.id, rawToken)} target="_blank" rel="noopener noreferrer">
                  {doc.filename}
                </a>
                {" "}({(doc.file_size / 1024).toFixed(1)} KB)
              </li>
            ))}
          </ul>
        </>
      )}
    </GuestLayout>
  );
}
