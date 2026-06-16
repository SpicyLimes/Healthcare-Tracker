import { useEffect, useState, type FormEvent } from "react";
import { vaccinationsApi, type Vaccination, type VaccinationInput } from "../api/vaccinations";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";
import { RecordTable } from "@/components/RecordTable";

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
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<VaccinationInput>(EMPTY);
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState<Vaccination | null>(null);
  const [editForm, setEditForm] = useState<VaccinationInput>(EMPTY);
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await vaccinationsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load vaccinations"); setRows([]); }).finally(() => setLoading(false));
  }, []);

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
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="administered_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date Administered", sortKey: "administered_date", render: (r) => r.administered_date ? formatDate(r.administered_date) : "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Vaccine", sortKey: "vaccine", render: (r) => r.vaccine },
                { header: "Next Due", sortKey: "next_due_date", render: (r) => r.next_due_date ? formatDate(r.next_due_date) : "" },
              ]}
              detailTitle={(r) => r.vaccine}
              detailFields={(r) => [
                { label: "Date Administered", value: r.administered_date ? formatDate(r.administered_date) : null },
                { label: "Next Due", value: r.next_due_date ? formatDate(r.next_due_date) : null },
                { label: "Manufacturer", value: r.manufacturer },
                { label: "Administrator", value: r.administrator },
                { label: "Lot Number", value: r.lot_number },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="vaccinations" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.vaccine}
              getSubtitle={(r) => r.administered_date ? formatDate(r.administered_date) : null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No vaccination records yet."
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
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
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
