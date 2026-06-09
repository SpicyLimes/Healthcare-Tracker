import React, { useEffect, useState, type FormEvent } from "react";
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
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { SortableTh } from "@/components/SortableTh";

export default function HospitalizationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Hospitalization[]>([]);
  const [loading, setLoading] = useState(true);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows, "admission_date", "asc");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<HospitalizationInput>({ facility: "" });
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-8" />
                    <SortableTh label="Facility" sortKey="facility" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Admission" sortKey="admission_date" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Discharge" sortKey="discharge_date" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Reason" sortKey="reason" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Doctor" sortKey="attending_physician_id" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Outcome" sortKey="outcome" sort={sort} onSort={toggleSort} />
                    {isAdmin && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="text-center py-6 text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && sortedRows.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-2 py-3 w-8">
                          <button
                            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={expandedId === r.id ? "Collapse" : "Expand"}
                          >
                            {expandedId === r.id
                              ? <ChevronDown className="size-4" />
                              : <ChevronRight className="size-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{r.facility}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.admission_date ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.discharge_date ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.reason ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {resolveDoctorName(r.attending_physician_id, r.attending_physician_other)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.outcome ?? ""}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 space-x-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>Delete</Button>
                          </td>
                        )}
                      </tr>
                      {expandedId === r.id && (
                        <tr className="bg-muted/20">
                          <td colSpan={isAdmin ? 8 : 7} className="px-4 py-3 text-sm text-muted-foreground">
                            <div className="flex flex-col gap-3">
                              {r.notes && (
                                <div className="whitespace-pre-wrap">
                                  <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                                </div>
                              )}
                              <DocumentsPanel section="hospitalizations" recordId={r.id} isAdmin={isAdmin} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No hospitalization records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
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
