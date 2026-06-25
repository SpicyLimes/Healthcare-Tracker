import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  listSubmissions,
  approveSubmission,
  rejectSubmission,
  type Submission,
  type SubmissionStatus,
} from "../api/submissions";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField, Select, Input } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { formatDatetime } from "@/lib/format";

function sectionLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(s: SubmissionStatus): "default" | "secondary" | "destructive" | "outline" {
  if (s === "pending") return "outline";
  if (s === "approved") return "default";
  return "destructive";
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "">("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSubmissions(statusFilter || undefined);
      setSubmissions(data);
    } catch {
      setError("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { reload(); }, [reload]);

  async function handleApprove(id: string) {
    setActionError("");
    try {
      await approveSubmission(id);
      await reload();
    } catch {
      setActionError("Failed to approve submission");
    }
  }

  async function handleReject() {
    if (!rejectingId) return;
    setActionError("");
    try {
      await rejectSubmission(rejectingId, rejectReason || undefined);
      setRejectingId(null);
      setRejectReason("");
      await reload();
    } catch {
      setActionError("Failed to reject submission");
    }
  }

  return (
    <AppShell>
      <PageLayout title="Submissions" description="Review and approve Contributor record proposals.">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {actionError && <p role="alert" className="mb-2 text-sm text-destructive">{actionError}</p>}

        <Card className="mb-6">
          <CardContent className="py-4">
            <FormField label="Status" htmlFor="sub-status">
              <Select
                id="sub-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | "")}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={submissions}
              loading={loading}
              isAdmin={true}
              getRowId={(r) => r.id}
              defaultSortKey="created_at"
              defaultSortDir="desc"
              primaryColumns={[
                {
                  header: "Submitted",
                  sortKey: "created_at",
                  render: (r) => formatDatetime(r.created_at),
                  className: "px-4 py-3 whitespace-nowrap text-muted-foreground",
                },
                {
                  header: "By",
                  sortKey: "submitted_by_label",
                  render: (r) => <span className="font-medium">{r.submitted_by_label}</span>,
                },
                {
                  header: "Section",
                  sortKey: "section",
                  render: (r) => sectionLabel(r.section),
                },
                {
                  header: "Action",
                  sortKey: "action",
                  render: (r) => (
                    <Badge variant={r.action === "create" ? "default" : r.action === "update" ? "secondary" : "destructive"}>
                      {r.action}
                    </Badge>
                  ),
                },
                {
                  header: "Status",
                  sortKey: "status",
                  render: (r) => (
                    <Badge variant={statusVariant(r.status)}>
                      {r.status}
                    </Badge>
                  ),
                },
                {
                  header: "Actions",
                  sortKey: "status",
                  render: (r) => r.status === "pending" ? (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleApprove(r.id); }}
                        aria-label="Approve"
                      >
                        <CheckCircle2 className="size-4 text-primary" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); setRejectingId(r.id); setRejectReason(""); setActionError(""); }}
                        aria-label="Reject"
                      >
                        <XCircle className="size-4 text-destructive" />
                      </Button>
                    </span>
                  ) : null,
                },
              ]}
              detailTitle={(r) => `${sectionLabel(r.section)} — ${r.action}`}
              detailFields={(r) => [
                { label: "Submitted At", value: formatDatetime(r.created_at) },
                { label: "Submitted By", value: r.submitted_by_label },
                { label: "Section", value: sectionLabel(r.section) },
                { label: "Action", value: r.action },
                { label: "Record ID", value: r.record_id ?? null },
                { label: "Status", value: r.status },
                { label: "Reviewed By", value: r.reviewed_by_label ?? null },
                { label: "Reviewed At", value: r.reviewed_at ? formatDatetime(r.reviewed_at) : null },
                { label: "Reject Reason", value: r.reject_reason ?? null },
                {
                  label: "Proposed Values",
                  value: Object.entries(r.payload)
                    .filter(([, v]) => v !== null && v !== undefined && v !== "")
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(" · ") || "(no fields)",
                },
              ]}
              getHeadline={(r) => `${r.action} · ${sectionLabel(r.section)}`}
              getSubtitle={(r) => `${formatDatetime(r.created_at)} · ${r.submitted_by_label}`}
              getBadge={(r) => ({ label: r.status, variant: statusVariant(r.status) })}
              emptyMessage="No submissions found."
              pageSize={25}
            />
          </CardContent>
        </Card>

        {rejectingId && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reject Submission"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setRejectingId(null)}
          >
            <div
              className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 font-heading text-base font-semibold">Reject Submission</h2>
              <FormField label="Reason (optional)" htmlFor="reject-reason">
                <Input
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this submission was rejected…"
                />
              </FormField>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleReject}>Reject</Button>
              </div>
            </div>
          </div>
        )}
      </PageLayout>
    </AppShell>
  );
}
