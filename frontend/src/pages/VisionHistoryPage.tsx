import React, { useEffect, useState, type FormEvent } from "react";
import { visionHistoryApi, type VisionHistory, type VisionHistoryInput } from "../api/visionHistory";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";

export default function VisionHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<VisionHistory[]>([]);
  const [form, setForm] = useState<VisionHistoryInput>({});
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<VisionHistory | null>(null);
  const [editForm, setEditForm] = useState<VisionHistoryInput>({});
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await visionHistoryApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load vision history")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await visionHistoryApi.create(form); setForm({}); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await visionHistoryApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function openEdit(r: VisionHistory) {
    setEditingRow(r);
    setEditForm({ visit_date: r.visit_date, provider_id: r.provider_id, provider_other: r.provider_other, rx_od: r.rx_od, rx_os: r.rx_os, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await visionHistoryApi.update(editingRow.id, editForm);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout title="Vision History" description="Eye exams, prescriptions, and vision care.">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rx OD</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rx OS</th>
                    {isAdmin && <th className="px-4 py-3" />}
                    <th className="px-4 py-3" />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{r.visit_date ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.provider_other ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.rx_od ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.rx_os ?? ""}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 space-x-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>Delete</Button>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <DocumentsPanel section="vision_history" recordId={r.id} isAdmin={isAdmin} />
                        </td>
                        {r.notes && (
                          <td className="px-2 py-3">
                            <button
                              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={expandedId === r.id ? "Collapse notes" : "Expand notes"}
                            >
                              {expandedId === r.id
                                ? <ChevronDown className="size-4" />
                                : <ChevronRight className="size-4" />}
                            </button>
                          </td>
                        )}
                        {!r.notes && <td />}
                      </tr>
                      {expandedId === r.id && r.notes && (
                        <tr className="bg-muted/20">
                          <td colSpan={isAdmin ? 7 : 6} className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                            <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No vision history records yet.
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
                      value={form.visit_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
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

                  {/* Rx OD | Rx OS */}
                  <FormField label="Rx OD (right eye)" htmlFor="rx_od">
                    <Input
                      id="rx_od"
                      type="text"
                      value={form.rx_od ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, rx_od: e.target.value || null }))}
                      placeholder="e.g. -2.50"
                    />
                  </FormField>
                  <FormField label="Rx OS (left eye)" htmlFor="rx_os">
                    <Input
                      id="rx_os"
                      type="text"
                      value={form.rx_os ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, rx_os: e.target.value || null }))}
                      placeholder="e.g. -2.75"
                    />
                  </FormField>

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
        <div role="dialog" aria-modal="true" aria-labelledby="edit-vis-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-vis-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Vision Record</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Visit Date" htmlFor="edit-vis-date">
                  <Input id="edit-vis-date" type="date" value={editForm.visit_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, visit_date: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Provider" htmlFor="edit-vis-provider">
                    <DoctorPicker
                      doctorId={editForm.provider_id ?? null}
                      doctorOther={editForm.provider_other ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, provider_id: id, provider_other: other }))}
                    />
                  </FormField>
                </div>
                <FormField label="Rx OD (right eye)" htmlFor="edit-vis-od">
                  <Input id="edit-vis-od" value={editForm.rx_od ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, rx_od: e.target.value || null }))} />
                </FormField>
                <FormField label="Rx OS (left eye)" htmlFor="edit-vis-os">
                  <Input id="edit-vis-os" value={editForm.rx_os ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, rx_os: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-vis-notes">
                    <Textarea id="edit-vis-notes" value={editForm.notes ?? ""}
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
