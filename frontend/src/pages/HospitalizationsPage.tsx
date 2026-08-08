import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { hospitalizationsApi, type Hospitalization, type HospitalizationInput } from "../api/hospitalizations";
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

const EMPTY: HospitalizationInput = {
  facility: "",
  admission_date: null,
  discharge_date: null,
  reason: null,
  attending_physician_id: null,
  attending_physician_other: null,
  outcome: null,
  notes: null,
};

export default function HospitalizationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const { showToast, showAck } = useToast();
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<Hospitalization[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Hospitalization | null>(null);
  const [form, setForm] = useState<HospitalizationInput>(EMPTY);
  const [modalError, setModalError] = useState("");
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  async function reload() { setRows(await hospitalizationsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load hospitalizations"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canWrite) return;
    const openId = searchParams.get("open");
    if (!openId || rows.length === 0) return;
    const record = rows.find((r) => r.id === openId);
    if (record) {
      openEdit(record);
      setSearchParams({}, { replace: true });
    }
  }, [rows, searchParams]);

  useEffect(() => {
    if (!isContributor) return;
    const sid = searchParams.get("editSubmission");
    if (!sid) return;
    getMySubmission(sid).then((sub) => {
      setForm({ ...EMPTY, ...(sub.payload as Partial<HospitalizationInput>) });
      setEditingRow(null);
      // Amend only while it is still pending. A rejected submission is
      // reopened as a FRESH proposal — the backend 409s any edit to it.
      setEditingSubmissionId(sub.status === "pending" ? sid : null);
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

  function openEdit(r: Hospitalization) {
    setEditingRow(r);
    setForm({ facility: r.facility, admission_date: r.admission_date, discharge_date: r.discharge_date, reason: r.reason, attending_physician_id: r.attending_physician_id, attending_physician_other: r.attending_physician_other, outcome: r.outcome, notes: r.notes });
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
        await hospitalizationsApi.update(editingRow.id, form);
      } else {
        await hospitalizationsApi.create(form);
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

  async function onDelete(id: string) {
    const msg = isContributor
      ? "Submit a deletion request for this hospitalization record? An Admin must approve before it is removed."
      : "Delete this hospitalization record?";
    if (!window.confirm(msg)) return;
    try { await hospitalizationsApi.remove(id); await reload(); isContributor
        ? showAck("Deletion submitted for approval.")
        : showToast("Deleted."); }
    catch { setError("Could not delete record"); }
  }

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  return (
    <AppShell>
      <PageLayout
        title="Hospitalizations"
        description="Hospital stays and inpatient events."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="admission_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Admission", sortKey: "admission_date", render: (r) => r.admission_date ?? "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Facility", sortKey: "facility", render: (r) => r.facility },
                { header: "Reason", sortKey: "reason", render: (r) => r.reason ?? "" },
              ]}
              detailTitle={(r) => r.facility}
              detailFields={(r) => [
                { label: "Admission", value: r.admission_date },
                { label: "Discharge", value: r.discharge_date },
                { label: "Reason", value: r.reason },
                { label: "Doctor", value: resolveDoctorName(r.attending_physician_id, r.attending_physician_other) || null },
                { label: "Outcome", value: r.outcome },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="hospitalizations" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.facility}
              getSubtitle={(r) => r.admission_date ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No hospitalization records yet."
            />
          </CardContent>
        </Card>
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Hospitalization" : "Add Hospitalization"}
          submitLabel={submitLabel}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          {contributorNotice && (
            <p className="text-sm text-muted-foreground">{contributorNotice}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Facility" htmlFor="hosp-facility">
                <Input
                  id="hosp-facility"
                  type="text"
                  required
                  value={form.facility}
                  onChange={(e) => setForm((s) => ({ ...s, facility: e.target.value }))}
                  placeholder="e.g. General Hospital"
                />
              </FormField>
            </div>
            <FormField label="Admission Date" htmlFor="hosp-admission">
              <Input
                id="hosp-admission"
                type="date"
                value={form.admission_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, admission_date: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Discharge Date" htmlFor="hosp-discharge">
              <Input
                id="hosp-discharge"
                type="date"
                value={form.discharge_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, discharge_date: e.target.value || null }))}
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Reason" htmlFor="hosp-reason">
                <Input
                  id="hosp-reason"
                  type="text"
                  value={form.reason ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))}
                  placeholder="e.g. Pneumonia"
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Doctor" htmlFor="hosp-doctor">
                <DoctorPicker
                  doctorId={form.attending_physician_id ?? null}
                  doctorOther={form.attending_physician_other ?? null}
                  onChange={(id, other) => setForm((s) => ({ ...s, attending_physician_id: id, attending_physician_other: other }))}
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Outcome" htmlFor="hosp-outcome">
                <Textarea
                  id="hosp-outcome"
                  value={form.outcome ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, outcome: e.target.value || null }))}
                  placeholder="Describe the outcome..."
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="hosp-notes">
                <Textarea
                  id="hosp-notes"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                  placeholder="Additional notes..."
                />
              </FormField>
            </div>
          </div>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
