import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { surgeriesApi, PROCEDURE_TYPES, PROCEDURE_TYPE_LABELS, type Surgery, type SurgeryInput } from "../api/surgeries";
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
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { TypeFilterPills } from "@/components/TypeFilterPills";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: SurgeryInput = {
  procedure: "",
  procedure_type: "surgery",
  surgery_date: null,
  surgeon_id: null,
  surgeon_other: null,
  hospital: null,
  outcome: null,
  notes: null,
};

export default function SurgeriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const { showToast, showAck } = useToast();
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Surgery | null>(null);
  const [form, setForm] = useState<SurgeryInput>(EMPTY);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(() => new Set(PROCEDURE_TYPES.map((t) => t.value)));

  function toggleType(v: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }
  const [modalError, setModalError] = useState("");
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  async function reload() { setRows(await surgeriesApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load surgeries"); setRows([]); }).finally(() => setLoading(false));
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
      setForm({ ...EMPTY, ...(sub.payload as Partial<SurgeryInput>) });
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

  function openEdit(r: Surgery) {
    setEditingRow(r);
    setForm({ procedure: r.procedure, procedure_type: r.procedure_type, surgery_date: r.surgery_date, surgeon_id: r.surgeon_id, surgeon_other: r.surgeon_other, hospital: r.hospital, outcome: r.outcome, notes: r.notes });
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
        await surgeriesApi.update(editingRow.id, form);
      } else {
        await surgeriesApi.create(form);
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
      ? "Submit a deletion request for this surgery record? An Admin must approve before it is removed."
      : "Delete this surgery record?";
    if (!window.confirm(msg)) return;
    try { await surgeriesApi.remove(id); await reload(); isContributor
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
        title="Procedures"
        description="Surgeries, out-patient, and clinic procedures with outcomes."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <TypeFilterPills options={PROCEDURE_TYPES} active={typeFilter} onToggle={toggleType} />
            <RecordTable
              rows={rows.filter((r) => typeFilter.has(r.procedure_type))}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="surgery_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date", sortKey: "surgery_date", render: (r) => r.surgery_date ?? "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Procedure", sortKey: "procedure", render: (r) => r.procedure },
                { header: "Surgeon", sortKey: "surgeon_other", render: (r) => resolveDoctorName(r.surgeon_id, r.surgeon_other) },
                { header: "Type", sortKey: "procedure_type", render: (r) => <Badge variant={r.procedure_type === "surgery" ? "secondary" : "outline"}>{PROCEDURE_TYPE_LABELS[r.procedure_type] ?? r.procedure_type}</Badge> },
              ]}
              detailTitle={(r) => r.procedure}
              detailFields={(r) => [
                { label: "Date", value: r.surgery_date },
                { label: "Type", value: PROCEDURE_TYPE_LABELS[r.procedure_type] ?? r.procedure_type },
                { label: "Surgeon", value: resolveDoctorName(r.surgeon_id, r.surgeon_other) || null },
                { label: "Hospital", value: r.hospital },
                { label: "Outcome", value: r.outcome },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="surgeries" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.procedure}
              getSubtitle={(r) => r.surgery_date ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No surgery records yet."
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
          title={modalMode === "edit" ? "Edit Procedure" : "Add Procedure"}
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
              <FormField label="Procedure" htmlFor="surg-procedure">
                <Input
                  id="surg-procedure"
                  type="text"
                  required
                  value={form.procedure}
                  onChange={(e) => setForm((s) => ({ ...s, procedure: e.target.value }))}
                  placeholder="e.g. Appendectomy"
                />
              </FormField>
            </div>
            <FormField label="Procedure Type" htmlFor="surg-procedure-type">
              <Select
                id="surg-procedure-type"
                value={form.procedure_type ?? "surgery"}
                onChange={(e) => setForm((s) => ({ ...s, procedure_type: e.target.value }))}
              >
                {PROCEDURE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="surg-date">
              <Input
                id="surg-date"
                type="date"
                value={form.surgery_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, surgery_date: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Hospital" htmlFor="surg-hospital">
              <Input
                id="surg-hospital"
                type="text"
                value={form.hospital ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, hospital: e.target.value || null }))}
                placeholder="e.g. General Hospital"
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Surgeon" htmlFor="surg-surgeon">
                <DoctorPicker
                  doctorId={form.surgeon_id ?? null}
                  doctorOther={form.surgeon_other ?? null}
                  onChange={(id, other) => setForm((s) => ({ ...s, surgeon_id: id, surgeon_other: other }))}
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Outcome" htmlFor="surg-outcome">
                <Textarea
                  id="surg-outcome"
                  value={form.outcome ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, outcome: e.target.value || null }))}
                  placeholder="Describe the outcome..."
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="surg-notes">
                <Textarea
                  id="surg-notes"
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
