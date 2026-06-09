import React, { useEffect, useState, type FormEvent } from "react";
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
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { SortableTh } from "@/components/SortableTh";

export default function SurgeriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(true);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows, "surgery_date", "asc");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<SurgeryInput>({ procedure: "" });
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-8" />
                    <SortableTh label="Procedure" sortKey="procedure" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Date" sortKey="surgery_date" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Surgeon" sortKey="surgeon_id" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Hospital" sortKey="hospital" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Outcome" sortKey="outcome" sort={sort} onSort={toggleSort} />
                    {isAdmin && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="text-center py-6 text-muted-foreground">
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
                        <td className="px-4 py-3 font-medium text-foreground">{r.procedure}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.surgery_date ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {resolveDoctorName(r.surgeon_id, r.surgeon_other)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.hospital ?? ""}</td>
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
                          <td colSpan={isAdmin ? 7 : 6} className="px-4 py-3 text-sm text-muted-foreground">
                            <div className="flex flex-col gap-3">
                              {r.notes && (
                                <div className="whitespace-pre-wrap">
                                  <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                                </div>
                              )}
                              <DocumentsPanel section="surgeries" recordId={r.id} isAdmin={isAdmin} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No surgery records yet.
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
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
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
