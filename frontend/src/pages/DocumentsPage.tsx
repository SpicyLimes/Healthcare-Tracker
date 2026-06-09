import { useEffect, useState } from "react";
import { listAllDocuments, getDownloadUrl, type DocumentRecord } from "../api/documents";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, Select } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";
import { useSort } from "@/hooks/useSort";
import { SortableTh } from "@/components/SortableTh";

const SECTIONS = [
  "surgeries", "hospitalizations", "vision_history", "dental_history",
  "visit_logs", "appointments", "medications", "vaccinations",
  "insurances", "ailments", "doctors", "profile",
];

function formatSectionLabel(section: string): string {
  return section
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const { sorted: sortedDocs, sort, toggleSort } = useSort(docs, "filename", "asc");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listAllDocuments(section || undefined)
      .then((data) => { setError(""); setDocs(data); })
      .catch(() => setError("Failed to load documents"));
  }, [section]);

  return (
    <AppShell>
      <PageLayout title="Documents" description="All uploaded medical documents.">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="mb-4">
          <FormField label="Filter by section" htmlFor="doc-section">
            <Select
              id="doc-section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">All sections</option>
              {SECTIONS.map((s) => (
                <option key={s} value={s}>{formatSectionLabel(s)}</option>
              ))}
            </Select>
          </FormField>
        </div>

        {docs.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">No documents found.</p>
        ) : docs.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <SortableTh label="Filename" sortKey="filename" sort={sort} onSort={toggleSort} />
                      <SortableTh label="Section" sortKey="section" sort={sort} onSort={toggleSort} />
                      <SortableTh label="Size" sortKey="file_size" sort={sort} onSort={toggleSort} />
                      <SortableTh label="Uploaded" sortKey="uploaded_at" sort={sort} onSort={toggleSort} />
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDocs.map((doc) => (
                      <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium text-foreground">{doc.filename}</td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {doc.section.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatBytes(doc.file_size)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.uploaded_at)}</td>
                        <td className="px-4 py-3">
                          <Button variant="outline" size="sm" asChild>
                            <a href={getDownloadUrl(doc.id)} target="_blank" rel="noopener noreferrer">
                              Open
                            </a>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </PageLayout>
    </AppShell>
  );
}
