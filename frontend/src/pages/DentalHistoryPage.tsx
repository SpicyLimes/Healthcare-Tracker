import { useEffect, useState, type FormEvent } from "react";
import { dentalHistoryApi, type DentalHistory, type DentalHistoryInput } from "../api/dentalHistory";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: DentalHistoryInput = {
  visit_date: null,
  provider_id: null,
  provider_other: null,
  procedure: null,
  notes: null,
};

export default function DentalHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<DentalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<DentalHistory | null>(null);
  const [form, setForm] = useState<DentalHistoryInput>(EMPTY);
  const [modalError, setModalError] = useState("");

  async function reload() { setRows(await dentalHistoryApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load dental history"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

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

  function openEdit(r: DentalHistory) {
    setEditingRow(r);
    setForm({ visit_date: r.visit_date, provider_id: r.provider_id, provider_other: r.provider_other, procedure: r.procedure, notes: r.notes });
    setModalError("");
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingRow(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    try {
      if (modalMode === "edit" && editingRow) {
        await dentalHistoryApi.update(editingRow.id, form);
      } else {
        await dentalHistoryApi.create(form);
      }
      closeModal();
      await reload();
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add record");
    }
  }

  async function onDelete(id: string) {
    try { await dentalHistoryApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <AppShell>
      <PageLayout
        title="Dental History"
        description="Dental visits, procedures, and oral health records."
        action={isAdmin ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="visit_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date", sortKey: "visit_date", render: (r) => r.visit_date ?? "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Provider", sortKey: "provider_other", render: (r) => resolveDoctorName(r.provider_id, r.provider_other) },
                { header: "Procedure", sortKey: "procedure", render: (r) => r.procedure ?? "" },
              ]}
              detailTitle={(r) => r.procedure ?? r.visit_date ?? "Dental Visit"}
              detailFields={(r) => [
                { label: "Date", value: r.visit_date },
                { label: "Provider", value: resolveDoctorName(r.provider_id, r.provider_other) || null },
                { label: "Procedure", value: r.procedure },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="dental_history" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.procedure ?? r.visit_date ?? "Dental Visit"}
              getSubtitle={(r) => r.visit_date ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No dental history records yet."
            />
          </CardContent>
        </Card>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Dental Record" : "Add Dental Record"}
          submitLabel={modalMode === "edit" ? "Save" : "Add Record"}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Visit Date" htmlFor="dent-date">
              <Input
                id="dent-date"
                type="date"
                required
                value={form.visit_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Procedure" htmlFor="dent-procedure">
              <Input
                id="dent-procedure"
                type="text"
                value={form.procedure ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, procedure: e.target.value || null }))}
                placeholder="e.g. Cleaning, Filling"
              />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Provider" htmlFor="dent-provider">
              <DoctorPicker
                doctorId={form.provider_id ?? null}
                doctorOther={form.provider_other ?? null}
                onChange={(id, other) => setForm((s) => ({ ...s, provider_id: id, provider_other: other }))}
              />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="dent-notes">
            <Textarea
              id="dent-notes"
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
