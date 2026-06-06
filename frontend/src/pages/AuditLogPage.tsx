// frontend/src/pages/AuditLogPage.tsx
import { useEffect, useState } from "react";
import { listAuditLog, type AuditLogEntry, type AuditLogFilters } from "../api/auditLog";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Select, Input } from "@/components/ui/form-field";
import { formatDatetime } from "@/lib/format";

const ACTIONS = ["create", "update", "delete", "share_link_access"];

type ActionBadgeVariant = "default" | "secondary" | "destructive" | "outline";

function actionVariant(action: string): ActionBadgeVariant {
  switch (action) {
    case "create": return "default";
    case "update": return "secondary";
    case "delete": return "destructive";
    case "share_link_access": return "outline";
    default: return "outline";
  }
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1 });

  useEffect(() => {
    listAuditLog(filters)
      .then(setEntries)
      .catch(() => setError("Failed to load audit log"));
  }, [filters]);

  function set(key: keyof AuditLogFilters, value: string) {
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }));
  }

  return (
    <AppShell>
      <PageLayout title="Audit Log" description="System activity and access log.">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4">
              <FormField label="Action" htmlFor="al-action">
                <Select id="al-action" onChange={(e) => set("action", e.target.value)}>
                  <option value="">All</option>
                  {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
              </FormField>
              <FormField label="Actor type" htmlFor="al-actor">
                <Select id="al-actor" onChange={(e) => set("actor_type", e.target.value)}>
                  <option value="">All</option>
                  <option value="user">Users</option>
                  <option value="guest">Guests</option>
                </Select>
              </FormField>
              <FormField label="From" htmlFor="al-from">
                <Input
                  id="al-from"
                  type="date"
                  onChange={(e) => set("date_from", e.target.value)}
                />
              </FormField>
              <FormField label="To" htmlFor="al-to">
                <Input
                  id="al-to"
                  type="date"
                  onChange={(e) => set("date_to", e.target.value)}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries found.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Section</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDatetime(e.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{e.actor_label}</td>
                    <td className="px-4 py-3">
                      <Badge variant={actionVariant(e.action)}>{e.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {e.section?.replace(/_/g, " ") ?? ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {filters.page ?? 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={entries.length < 50}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
          >
            Next
          </Button>
        </div>
      </PageLayout>
    </AppShell>
  );
}
