import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import {
  listMySubmissions,
  withdrawMySubmission,
  type Submission,
  type SubmissionStatus,
} from "../api/submissions";
import { useToast } from "../components/toast";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecordTable } from "@/components/RecordTable";
import { formatDatetime } from "@/lib/format";

// Section key -> URL path for the edit deep-link.
const SECTION_PATHS: Record<string, string> = {
  medications: "medications",
  doctors: "doctors",
  ailments: "ailments",
  insurances: "insurance",
  pharmacies: "pharmacies",
  family_history: "family-history",
  surgeries: "surgeries",
  hospitalizations: "hospitalizations",
  vision_history: "vision-history",
  dental_history: "dental-history",
  vaccinations: "vaccinations",
  vitals: "vitals",
};

function sectionLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(s: SubmissionStatus): "default" | "secondary" | "destructive" | "outline" {
  if (s === "pending") return "outline";
  if (s === "approved") return "default";
  return "destructive";
}

export default function MySubmissionsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMySubmissions();
      setSubmissions(data);
    } catch {
      setError("Failed to load your submissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function handleEdit(r: Submission) {
    const path = SECTION_PATHS[r.section];
    if (!path) return;
    navigate(`/${path}?editSubmission=${r.id}`);
  }

  async function handleWithdraw(id: string) {
    if (!window.confirm("Withdraw this submission?")) return;
    setActionError("");
    try {
      await withdrawMySubmission(id);
      await reload();
      showToast("Submission withdrawn.");
    } catch {
      setActionError("Failed to withdraw submission");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="My Submissions"
        description="Track your proposed changes. Edit or withdraw pending ones before an Admin reviews them."
      >
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {actionError && <p role="alert" className="mb-2 text-sm text-destructive">{actionError}</p>}

        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={submissions}
              loading={loading}
              isAdmin={false}
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
                  render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
                },
                {
                  header: "Reason",
                  sortKey: "reject_reason",
                  render: (r) =>
                    r.status === "rejected" ? (
                      <span className="text-muted-foreground">{r.reject_reason || "—"}</span>
                    ) : null,
                },
                {
                  header: "Actions",
                  sortKey: "status",
                  render: (r) =>
                    r.status === "pending" ? (
                      <span className="flex gap-2">
                        {r.action !== "delete" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleEdit(r); }}
                            aria-label="Edit submission"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleWithdraw(r.id); }}
                          aria-label="Withdraw submission"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </span>
                    ) : null,
                },
              ]}
              detailTitle={(r) => `${sectionLabel(r.section)} — ${r.action}`}
              detailFields={(r) => [
                { label: "Submitted At", value: formatDatetime(r.created_at) },
                { label: "Section", value: sectionLabel(r.section) },
                { label: "Action", value: r.action },
                { label: "Status", value: r.status },
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
              getSubtitle={(r) => formatDatetime(r.created_at)}
              getBadge={(r) => ({ label: r.status, variant: statusVariant(r.status) })}
              emptyMessage="You have no submissions yet."
              pageSize={25}
            />
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
