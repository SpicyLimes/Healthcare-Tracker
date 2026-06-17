import { useEffect, useState, type FormEvent } from "react";
import { doctorsApi, type Doctor, type DoctorInput } from "../api/doctors";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const EMPTY: DoctorInput = {
  name: "",
  specialty: null,
  practice: null,
  phone: null,
  address: null,
  patient_portal_url: null,
  notes: null,
};

export default function DoctorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Doctor | null>(null);
  const [form, setForm] = useState<DoctorInput>(EMPTY);
  const [modalError, setModalError] = useState("");

  async function reload() {
    setRows(await doctorsApi.list());
  }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load doctors"); setRows([]); }).finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: Doctor) {
    setEditingRow(r);
    setForm({ name: r.name, specialty: r.specialty, practice: r.practice, phone: r.phone, address: r.address, patient_portal_url: r.patient_portal_url, notes: r.notes });
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
        await doctorsApi.update(editingRow.id, form);
      } else {
        await doctorsApi.create(form);
      }
      closeModal();
      await reload();
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add record");
    }
  }

  async function onDelete(id: string) {
    try {
      await doctorsApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete record");
    }
  }

  return (
    <AppShell>
      <PageLayout
        title="Doctors & Specialists"
        description="Manage your physicians, specialists, and care providers."
        action={isAdmin ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="name"
              primaryColumns={[
                { header: "Name", sortKey: "name", render: (r) => r.name, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Specialty", sortKey: "specialty", render: (r) => r.specialty ?? "" },
                { header: "Phone", sortKey: "phone", render: (r) => r.phone ?? "" },
              ]}
              detailTitle={(r) => r.name}
              detailFields={(r) => [
                { label: "Specialty", value: r.specialty },
                { label: "Practice", value: r.practice },
                { label: "Phone", value: r.phone },
                { label: "Fax", value: r.fax },
                { label: "Address", value: r.address },
                { label: "Portal URL", value: r.patient_portal_url },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="doctors" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.name}
              getSubtitle={(r) => r.specialty ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No doctor records yet."
            />
          </CardContent>
        </Card>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Doctor" : "Add Doctor"}
          submitLabel={modalMode === "edit" ? "Save" : "Add Doctor"}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="doc-name">
              <Input
                id="doc-name"
                required
                placeholder="Doctor's full name"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Specialty" htmlFor="doc-specialty">
              <Input
                id="doc-specialty"
                placeholder="e.g. Cardiology"
                value={form.specialty ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, specialty: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Practice / Clinic" htmlFor="doc-practice">
              <Input
                id="doc-practice"
                placeholder="Practice or clinic name"
                value={form.practice ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, practice: e.target.value || null }))}
              />
            </FormField>
            <FormField label="Phone" htmlFor="doc-phone">
              <Input id="doc-phone" type="tel" placeholder="(555) 000-0000"
                value={form.phone ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value || null }))} />
            </FormField>
            <FormField label="Patient Portal URL" htmlFor="doc-portal">
              <Input id="doc-portal" type="url" placeholder="https://portal.example.com"
                value={form.patient_portal_url ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, patient_portal_url: e.target.value || null }))} />
            </FormField>
          </div>
          <FormField label="Address" htmlFor="doc-address">
            <Textarea id="doc-address" placeholder="Street address, city, state, zip"
              value={form.address ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value || null }))} />
          </FormField>
          <FormField label="Notes" htmlFor="doc-notes">
            <Textarea
              id="doc-notes"
              placeholder="Additional notes…"
              value={form.notes ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
            />
          </FormField>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
