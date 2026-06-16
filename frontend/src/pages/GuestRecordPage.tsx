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
      <h1 className="text-2xl font-semibold mb-4">
        {section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — Record
      </h1>
      {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
      {record && (
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
          <dl className="divide-y divide-border">
            {Object.entries(record)
              .filter(([k]) => k !== "id" && !k.endsWith("_id"))
              .map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 px-4 py-3 text-sm">
                  <dt className="font-medium text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd className="col-span-2 text-foreground">{v === null || v === undefined ? "—" : String(v)}</dd>
                </div>
              ))}
          </dl>
        </div>
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
