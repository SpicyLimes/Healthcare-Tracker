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

const ACTIONS = [
  "login", "logout", "login_failed", "password_change", "password_reset",
  "user_created", "user_updated", "user_deactivated", "user_reactivated", "user_deleted",
  "create", "update", "delete",
  "share_link_access", "share_link_emailed", "ai_query",
  "submission_created", "submission_approved", "submission_rejected", "submission_withdrawn",
  "backup_create", "backup_download", "backup_upload", "backup_restore", "backup_delete",
];

/**
 * Words that title-casing gets wrong. Keyed by the lower-case token so this
 * works on action keys, section keys and tool names alike — every one of which
 * contains "ai", and every one of which used to render as "Ai".
 */
const ACRONYMS: Record<string, string> = { ai: "AI", id: "ID" };

/** Title-case an underscored key, honouring ACRONYMS. */
function humanize(key: string): string {
  return key
    .split("_")
    .map((w) => ACRONYMS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatAction(action: string): string {
  return humanize(action);
}

/** Section keys used by audit rows are not all record sections (e.g. ai_chat). */
function formatSection(section: string | null | undefined): string | null {
  return section ? humanize(section) : null;
}

/**
 * The `detail` string is written by the backend as a human sentence, except for
 * the machine-ish `tools: a,b` suffix the AI router appends
 * (`ai.py`: `Q: … | tools: get_section_records`). Present that suffix in the
 * same casing as everything else instead of leaking the raw tool names.
 */
function formatDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  return detail.replace(
    /\btools:\s*(\S+)/,
    (_m, list: string) =>
      `Tools: ${list.split(",").map((t) => humanize(t.trim())).join(", ")}`,
  );
}

type ActionBadgeVariant = "default" | "secondary" | "destructive" | "outline";

function actionVariant(action: string): ActionBadgeVariant {
  switch (action) {
    case "create": return "default";
    case "login": return "secondary";
    case "user_created": return "default";
    case "user_reactivated": return "default";
    case "update": return "secondary";
    case "logout": return "secondary";
    case "password_change": return "secondary";
    case "password_reset": return "secondary";
    case "user_updated": return "secondary";
    case "delete": return "destructive";
    case "login_failed": return "destructive";
    case "user_deleted": return "destructive";
    case "user_deactivated": return "destructive";
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
                  {ACTIONS.map((a) => <option key={a} value={a}>{formatAction(a)}</option>)}
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
                    <Badge variant={actionVariant(r.action)}>{formatAction(r.action)}</Badge>
                  ),
                },
                {
                  header: "Section",
                  sortKey: "section",
                  render: (r) => <span>{formatSection(r.section) ?? ""}</span>,
                },
              ]}
              detailTitle={(r) => `${formatAction(r.action)} — ${r.actor_label}`}
              detailFields={(r) => [
                { label: "Timestamp", value: formatDatetime(r.timestamp) },
                { label: "Actor", value: r.actor_label },
                { label: "Actor Type", value: humanize(r.actor_type) },
                { label: "Action", value: formatAction(r.action) },
                { label: "Section", value: formatSection(r.section) },
                { label: "Record ID", value: r.record_id ?? null },
                { label: "Detail", value: formatDetail(r.detail) },
              ]}
              getHeadline={(r) => formatAction(r.action)}
              getSubtitle={(r) => `${formatDatetime(r.timestamp)} · ${r.actor_label}`}
              getBadge={(r) => ({ label: formatAction(r.action), variant: actionVariant(r.action) })}
              emptyMessage="No audit log entries."
              pageSize={25}
            />
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
