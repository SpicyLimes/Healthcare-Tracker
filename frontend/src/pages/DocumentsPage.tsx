import { useEffect, useRef, useState } from "react";
import { listAllDocuments, getDownloadUrl, type DocumentRecord } from "../api/documents";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, Select } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";
import { useSort } from "@/hooks/useSort";
import { useColumnResize } from "@/hooks/useColumnResize";
import { SortableTh } from "@/components/SortableTh";

const SECTIONS = [
  "surgeries", "hospitalizations", "vision_history", "dental_history",
  "visit_logs", "appointments", "medications", "vaccinations",
  "insurances", "ailments", "doctors", "profile", "nutrition_plan",
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
  const [loading, setLoading] = useState(true);
  const { sorted: sortedDocs, sort, toggleSort } = useSort(docs, "filename", "asc");
  const tableRef = useRef<HTMLTableElement>(null);
  const { colWidths, autoFitColumn, autoFitAll, startDrag } = useColumnResize(tableRef);
  const [section, setSection] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    listAllDocuments(section || undefined)
      .then((data) => { setError(""); setDocs(data); })
      .catch(() => { setError("Failed to load documents"); setDocs([]); })
      .finally(() => setLoading(false));
  }, [section]);

  useEffect(() => {
    if (sortedDocs.length === 0) return;
    autoFitAll([
      { sortKey: "filename", colIndex: 1 },
      { sortKey: "section", colIndex: 2 },
      { sortKey: "file_size", colIndex: 3 },
      { sortKey: "uploaded_at", colIndex: 4 },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedDocs.length]);

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

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <SortableTh label="Filename" sortKey="filename" sort={sort} onSort={toggleSort} colIndex={1} width={colWidths["filename"]} onAutoFit={autoFitColumn} onStartResize={startDrag} />
                    <SortableTh label="Section" sortKey="section" sort={sort} onSort={toggleSort} colIndex={2} width={colWidths["section"]} onAutoFit={autoFitColumn} onStartResize={startDrag} />
                    <SortableTh label="Size" sortKey="file_size" sort={sort} onSort={toggleSort} colIndex={3} width={colWidths["file_size"]} onAutoFit={autoFitColumn} onStartResize={startDrag} />
                    <SortableTh label="Uploaded" sortKey="uploaded_at" sort={sort} onSort={toggleSort} colIndex={4} width={colWidths["uploaded_at"]} onAutoFit={autoFitColumn} onStartResize={startDrag} />
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && sortedDocs.map((doc) => (
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
                  {!loading && docs.length === 0 && !error && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-muted-foreground">
                        No documents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
