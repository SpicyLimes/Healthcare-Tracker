import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { medicationsApi, type Medication, type MedicationInput, type MedicationKind } from "../api/medications";
import { amendMySubmission, getMySubmission } from "../api/submissions";
import DoctorPicker from "../components/DoctorPicker";
import PharmacyPicker from "../components/PharmacyPicker";
import { useAuth } from "../auth/useAuth";
import { useToast } from "../components/toast";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: MedicationInput = {
  name: "",
  kind: "medication",
  dose: null,
  frequency: null,
  route: null,
  prescribing_doctor: null,
  prescribing_doctor_id: null,
  pharmacy_id: null,
  start_date: null,
  end_date: null,
  is_active: true,
  notes: null,
};

export default function MedicationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const { showToast, showAck } = useToast();
  const canWrite = isAdmin || isContributor;
  const submitLabel = isContributor ? "Submit for Approval" : "Save";
  const contributorNotice = isContributor
    ? "As a Contributor, your changes will be submitted for Admin review before taking effect."
    : null;
  const [rows, setRows] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Medication | null>(null);
  const [form, setForm] = useState<MedicationInput>(EMPTY);
  const [modalError, setModalError] = useState("");
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  async function reload() {
    setRows(await medicationsApi.list());
  }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load medications"); setRows([]); }).finally(() => setLoading(false));
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

  // Contributor edit-submission deep-link: ?editSubmission=<id> reopens the
  // form pre-filled from the pending submission's payload; saving amends it.
  useEffect(() => {
    if (!isContributor) return;
    const sid = searchParams.get("editSubmission");
    if (!sid) return;
    getMySubmission(sid).then((sub) => {
      setForm({ ...EMPTY, ...(sub.payload as Partial<MedicationInput>) });
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

  function openEdit(r: Medication) {
    setEditingRow(r);
    setForm({
      name: r.name, kind: r.kind, dose: r.dose, frequency: r.frequency,
      route: r.route,
      // prescribing_doctor arrives RESOLVED (linked doctor's name); writing it
      // back would clobber the free-text column, so null it when linked by id.
      prescribing_doctor: r.prescribing_doctor_id ? null : r.prescribing_doctor,
      prescribing_doctor_id: r.prescribing_doctor_id,
      pharmacy_id: r.pharmacy_id,
      start_date: r.start_date, end_date: r.end_date,
      is_active: r.is_active, notes: r.notes,
    });
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
        await medicationsApi.update(editingRow.id, form);
      } else {
        await medicationsApi.create(form);
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
      ? `Submit a deletion request for ${label ?? "this medication"}? An Admin must approve before it is removed.`
      : `Delete ${label ?? "this medication"}?`;
    if (!window.confirm(msg)) return;
    try {
      await medicationsApi.remove(id);
      await reload();
      isContributor
        ? showAck("Deletion submitted for approval.")
        : showToast("Deleted.");
    } catch {
      setError("Could not delete record");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Medications"
        description="Track current and past medications, dosages, and prescribing doctors."
        action={canWrite ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={canWrite}
              getRowId={(r) => r.id}
              defaultSortKey="is_active"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Name", sortKey: "name", render: (r) => r.name, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Dose", sortKey: "dose", render: (r) => r.dose ?? "" },
                { header: "Active", sortKey: "is_active", render: (r) => (r.is_active ? "Yes" : "No") },
              ]}
              detailTitle={(r) => r.name}
              detailFields={(r) => [
                { label: "Kind", value: r.kind ? r.kind.charAt(0).toUpperCase() + r.kind.slice(1) : null },
                { label: "Dose", value: r.dose },
                { label: "Frequency", value: r.frequency },
                { label: "Route", value: r.route ? r.route.charAt(0).toUpperCase() + r.route.slice(1) : null },
                { label: "Prescribing Doctor", value: r.prescribing_doctor },
                { label: "Pharmacy", value: r.pharmacy_name },
                { label: "Start Date", value: r.start_date },
                { label: "End Date", value: r.end_date },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="medications" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.name}
              getSubtitle={(r) => [r.dose, r.route, r.frequency].filter(Boolean).join(" · ") || null}
              getBadge={(r) => ({ label: r.is_active ? "Active" : "Inactive", variant: r.is_active ? "default" : "secondary" })}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id, r.name)}
              emptyMessage="No medication records yet."
            />
          </CardContent>
        </Card>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Medication" : "Add Medication"}
          submitLabel={submitLabel}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          {contributorNotice && (
            <p className="text-sm text-muted-foreground">{contributorNotice}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Medication Name" htmlFor="med-name">
              <Input id="med-name" required placeholder="e.g. Lisinopril"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            </FormField>
            <FormField label="Kind" htmlFor="med-kind">
              <Select id="med-kind" value={form.kind ?? "medication"}
                onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as MedicationKind }))}>
                <option value="medication">Medication</option>
                <option value="vitamin">Vitamin</option>
                <option value="supplement">Supplement</option>
              </Select>
            </FormField>
            <FormField label="Dose" htmlFor="med-dose">
              <Input id="med-dose" placeholder="e.g. 10 mg"
                value={form.dose ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, dose: e.target.value || null }))} />
            </FormField>
            <FormField label="Frequency" htmlFor="med-frequency">
              <Input id="med-frequency" placeholder="e.g. Once daily"
                value={form.frequency ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, frequency: e.target.value || null }))} />
            </FormField>
            <FormField label="Route" htmlFor="med-route">
              <Select id="med-route" value={form.route ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, route: e.target.value || null }))}>
                <option value="">Select…</option>
                <option value="oral">Oral</option>
                <option value="topical">Topical</option>
                <option value="injection">Injection</option>
                <option value="inhaled">Inhaled</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="med-active">
              <Select id="med-active" value={form.is_active === false ? "false" : "true"}
                onChange={(e) => {
                  const active = e.target.value === "true";
                  setForm((s) => ({
                    ...s,
                    is_active: active,
                    // Stopping a medication records WHEN. is_active and end_date
                    // were independent, so "when did she stop it?" — asked at
                    // nearly every follow-up — was unanswerable. Prefilled, not
                    // forced: the field stays editable below.
                    end_date:
                      !active && !s.end_date
                        ? new Date().toLocaleDateString("en-CA")
                        : s.end_date,
                  }));
                }}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </FormField>
            <FormField label="Start Date" htmlFor="med-start-date">
              <Input id="med-start-date" type="date"
                value={form.start_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value || null }))} />
            </FormField>
            <FormField label="End Date" htmlFor="med-end-date">
              <Input id="med-end-date" type="date"
                value={form.end_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value || null }))} />
            </FormField>
          </div>
          <FormField label="Prescribing Doctor" htmlFor="med-prescriber">
            <DoctorPicker
              doctorId={form.prescribing_doctor_id ?? null}
              doctorOther={form.prescribing_doctor ?? null}
              onChange={(id, other) => setForm((s) => ({ ...s, prescribing_doctor_id: id, prescribing_doctor: other }))}
            />
          </FormField>
          <FormField label="Pharmacy" htmlFor="med-pharmacy">
            <PharmacyPicker
              pharmacyId={form.pharmacy_id ?? null}
              onChange={(id) => setForm((s) => ({ ...s, pharmacy_id: id }))}
            />
          </FormField>
          <FormField label="Notes" htmlFor="med-notes">
            <Textarea id="med-notes" placeholder="Side effects, instructions, or other notes…"
              value={form.notes ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))} />
          </FormField>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
