import React, { useEffect, useState, type FormEvent } from "react";
import { vaccinationsApi, type Vaccination, type VaccinationInput } from "../api/vaccinations";
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

const EMPTY: VaccinationInput = {
  vaccine: "",
  manufacturer: null,
  administered_date: null,
  administrator: null,
  next_due_date: null,
  notes: null,
};

export default function VaccinationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Vaccination[]>([]);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows as Record<string, unknown>[], "administered_date", "asc");
  const [form, setForm] = useState<VaccinationInput>(EMPTY);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<Vaccination | null>(null);
  const [editForm, setEditForm] = useState<VaccinationInput>(EMPTY);
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await vaccinationsApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load vaccinations")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await vaccinationsApi.create(form); setForm(EMPTY); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await vaccinationsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function openEdit(r: Vaccination) {
    setEditingRow(r);
    setEditForm({ vaccine: r.vaccine, manufacturer: r.manufacturer, administered_date: r.administered_date, administrator: r.administrator, next_due_date: r.next_due_date, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await vaccinationsApi.update(editingRow.id, editForm);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout
        title="Vaccinations"
        description="Track immunization history, lot numbers, and upcoming booster dates."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-8" />
                    <SortableTh label="Vaccine" sortKey="vaccine" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Manufacturer" sortKey="manufacturer" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Date Administered" sortKey="administered_date" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Administrator" sortKey="administrator" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Next Due" sortKey="next_due_date" sort={sort} onSort={toggleSort} />
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
                        <td className="px-4 py-3 font-medium text-foreground">{r.vaccine}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.manufacturer ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(r.administered_date)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.administrator ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(r.next_due_date)}</td>
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
                              <DocumentsPanel section="vaccinations" recordId={r.id} isAdmin={isAdmin} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No vaccination records yet.
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
                  {/* Vaccine (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Vaccine" htmlFor="vaccine">
                      <Input
                        id="vaccine"
                        required
                        placeholder="e.g. Influenza, COVID-19"
                        value={form.vaccine}
                        onChange={(e) => setForm((s) => ({ ...s, vaccine: e.target.value }))}
                      />
                    </FormField>
                  </div>

                  {/* Manufacturer */}
                  <FormField label="Manufacturer" htmlFor="manufacturer">
                    <Input
                      id="manufacturer"
                      placeholder="e.g. Pfizer, Moderna"
                      value={form.manufacturer ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, manufacturer: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Administrator */}
                  <FormField label="Administrator" htmlFor="administrator">
                    <Input
                      id="administrator"
                      placeholder="Provider or clinic"
                      value={form.administrator ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, administrator: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Administered Date | Next Due Date */}
                  <FormField label="Administered Date" htmlFor="administered_date">
                    <Input
                      id="administered_date"
                      type="date"
                      value={form.administered_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, administered_date: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="Next Due Date" htmlFor="next_due_date">
                    <Input
                      id="next_due_date"
                      type="date"
                      value={form.next_due_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, next_due_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Notes (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Notes" htmlFor="vac-notes">
                      <Textarea
                        id="vac-notes"
                        placeholder="Additional notes…"
                        value={form.notes ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add Vaccination</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-vac-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-vac-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Vaccination</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Vaccine" htmlFor="edit-vac-vaccine">
                    <Input id="edit-vac-vaccine" required value={editForm.vaccine ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, vaccine: e.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Manufacturer" htmlFor="edit-vac-manufacturer">
                  <Input id="edit-vac-manufacturer" value={editForm.manufacturer ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, manufacturer: e.target.value || null }))} />
                </FormField>
                <FormField label="Administrator" htmlFor="edit-vac-administrator">
                  <Input id="edit-vac-administrator" value={editForm.administrator ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, administrator: e.target.value || null }))} />
                </FormField>
                <FormField label="Administered Date" htmlFor="edit-vac-date">
                  <Input id="edit-vac-date" type="date" value={editForm.administered_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, administered_date: e.target.value || null }))} />
                </FormField>
                <FormField label="Next Due Date" htmlFor="edit-vac-next">
                  <Input id="edit-vac-next" type="date" value={editForm.next_due_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, next_due_date: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-vac-notes">
                    <Textarea id="edit-vac-notes" value={editForm.notes ?? ""}
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
