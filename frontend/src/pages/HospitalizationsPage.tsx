import { useEffect, useState, type FormEvent } from "react";
import { hospitalizationsApi, type Hospitalization, type HospitalizationInput } from "../api/hospitalizations";
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

export default function HospitalizationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Hospitalization[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<HospitalizationInput>({ facility: "" });
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState<Hospitalization | null>(null);
  const [editForm, setEditForm] = useState<HospitalizationInput>({ facility: "" });
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await hospitalizationsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load hospitalizations"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await hospitalizationsApi.create(form); setForm({ facility: "" }); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await hospitalizationsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function openEdit(r: Hospitalization) {
    setEditingRow(r);
    setEditForm({ facility: r.facility, admission_date: r.admission_date, discharge_date: r.discharge_date, reason: r.reason, attending_physician_id: r.attending_physician_id, attending_physician_other: r.attending_physician_other, outcome: r.outcome, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await hospitalizationsApi.update(editingRow.id, editForm);
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
      <PageLayout title="Hospitalizations" description="Hospital stays and inpatient events.">
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
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

        {isAdmin && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <form onSubmit={onAdd}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Facility (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Facility" htmlFor="facility">
                      <Input
                        id="facility"
                        type="text"
                        required
                        value={form.facility}
                        onChange={(e) => setForm((s) => ({ ...s, facility: e.target.value }))}
                        placeholder="e.g. General Hospital"
                      />
                    </FormField>
                  </div>

                  {/* Admission Date | Discharge Date */}
                  <FormField label="Admission Date" htmlFor="admission_date">
                    <Input
                      id="admission_date"
                      type="date"
                      value={form.admission_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, admission_date: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="Discharge Date" htmlFor="discharge_date">
                    <Input
                      id="discharge_date"
                      type="date"
                      value={form.discharge_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, discharge_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Reason (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Reason" htmlFor="reason">
                      <Input
                        id="reason"
                        type="text"
                        value={form.reason ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))}
                        placeholder="e.g. Pneumonia"
                      />
                    </FormField>
                  </div>

                  {/* Attending Physician (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Doctor" htmlFor="attending_physician">
                      <DoctorPicker
                        doctorId={form.attending_physician_id ?? null}
                        doctorOther={form.attending_physician_other ?? null}
                        onChange={(id, other) => setForm((s) => ({ ...s, attending_physician_id: id, attending_physician_other: other }))}
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
        <div role="dialog" aria-modal="true" aria-labelledby="edit-hosp-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-hosp-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Hospitalization</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Facility" htmlFor="edit-hosp-facility">
                    <Input id="edit-hosp-facility" required value={editForm.facility ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, facility: e.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Admission Date" htmlFor="edit-hosp-admission">
                  <Input id="edit-hosp-admission" type="date" value={editForm.admission_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, admission_date: e.target.value || null }))} />
                </FormField>
                <FormField label="Discharge Date" htmlFor="edit-hosp-discharge">
                  <Input id="edit-hosp-discharge" type="date" value={editForm.discharge_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, discharge_date: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Reason" htmlFor="edit-hosp-reason">
                    <Input id="edit-hosp-reason" value={editForm.reason ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, reason: e.target.value || null }))} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Doctor" htmlFor="edit-hosp-doctor">
                    <DoctorPicker
                      doctorId={editForm.attending_physician_id ?? null}
                      doctorOther={editForm.attending_physician_other ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, attending_physician_id: id, attending_physician_other: other }))}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Outcome" htmlFor="edit-hosp-outcome">
                    <Textarea id="edit-hosp-outcome" value={editForm.outcome ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, outcome: e.target.value || null }))} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-hosp-notes">
                    <Textarea id="edit-hosp-notes" value={editForm.notes ?? ""}
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
