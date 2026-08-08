import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ailmentsApi, type Ailment, type AilmentInput, type AilmentStatus } from "../api/ailments";
import { amendMySubmission, getMySubmission } from "../api/submissions";
import { useAuth } from "../auth/useAuth";
import { useToast } from "../components/toast";
import DocumentsPanel from "../components/DocumentsPanel";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: AilmentInput = {
  condition: "",
  onset_date: null,
  status: "active",
  treating_doctor: null,
  treating_doctor_id: null,
  notes: null,
};

export default function AilmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const { showToast, showAck } = useToast();
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<Ailment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Ailment | null>(null);
  const [form, setForm] = useState<AilmentInput>(EMPTY);
  const [modalError, setModalError] = useState("");
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  async function reload() {
    setRows(await ailmentsApi.list());
  }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load ailments"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isContributor) return;
    const sid = searchParams.get("editSubmission");
    if (!sid) return;
    getMySubmission(sid).then((sub) => {
      setForm({ ...EMPTY, ...(sub.payload as Partial<AilmentInput>) });
      setEditingRow(null);
      setEditingSubmissionId(sid);
      setModalError("");
      setModalMode(sub.action === "create" ? "add" : "edit");
      setSearchParams({}, { replace: true });
    }).catch(() => {});
  }, [isContributor, searchParams]);

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: Ailment) {
    setEditingRow(r);
    setForm({ condition: r.condition, onset_date: r.onset_date, status: r.status, treating_doctor: r.treating_doctor, treating_doctor_id: r.treating_doctor_id, notes: r.notes });
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
        await ailmentsApi.update(editingRow.id, form);
      } else {
        await ailmentsApi.create(form);
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
      ? `Submit a deletion request for ${label ?? "this ailment"}? An Admin must approve before it is removed.`
      : `Delete ${label ?? "this ailment"}?`;
    if (!window.confirm(msg)) return;
    try {
      await ailmentsApi.remove(id);
      await reload();
      isContributor
        ? showAck("Deletion submitted for approval.")
        : showToast("Deleted.");
    } catch {
      setError("Could not delete record");
    }
  }

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  return (
    <AppShell>
      <PageLayout
        title="Ailment History"
        description="Track diagnoses, conditions, and their current status."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="condition"
              primaryColumns={[
                { header: "Condition", sortKey: "condition", render: (r) => r.condition, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Status", sortKey: "status", render: (r) => <Badge variant={r.status === "active" ? "default" : "secondary"} className="capitalize">{r.status}</Badge> },
                { header: "Onset Date", sortKey: "onset_date", render: (r) => r.onset_date ?? "" },
              ]}
              detailTitle={(r) => r.condition}
              detailFields={(r) => [
                { label: "Status", value: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : null },
                { label: "Onset Date", value: r.onset_date },
                { label: "Treating Doctor", value: resolveDoctorName(r.treating_doctor_id, r.treating_doctor) || null },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="ailments" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.condition}
              getSubtitle={(r) => r.onset_date ?? null}
              getBadge={(r) => ({ label: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "", variant: r.status === "active" ? "default" : "secondary" })}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id, r.condition)}
              emptyMessage="No ailment records yet."
            />
          </CardContent>
        </Card>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Ailment" : "Add Ailment"}
          submitLabel={submitLabel}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          {contributorNotice && (
            <p className="text-sm text-muted-foreground">{contributorNotice}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Condition" htmlFor="ail-condition">
              <Input
                id="ail-condition"
                required
                placeholder="e.g. Hypertension"
                value={form.condition}
                onChange={(e) => setForm((s) => ({ ...s, condition: e.target.value }))}
              />
            </FormField>
            <FormField label="Status" htmlFor="ail-status">
              <Select
                id="ail-status"
                value={form.status ?? "active"}
                onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as AilmentStatus }))}
              >
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </Select>
            </FormField>
            <FormField label="Onset Date" htmlFor="ail-onset">
              <Input
                id="ail-onset"
                type="date"
                value={form.onset_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, onset_date: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Treating Doctor" htmlFor="ail-doctor">
              <DoctorPicker
                doctorId={form.treating_doctor_id ?? null}
                doctorOther={form.treating_doctor ?? null}
                onChange={(id, other) => setForm((s) => ({ ...s, treating_doctor_id: id, treating_doctor: other }))}
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="ail-notes">
                <Textarea
                  id="ail-notes"
                  placeholder="Additional notes…"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                />
              </FormField>
            </div>
          </div>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
