// frontend/src/pages/BackupsPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  backupDownloadUrl, createBackup, deleteBackup, listBackups, restoreBackup, uploadBackup,
  type Backup,
} from "../api/backups";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form-field";
import { formatInTimezone } from "@/lib/datetime";
import { useAuth } from "../auth/useAuth";
import { RecordTable } from "@/components/RecordTable";

const TYPE_LABELS: Record<Backup["type"], string> = {
  nightly: "Nightly",
  manual: "Manual",
  safety: "Safety",
  uploaded: "Uploaded",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function BackupsPage() {
  const { user, logout } = useAuth();
  const tz = user?.timezone ?? "America/Chicago";
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    try {
      setBackups(await listBackups());
    } catch {
      setError("Failed to load backups");
    }
  }

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, []);

  async function handleBackupNow() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const created = await createBackup();
      setNotice(`Backup created: ${created.id}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create backup");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const uploaded = await uploadBackup(file);
      setNotice(`Backup uploaded: ${uploaded.id}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload backup");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(b: Backup) {
    if (!window.confirm(`Permanently delete backup ${b.id}? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteBackup(b.id);
      await reload();
    } catch {
      setError("Failed to delete backup");
    }
  }

  async function handleRestore() {
    if (!restoreTarget || confirmText !== restoreTarget.id) return;
    setRestoring(true);
    setError("");
    try {
      await restoreBackup(restoreTarget.id, confirmText);
      // The users/sessions tables were just replaced; this session can't be trusted.
      await logout();
      window.location.href = "/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore backup");
      setRestoring(false);
      setRestoreTarget(null);
      setConfirmText("");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Backups"
        description="Nightly backups run at 2:00 AM server time. Download one to keep a copy, or restore to roll everything back."
        action={
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              Upload Backup
            </Button>
            <Button disabled={busy} onClick={handleBackupNow}>
              {busy ? "Working..." : "Backup Now"}
            </Button>
          </div>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".tar"
          className="hidden"
          aria-label="Upload backup archive"
          onChange={handleUpload}
        />

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

        {restoreTarget && (
          <div
            role="dialog"
            aria-label="Confirm restore"
            className="mb-4 rounded-xl border border-destructive bg-card p-4"
          >
            <p className="font-medium text-foreground">
              Restore <span className="font-mono">{restoreTarget.id}</span>?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              This replaces the ENTIRE database and all uploaded documents with this
              backup's contents. A safety backup is taken first. Everyone (including you)
              will be signed out. Type the backup name to confirm.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                placeholder={restoreTarget.id}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-64 font-mono"
              />
              <Button
                variant="destructive"
                disabled={confirmText !== restoreTarget.id || restoring}
                onClick={handleRestore}
              >
                {restoring ? "Restoring..." : "Restore Backup"}
              </Button>
              <Button
                variant="outline"
                disabled={restoring}
                onClick={() => { setRestoreTarget(null); setConfirmText(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={backups}
              loading={loading}
              isAdmin={true}
              getRowId={(r) => r.id}
              defaultSortKey="created_at"
              defaultSortDir="desc"
              primaryColumns={[
                {
                  header: "Name",
                  sortKey: "id",
                  render: (r) => <span className="font-mono font-medium text-foreground">{r.id}</span>,
                },
                {
                  header: "Type",
                  sortKey: "type",
                  render: (r) => (
                    <Badge variant={r.type === "nightly" ? "default" : "secondary"}>
                      {TYPE_LABELS[r.type]}
                    </Badge>
                  ),
                },
                {
                  header: "Created",
                  sortKey: "created_at",
                  render: (r) => formatInTimezone(r.created_at, tz),
                },
                {
                  header: "Size",
                  sortKey: "size_bytes",
                  render: (r) => formatBytes(r.size_bytes),
                },
              ]}
              detailTitle={(r) => r.id}
              detailFields={(r) => [
                { label: "Name", value: r.id },
                { label: "Type", value: TYPE_LABELS[r.type] },
                { label: "Created", value: formatInTimezone(r.created_at, tz) },
                { label: "Size", value: formatBytes(r.size_bytes) },
                { label: "Complete", value: r.complete ? "Yes" : "No (missing files)" },
              ]}
              renderDetailExtra={(r) => (
                <div className="flex flex-wrap gap-2 pt-2">
                  {r.complete && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setRestoreTarget(r); setConfirmText(""); }}
                    >
                      Restore
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(r)}>
                    Delete
                  </Button>
                </div>
              )}
              renderRowActions={(r) =>
                r.complete ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={backupDownloadUrl(r.id)} download>Download</a>
                  </Button>
                ) : null
              }
              getHeadline={(r) => r.id}
              getSubtitle={(r) => `${TYPE_LABELS[r.type]} — ${formatBytes(r.size_bytes)}`}
              getBadge={(r) => ({ label: TYPE_LABELS[r.type], variant: r.type === "nightly" ? "default" : "secondary" })}
              emptyMessage="No backups yet. The nightly job runs at 2:00 AM, or click Backup Now."
            />
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
