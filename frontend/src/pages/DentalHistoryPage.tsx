import React, { useEffect, useState, type FormEvent } from "react";
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
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { SortableTh } from "@/components/SortableTh";

export default function DentalHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<DentalHistory[]>([]);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows, "visit_date", "asc");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<DentalHistoryInput>({});
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<DentalHistory | null>(null);
  const [editForm, setEditForm] = useState<DentalHistoryInput>({});
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await dentalHistoryApi.list()); }
  useEffect(() => {
    reload().catch(() => setError("Failed to load dental history"));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await dentalHistoryApi.create(form); setForm({}); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await dentalHistoryApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function openEdit(r: DentalHistory) {
    setEditingRow(r);
    setEditForm({ visit_date: r.visit_date, provider_id: r.provider_id, provider_other: r.provider_other, procedure: r.procedure, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await dentalHistoryApi.update(editingRow.id, editForm);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout title="Dental History" description="Dental visits, procedures, and oral health records.">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-8" />
                    <SortableTh label="Date" sortKey="visit_date" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Provider" sortKey="provider_other" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Procedure" sortKey="procedure" sort={sort} onSort={toggleSort} />
                    {isAdmin && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
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
                        <td className="px-4 py-3 font-medium text-foreground">{r.visit_date ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">{resolveDoctorName(r.provider_id, r.provider_other)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.procedure ?? ""}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 space-x-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>Delete</Button>
                          </td>
                        )}
                      </tr>
                      {expandedId === r.id && (
                        <tr className="bg-muted/20">
                          <td colSpan={isAdmin ? 5 : 4} className="px-4 py-3 text-sm text-muted-foreground">
                            <div className="flex flex-col gap-3">
                              {r.notes && (
                                <div className="whitespace-pre-wrap">
                                  <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                                </div>
                              )}
                              <DocumentsPanel section="dental_history" recordId={r.id} isAdmin={isAdmin} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No dental history records yet.
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
                  {/* Visit Date (half width) */}
                  <FormField label="Visit Date" htmlFor="visit_date">
                    <Input
                      id="visit_date"
                      type="date"
                      required
                      value={form.visit_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Procedure (half width) */}
                  <FormField label="Procedure" htmlFor="procedure">
                    <Input
                      id="procedure"
                      type="text"
                      value={form.procedure ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, procedure: e.target.value || null }))}
                      placeholder="e.g. Cleaning, Filling"
                    />
                  </FormField>

                  {/* Provider (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Provider" htmlFor="provider">
                      <DoctorPicker
                        doctorId={form.provider_id ?? null}
                        doctorOther={form.provider_other ?? null}
                        onChange={(id, other) => setForm((s) => ({ ...s, provider_id: id, provider_other: other }))}
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
        <div role="dialog" aria-modal="true" aria-labelledby="edit-dent-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-dent-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Dental Record</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Visit Date" htmlFor="edit-dent-date">
                  <Input id="edit-dent-date" type="date" value={editForm.visit_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, visit_date: e.target.value || null }))} />
                </FormField>
                <FormField label="Procedure" htmlFor="edit-dent-procedure">
                  <Input id="edit-dent-procedure" value={editForm.procedure ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, procedure: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Provider" htmlFor="edit-dent-provider">
                    <DoctorPicker
                      doctorId={editForm.provider_id ?? null}
                      doctorOther={editForm.provider_other ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, provider_id: id, provider_other: other }))}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-dent-notes">
                    <Textarea id="edit-dent-notes" value={editForm.notes ?? ""}
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
