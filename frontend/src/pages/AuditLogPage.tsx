// frontend/src/pages/AuditLogPage.tsx
import { useEffect, useState } from "react";
import { listAuditLog, type AuditLogEntry, type AuditLogFilters } from "../api/auditLog";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormField, Select, Input } from "@/components/ui/form-field";
import { formatDatetime } from "@/lib/format";
import { RecordTable } from "@/components/RecordTable";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<AuditLogFilters>({});

  useEffect(() => {
    setLoading(true);
    listAuditLog(filters)
      .then(setEntries)
      .catch(() => { setError("Failed to load audit log"); setEntries([]); })
      .finally(() => setLoading(false));
  }, [filters]);

  function set(key: keyof AuditLogFilters, value: string) {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
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

        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={entries}
              loading={loading}
              isAdmin={true}
              getRowId={(r) => String(r.id)}
              defaultSortKey="timestamp"
              defaultSortDir="desc"
              primaryColumns={[
                {
                  header: "Timestamp",
                  sortKey: "timestamp",
                  render: (r) => formatDatetime(r.timestamp),
                  className: "px-4 py-3 text-muted-foreground whitespace-nowrap",
                },
                {
                  header: "Actor",
                  sortKey: "actor_label",
                  render: (r) => <span className="font-medium text-foreground">{r.actor_label}</span>,
                },
                {
                  header: "Action",
                  sortKey: "action",
                  render: (r) => (
                    <Badge variant={actionVariant(r.action)}>{r.action}</Badge>
                  ),
                },
                {
                  header: "Section",
                  sortKey: "section",
                  render: (r) => (
                    <span className="capitalize">{r.section?.replace(/_/g, " ") ?? ""}</span>
                  ),
                },
              ]}
              detailTitle={(r) => `${r.action} — ${r.actor_label}`}
              detailFields={(r) => [
                { label: "Timestamp", value: formatDatetime(r.timestamp) },
                { label: "Actor", value: r.actor_label },
                { label: "Actor Type", value: r.actor_type },
                { label: "Action", value: r.action },
                { label: "Section", value: r.section?.replace(/_/g, " ") ?? null },
                { label: "Record ID", value: r.record_id ?? null },
                { label: "Detail", value: r.detail ?? null },
              ]}
              getHeadline={(r) => r.action}
              getSubtitle={(r) => `${formatDatetime(r.timestamp)} · ${r.actor_label}`}
              getBadge={(r) => ({ label: r.action, variant: actionVariant(r.action) })}
              emptyMessage="No audit log entries."
              pageSize={25}
            />
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
