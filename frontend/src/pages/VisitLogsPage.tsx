import React, { useEffect, useState, type FormEvent } from "react";
import { visitLogsApi, type VisitLog, type VisitLogInput } from "../api/visitLogs";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { SortableTh } from "@/components/SortableTh";

const EMPTY: VisitLogInput = {
  visit_date: null,
  doctor_id: null,
  doctor_other: null,
  reason: null,
  summary: null,
  follow_up: null,
  follow_up_date: null,
  notes: null,
};

export default function VisitLogsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<VisitLog[]>([]);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows as Record<string, unknown>[], "visit_date", "asc");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<VisitLogInput>(EMPTY);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<VisitLog | null>(null);
  const [editForm, setEditForm] = useState<VisitLogInput>(EMPTY);
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await visitLogsApi.list()); }
  useEffect(() => {
    reload().catch(() => setError("Failed to load visit logs"));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await visitLogsApi.create(form); setForm(EMPTY); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await visitLogsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function openEdit(r: VisitLog) {
    setEditingRow(r);
    setEditForm({ visit_date: r.visit_date, doctor_id: r.doctor_id, doctor_other: r.doctor_other, reason: r.reason, summary: r.summary, follow_up: r.follow_up, follow_up_date: r.follow_up_date, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await visitLogsApi.update(editingRow.id, editForm);
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
      <PageLayout
        title="Visit Logs"
        description="Record doctor visits, summaries, and follow-up actions."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-8" />
                    <SortableTh label="Date" sortKey="visit_date" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Doctor" sortKey="doctor_id" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Reason" sortKey="reason" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Summary" sortKey="summary" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Follow-up Date" sortKey="follow_up_date" sort={sort} onSort={toggleSort} />
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
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
                        <td className="px-4 py-3 font-medium text-foreground">{formatDate(r.visit_date)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{resolveDoctorName(r.doctor_id, r.doctor_other)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                          {r.summary ? r.summary.slice(0, 60) + (r.summary.length > 60 ? "…" : "") : ""}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.follow_up_date ?? ""}</td>
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
                              {r.summary && (
                                <div>
                                  <span className="font-medium text-foreground mr-2">Summary:</span>
                                  <span className="whitespace-pre-wrap">{r.summary}</span>
                                </div>
                              )}
                              {r.follow_up && (
                                <div>
                                  <span className="font-medium text-foreground mr-2">Follow-up:</span>
                                  <span className="whitespace-pre-wrap">{r.follow_up}</span>
                                </div>
                              )}
                              {r.notes && (
                                <div>
                                  <span className="font-medium text-foreground mr-2">Notes:</span>
                                  <span className="whitespace-pre-wrap">{r.notes}</span>
                                </div>
                              )}
                              <DocumentsPanel section="visit_logs" recordId={r.id} isAdmin={isAdmin} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No visit log records yet.
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
                  {/* Visit Date */}
                  <FormField label="Visit Date" htmlFor="visit_date">
                    <Input
                      id="visit_date"
                      type="date"
                      value={form.visit_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Reason */}
                  <FormField label="Reason" htmlFor="reason">
                    <Input
                      id="reason"
                      value={form.reason ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))}
                      placeholder="e.g. Annual checkup"
                    />
                  </FormField>

                  {/* Doctor (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Doctor" htmlFor="visit-doctor">
                      <DoctorPicker
                        doctorId={form.doctor_id ?? null}
                        doctorOther={form.doctor_other ?? null}
                        onChange={(id, other) => setForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
                      />
                    </FormField>
                  </div>

                  {/* Summary (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Summary" htmlFor="summary">
                      <Textarea
                        id="summary"
                        placeholder="Summary of the visit…"
                        value={form.summary ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, summary: e.target.value || null }))}
                      />
                    </FormField>
                  </div>

                  {/* Follow-up Notes (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Follow-up Notes" htmlFor="follow_up">
                      <Textarea
                        id="follow_up"
                        placeholder="Follow-up instructions or next steps…"
                        value={form.follow_up ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, follow_up: e.target.value || null }))}
                      />
                    </FormField>
                  </div>

                  {/* Follow-up Date */}
                  <FormField label="Follow-up Date" htmlFor="follow_up_date">
                    <Input
                      id="follow_up_date"
                      type="date"
                      value={form.follow_up_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, follow_up_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Notes (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Notes" htmlFor="visit-notes">
                      <Textarea
                        id="visit-notes"
                        placeholder="Additional notes…"
                        value={form.notes ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add Visit</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-vl-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-vl-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Visit Log</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Visit Date" htmlFor="edit-vl-date">
                  <Input id="edit-vl-date" type="date" value={editForm.visit_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, visit_date: e.target.value || null }))} />
                </FormField>
                <FormField label="Reason" htmlFor="edit-vl-reason">
                  <Input id="edit-vl-reason" value={editForm.reason ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, reason: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Doctor" htmlFor="edit-vl-doctor">
                    <DoctorPicker
                      doctorId={editForm.doctor_id ?? null}
                      doctorOther={editForm.doctor_other ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Summary" htmlFor="edit-vl-summary">
                    <Textarea id="edit-vl-summary" value={editForm.summary ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, summary: e.target.value || null }))} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Follow-up Notes" htmlFor="edit-vl-followup">
                    <Textarea id="edit-vl-followup" value={editForm.follow_up ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, follow_up: e.target.value || null }))} />
                  </FormField>
                </div>
                <FormField label="Follow-up Date" htmlFor="edit-vl-followup-date">
                  <Input id="edit-vl-followup-date" type="date" value={editForm.follow_up_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, follow_up_date: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-vl-notes">
                    <Textarea id="edit-vl-notes" value={editForm.notes ?? ""}
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
