import { useEffect, useState, type FormEvent } from "react";
import { surgeriesApi, type Surgery, type SurgeryInput } from "../api/surgeries";
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

export default function SurgeriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<SurgeryInput>({ procedure: "" });
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState<Surgery | null>(null);
  const [editForm, setEditForm] = useState<SurgeryInput>({ procedure: "" });
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await surgeriesApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load surgeries"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await surgeriesApi.create(form);
      setForm({ procedure: "" });
      await reload();
    } catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await surgeriesApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function openEdit(r: Surgery) {
    setEditingRow(r);
    setEditForm({ procedure: r.procedure, surgery_date: r.surgery_date, surgeon_id: r.surgeon_id, surgeon_other: r.surgeon_other, hospital: r.hospital, outcome: r.outcome, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await surgeriesApi.update(editingRow.id, editForm);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  return (
    <AppShell>
      <PageLayout title="Surgery Records" description="Surgical procedures and outcomes.">
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="surgery_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date", sortKey: "surgery_date", render: (r) => r.surgery_date ?? "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Procedure", sortKey: "procedure", render: (r) => r.procedure },
                { header: "Surgeon", sortKey: "surgeon_other", render: (r) => resolveDoctorName(r.surgeon_id, r.surgeon_other) },
              ]}
              detailTitle={(r) => r.procedure}
              detailFields={(r) => [
                { label: "Date", value: r.surgery_date },
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

        {isAdmin && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <form onSubmit={onAdd}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Procedure (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Procedure" htmlFor="procedure">
                      <Input
                        id="procedure"
                        type="text"
                        required
                        value={form.procedure}
                        onChange={(e) => setForm((s) => ({ ...s, procedure: e.target.value }))}
                        placeholder="e.g. Appendectomy"
                      />
                    </FormField>
                  </div>

                  {/* Date | Hospital */}
                  <FormField label="Surgery Date" htmlFor="surgery_date">
                    <Input
                      id="surgery_date"
                      type="date"
                      value={form.surgery_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, surgery_date: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="Hospital" htmlFor="hospital">
                    <Input
                      id="hospital"
                      type="text"
                      value={form.hospital ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, hospital: e.target.value || null }))}
                      placeholder="e.g. General Hospital"
                    />
                  </FormField>

                  {/* Surgeon (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Surgeon" htmlFor="surgeon">
                      <DoctorPicker
                        doctorId={form.surgeon_id ?? null}
                        doctorOther={form.surgeon_other ?? null}
                        onChange={(id, other) => setForm((s) => ({ ...s, surgeon_id: id, surgeon_other: other }))}
                      />
                    </FormField>
                  </div>

                  {/* Outcome (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Outcome" htmlFor="outcome">
                      <Textarea
                        id="outcome"
                        value={form.outcome ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, outcome: e.target.value || null }))}
                        placeholder="Describe the outcome..."
                      />
                    </FormField>
                  </div>

                  {/* Notes (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Notes" htmlFor="notes">
                      <Textarea
                        id="notes"
                        value={form.notes ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                        placeholder="Additional notes..."
                      />
                    </FormField>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add Record</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-surg-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-surg-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Surgery</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Procedure" htmlFor="edit-surg-procedure">
                    <Input id="edit-surg-procedure" required value={editForm.procedure ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, procedure: e.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Surgery Date" htmlFor="edit-surg-date">
                  <Input id="edit-surg-date" type="date" value={editForm.surgery_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, surgery_date: e.target.value || null }))} />
                </FormField>
                <FormField label="Hospital" htmlFor="edit-surg-hospital">
                  <Input id="edit-surg-hospital" value={editForm.hospital ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, hospital: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Surgeon" htmlFor="edit-surg-surgeon">
                    <DoctorPicker
                      doctorId={editForm.surgeon_id ?? null}
                      doctorOther={editForm.surgeon_other ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, surgeon_id: id, surgeon_other: other }))}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Outcome" htmlFor="edit-surg-outcome">
                    <Textarea id="edit-surg-outcome" value={editForm.outcome ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, outcome: e.target.value || null }))} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-surg-notes">
                    <Textarea id="edit-surg-notes" value={editForm.notes ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value || null }))} />
                  </FormField>
                </div>
              </div>
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
