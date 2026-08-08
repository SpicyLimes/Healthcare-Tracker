import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { visionHistoryApi, type VisionHistory, type VisionHistoryInput } from "../api/visionHistory";
import { amendMySubmission, getMySubmission } from "../api/submissions";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import { useToast } from "../components/toast";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: VisionHistoryInput = {
  visit_date: null,
  provider_id: null,
  provider_other: null,
  rx_od: null,
  rx_os: null,
  notes: null,
};

export default function VisionHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const { showToast, showAck } = useToast();
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<VisionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<VisionHistory | null>(null);
  const [form, setForm] = useState<VisionHistoryInput>(EMPTY);
  const [modalError, setModalError] = useState("");
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  async function reload() { setRows(await visionHistoryApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load vision history"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isContributor) return;
    const sid = searchParams.get("editSubmission");
    if (!sid) return;
    getMySubmission(sid).then((sub) => {
      setForm({ ...EMPTY, ...(sub.payload as Partial<VisionHistoryInput>) });
      setEditingRow(null);
      setEditingSubmissionId(sid);
      setModalError("");
      setModalMode(sub.action === "create" ? "add" : "edit");
      setSearchParams({}, { replace: true });
    }).catch(() => {});
  }, [isContributor, searchParams]);

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: VisionHistory) {
    setEditingRow(r);
    setForm({ visit_date: r.visit_date, provider_id: r.provider_id, provider_other: r.provider_other, rx_od: r.rx_od, rx_os: r.rx_os, notes: r.notes });
    setModalError("");
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingRow(null);
    setEditingSubmissionId(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    try {
      if (editingSubmissionId) {
        await amendMySubmission(editingSubmissionId, form as unknown as Record<string, unknown>);
        closeModal();
        showAck("Your submission has been updated and is awaiting approval.");
        navigate("/my-submissions");
        return;
      }
      if (modalMode === "edit" && editingRow) {
        await visionHistoryApi.update(editingRow.id, form);
      } else {
        await visionHistoryApi.create(form);
      }
      closeModal();
      await reload();
      isContributor
        ? showAck("Submitted for approval — an Admin will review it.")
        : showToast("Saved.");
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add record");
    }
  }

  async function onDelete(id: string, label?: string) {
    const msg = isContributor
      ? `Submit a deletion request for ${label ?? "this vision history record"}? An Admin must approve before it is removed.`
      : `Delete ${label ?? "this vision history record"}?`;
    if (!window.confirm(msg)) return;
    try { await visionHistoryApi.remove(id); await reload(); isContributor
        ? showAck("Deletion submitted for approval.")
        : showToast("Deleted."); }
    catch { setError("Could not delete record"); }
  }

  return (
    <AppShell>
      <PageLayout
        title="Vision History"
        description="Eye exams, prescriptions, and vision care."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="visit_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date", sortKey: "visit_date", render: (r) => r.visit_date ?? "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Provider", sortKey: "provider_other", render: (r) => resolveDoctorName(r.provider_id, r.provider_other) },
                { header: "Rx OD", sortKey: "rx_od", render: (r) => r.rx_od ?? "" },
              ]}
              detailTitle={(r) => r.visit_date ?? "Vision Visit"}
              detailFields={(r) => [
                { label: "Date", value: r.visit_date },
                { label: "Provider", value: resolveDoctorName(r.provider_id, r.provider_other) || null },
                { label: "Rx OD", value: r.rx_od },
                { label: "Rx OS", value: r.rx_os },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="vision_history" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.visit_date ?? "Vision Visit"}
              getSubtitle={(r) => resolveDoctorName(r.provider_id, r.provider_other) || null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id, r.visit_date ?? "Vision Visit")}
              emptyMessage="No vision history records yet."
            />
          </CardContent>
        </Card>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Vision Record" : "Add Vision Record"}
          submitLabel={submitLabel}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          {contributorNotice && (
            <p className="text-sm text-muted-foreground">{contributorNotice}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Visit Date" htmlFor="vis-date">
              <Input
                id="vis-date"
                type="date"
                required
                value={form.visit_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Rx OD (right eye)" htmlFor="vis-rx-od">
              <Input
                id="vis-rx-od"
                type="text"
                value={form.rx_od ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, rx_od: e.target.value || null }))}
                placeholder="e.g. -2.50"
              />
            </FormField>
            <FormField label="Rx OS (left eye)" htmlFor="vis-rx-os">
              <Input
                id="vis-rx-os"
                type="text"
                value={form.rx_os ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, rx_os: e.target.value || null }))}
                placeholder="e.g. -2.75"
              />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Provider" htmlFor="vis-provider">
              <DoctorPicker
                doctorId={form.provider_id ?? null}
                doctorOther={form.provider_other ?? null}
                onChange={(id, other) => setForm((s) => ({ ...s, provider_id: id, provider_other: other }))}
              />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="vis-notes">
            <Textarea
              id="vis-notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
              placeholder="Additional notes..."
            />
          </FormField>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
