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
  const [form, setForm] = useState<DoctorInput>(EMPTY);
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState<Doctor | null>(null);
  const [editForm, setEditForm] = useState<DoctorInput>(EMPTY);
  const [editError, setEditError] = useState("");

  async function reload() {
    setRows(await doctorsApi.list());
  }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load doctors"); setRows([]); }).finally(() => setLoading(false));
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await doctorsApi.create(form);
      setForm(EMPTY);
      await reload();
    } catch {
      setError("Could not add record");
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

  function openEdit(r: Doctor) {
    setEditingRow(r);
    setEditForm({ name: r.name, specialty: r.specialty, practice: r.practice, phone: r.phone, address: r.address, patient_portal_url: r.patient_portal_url, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await doctorsApi.update(editingRow.id, editForm);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout
        title="Doctors & Specialists"
        description="Manage your physicians, specialists, and care providers."
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
        {isAdmin && (
          <Card>
            <CardContent className="py-6">
              <form onSubmit={onAdd} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Practice / Clinic" htmlFor="doc-practice">
                    <Input
                      id="doc-practice"
                      placeholder="Practice or clinic name"
                      value={form.practice ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, practice: e.target.value || null }))}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                <div className="flex justify-end">
                  <Button type="submit">Add Doctor</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-doc-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-doc-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Doctor</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Name" htmlFor="edit-doc-name">
                  <Input id="edit-doc-name" required value={editForm.name ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
                </FormField>
                <FormField label="Specialty" htmlFor="edit-doc-specialty">
                  <Input id="edit-doc-specialty" value={editForm.specialty ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, specialty: e.target.value || null }))} />
                </FormField>
                <FormField label="Practice / Clinic" htmlFor="edit-doc-practice">
                  <Input id="edit-doc-practice" value={editForm.practice ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, practice: e.target.value || null }))} />
                </FormField>
                <FormField label="Phone" htmlFor="edit-doc-phone">
                  <Input id="edit-doc-phone" type="tel" value={editForm.phone ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value || null }))} />
                </FormField>
                <FormField label="Patient Portal URL" htmlFor="edit-doc-portal">
                  <Input id="edit-doc-portal" type="url" value={editForm.patient_portal_url ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, patient_portal_url: e.target.value || null }))} />
                </FormField>
              </div>
              <FormField label="Address" htmlFor="edit-doc-address">
                <Textarea id="edit-doc-address" value={editForm.address ?? ""}
                  onChange={(e) => setEditForm((s) => ({ ...s, address: e.target.value || null }))} />
              </FormField>
              <FormField label="Notes" htmlFor="edit-doc-notes">
                <Textarea id="edit-doc-notes" value={editForm.notes ?? ""}
                  onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value || null }))} />
              </FormField>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeEdit}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
