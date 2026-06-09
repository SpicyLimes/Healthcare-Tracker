import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { medicationsApi, type Medication, type MedicationInput, type MedicationKind } from "../api/medications";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { useColumnResize } from "@/hooks/useColumnResize";
import { SortableTh } from "@/components/SortableTh";

const EMPTY: MedicationInput = {
  name: "",
  kind: "medication",
  dose: null,
  frequency: null,
  route: null,
  prescribing_doctor: null,
  prescribing_doctor_id: null,
  start_date: null,
  end_date: null,
  is_active: true,
  notes: null,
};

export default function MedicationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows, "name", "asc");
  const tableRef = useRef<HTMLTableElement>(null);
  const { colWidths, autoFitColumn } = useColumnResize(tableRef);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<MedicationInput>(EMPTY);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<Medication | null>(null);
  const [editForm, setEditForm] = useState<MedicationInput>(EMPTY);
  const [editError, setEditError] = useState("");

  async function reload() {
    setRows(await medicationsApi.list());
  }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load medications"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await medicationsApi.create(form);
      setForm(EMPTY);
      await reload();
    } catch {
      setError("Could not add record");
    }
  }

  async function onDelete(id: string) {
    try {
      await medicationsApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete record");
    }
  }

  function openEdit(r: Medication) {
    setEditingRow(r);
    setEditForm({
      name: r.name, kind: r.kind, dose: r.dose, frequency: r.frequency,
      route: r.route, prescribing_doctor: r.prescribing_doctor,
      prescribing_doctor_id: r.prescribing_doctor_id,
      start_date: r.start_date, end_date: r.end_date,
      is_active: r.is_active, notes: r.notes,
    });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await medicationsApi.update(editingRow.id, editForm);
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
        title="Medications"
        description="Track current and past medications, dosages, and prescribing doctors."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-8" />
                <SortableTh label="Name" sortKey="name" sort={sort} onSort={toggleSort} colIndex={2} width={colWidths["name"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Kind" sortKey="kind" sort={sort} onSort={toggleSort} colIndex={3} width={colWidths["kind"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Dose" sortKey="dose" sort={sort} onSort={toggleSort} colIndex={4} width={colWidths["dose"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Frequency" sortKey="frequency" sort={sort} onSort={toggleSort} colIndex={5} width={colWidths["frequency"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Route" sortKey="route" sort={sort} onSort={toggleSort} colIndex={6} width={colWidths["route"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Prescribing Doctor" sortKey="prescribing_doctor" sort={sort} onSort={toggleSort} colIndex={7} width={colWidths["prescribing_doctor"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Active" sortKey="is_active" sort={sort} onSort={toggleSort} colIndex={8} width={colWidths["is_active"]} onAutoFit={autoFitColumn} />
                {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center py-6 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && sortedRows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-muted/20">
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
                    <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{r.kind}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.dose ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.frequency ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{r.route ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {resolveDoctorName(r.prescribing_doctor_id, r.prescribing_doctor)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.is_active ? "Yes" : "No"}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>Delete</Button>
                      </td>
                    )}
                  </tr>
                  {expandedId === r.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={isAdmin ? 9 : 8} className="px-4 py-3 text-sm text-muted-foreground">
                        <div className="flex flex-col gap-3">
                          {r.notes && (
                            <div className="whitespace-pre-wrap">
                              <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                            </div>
                          )}
                          <DocumentsPanel section="medications" recordId={r.id} isAdmin={isAdmin} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No medication records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
            </div>
          </CardContent>
        </Card>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {isAdmin && (
          <Card>
            <CardContent className="py-6">
              <form onSubmit={onAdd} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Medication Name" htmlFor="med-name">
                    <Input id="med-name" required placeholder="e.g. Lisinopril"
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
                  </FormField>
                  <FormField label="Kind" htmlFor="med-kind">
                    <Select id="med-kind" value={form.kind ?? "medication"}
                      onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as MedicationKind }))}>
                      <option value="medication">Medication</option>
                      <option value="vitamin">Vitamin</option>
                      <option value="supplement">Supplement</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Dose" htmlFor="med-dose">
                    <Input id="med-dose" placeholder="e.g. 10 mg"
                      value={form.dose ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, dose: e.target.value || null }))} />
                  </FormField>
                  <FormField label="Frequency" htmlFor="med-frequency">
                    <Input id="med-frequency" placeholder="e.g. Once daily"
                      value={form.frequency ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, frequency: e.target.value || null }))} />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Route" htmlFor="med-route">
                    <Select id="med-route" value={form.route ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, route: e.target.value || null }))}>
                      <option value="">Select…</option>
                      <option value="oral">Oral</option>
                      <option value="topical">Topical</option>
                      <option value="injection">Injection</option>
                      <option value="inhaled">Inhaled</option>
                      <option value="other">Other</option>
                    </Select>
                  </FormField>
                  <FormField label="Status" htmlFor="med-active">
                    <Select id="med-active" value={form.is_active === false ? "false" : "true"}
                      onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.value === "true" }))}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Start Date" htmlFor="med-start-date">
                    <Input id="med-start-date" type="date"
                      value={form.start_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value || null }))} />
                  </FormField>
                  <FormField label="End Date" htmlFor="med-end-date">
                    <Input id="med-end-date" type="date"
                      value={form.end_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value || null }))} />
                  </FormField>
                </div>
                <FormField label="Prescribing Doctor" htmlFor="med-prescriber">
                  <DoctorPicker
                    doctorId={form.prescribing_doctor_id ?? null}
                    doctorOther={form.prescribing_doctor ?? null}
                    onChange={(id, other) => setForm((s) => ({ ...s, prescribing_doctor_id: id, prescribing_doctor: other }))}
                  />
                </FormField>
                <FormField label="Notes" htmlFor="med-notes">
                  <Textarea id="med-notes" placeholder="Side effects, instructions, or other notes…"
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))} />
                </FormField>
                <div className="flex justify-end">
                  <Button type="submit">Add Medication</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-med-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-med-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Medication</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Medication Name" htmlFor="edit-med-name">
                  <Input id="edit-med-name" required value={editForm.name ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
                </FormField>
                <FormField label="Kind" htmlFor="edit-med-kind">
                  <Select id="edit-med-kind" value={editForm.kind ?? "medication"}
                    onChange={(e) => setEditForm((s) => ({ ...s, kind: e.target.value as MedicationKind }))}>
                    <option value="medication">Medication</option>
                    <option value="vitamin">Vitamin</option>
                    <option value="supplement">Supplement</option>
                  </Select>
                </FormField>
                <FormField label="Dose" htmlFor="edit-med-dose">
                  <Input id="edit-med-dose" value={editForm.dose ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, dose: e.target.value || null }))} />
                </FormField>
                <FormField label="Frequency" htmlFor="edit-med-frequency">
                  <Input id="edit-med-frequency" value={editForm.frequency ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, frequency: e.target.value || null }))} />
                </FormField>
                <FormField label="Route" htmlFor="edit-med-route">
                  <Select id="edit-med-route" value={editForm.route ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, route: e.target.value || null }))}>
                    <option value="">Select…</option>
                    <option value="oral">Oral</option>
                    <option value="topical">Topical</option>
                    <option value="injection">Injection</option>
                    <option value="inhaled">Inhaled</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
                <FormField label="Status" htmlFor="edit-med-active">
                  <Select id="edit-med-active" value={editForm.is_active === false ? "false" : "true"}
                    onChange={(e) => setEditForm((s) => ({ ...s, is_active: e.target.value === "true" }))}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                </FormField>
                <FormField label="Start Date" htmlFor="edit-med-start">
                  <Input id="edit-med-start" type="date" value={editForm.start_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, start_date: e.target.value || null }))} />
                </FormField>
                <FormField label="End Date" htmlFor="edit-med-end">
                  <Input id="edit-med-end" type="date" value={editForm.end_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, end_date: e.target.value || null }))} />
                </FormField>
              </div>
              <FormField label="Prescribing Doctor" htmlFor="edit-med-prescriber">
                <DoctorPicker
                  doctorId={editForm.prescribing_doctor_id ?? null}
                  doctorOther={editForm.prescribing_doctor ?? null}
                  onChange={(id, other) => setEditForm((s) => ({ ...s, prescribing_doctor_id: id, prescribing_doctor: other }))}
                />
              </FormField>
              <FormField label="Notes" htmlFor="edit-med-notes">
                <Textarea id="edit-med-notes" value={editForm.notes ?? ""}
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
