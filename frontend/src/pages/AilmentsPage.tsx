import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { ailmentsApi, type Ailment, type AilmentInput, type AilmentStatus } from "../api/ailments";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { useColumnResize } from "@/hooks/useColumnResize";
import { SortableTh } from "@/components/SortableTh";

const EMPTY: AilmentInput = {
  condition: "",
  onset_date: null,
  status: "active",
  treating_doctor: null,
  treating_doctor_id: null,
  notes: null,
};

export default function AilmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Ailment[]>([]);
  const [loading, setLoading] = useState(true);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows, "condition", "asc");
  const tableRef = useRef<HTMLTableElement>(null);
  const { colWidths, autoFitColumn } = useColumnResize(tableRef);
  const [form, setForm] = useState<AilmentInput>(EMPTY);
  const [error, setError] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<Ailment | null>(null);
  const [editForm, setEditForm] = useState<AilmentInput>({ condition: "" });
  const [editError, setEditError] = useState("");

  async function reload() {
    setRows(await ailmentsApi.list());
  }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load ailments"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await ailmentsApi.create(form);
      setForm(EMPTY);
      await reload();
    } catch {
      setError("Could not add record");
    }
  }

  async function onDelete(id: string) {
    try {
      await ailmentsApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete record");
    }
  }

  function openEdit(r: Ailment) {
    setEditingRow(r);
    setEditForm({ condition: r.condition, onset_date: r.onset_date, status: r.status, treating_doctor: r.treating_doctor, treating_doctor_id: r.treating_doctor_id, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await ailmentsApi.update(editingRow.id, editForm);
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
        title="Ailment History"
        description="Track diagnoses, conditions, and their current status."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-8" />
                <SortableTh label="Condition" sortKey="condition" sort={sort} onSort={toggleSort} colIndex={2} width={colWidths["condition"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} colIndex={3} width={colWidths["status"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Onset Date" sortKey="onset_date" sort={sort} onSort={toggleSort} colIndex={4} width={colWidths["onset_date"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Treating Doctor" sortKey="treating_doctor" sort={sort} onSort={toggleSort} colIndex={5} width={colWidths["treating_doctor"]} onAutoFit={autoFitColumn} />
                {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-6 text-muted-foreground">
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
                    <td className="px-4 py-3 font-medium text-foreground">{r.condition}</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.status === "active" ? "default" : "secondary"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.onset_date ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {resolveDoctorName(r.treating_doctor_id, r.treating_doctor)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>Delete</Button>
                      </td>
                    )}
                  </tr>
                  {expandedId === r.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3 text-sm text-muted-foreground">
                        <div className="flex flex-col gap-3">
                          {r.notes && (
                            <div className="whitespace-pre-wrap">
                              <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                            </div>
                          )}
                          <DocumentsPanel section="ailments" recordId={r.id} isAdmin={isAdmin} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No ailment records yet.
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
                  <FormField label="Condition" htmlFor="ail-condition">
                    <Input
                      id="ail-condition"
                      required
                      placeholder="e.g. Hypertension"
                      value={form.condition}
                      onChange={(e) => setForm((s) => ({ ...s, condition: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Status" htmlFor="ail-status">
                    <Select
                      id="ail-status"
                      value={form.status ?? "active"}
                      onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as AilmentStatus }))}
                    >
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Onset Date" htmlFor="ail-onset">
                    <Input
                      id="ail-onset"
                      type="date"
                      value={form.onset_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, onset_date: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="Treating Doctor" htmlFor="ail-doctor">
                    <DoctorPicker
                      doctorId={form.treating_doctor_id ?? null}
                      doctorOther={form.treating_doctor ?? null}
                      onChange={(id, other) => setForm((s) => ({ ...s, treating_doctor_id: id, treating_doctor: other }))}
                    />
                  </FormField>
                </div>
                <FormField label="Notes" htmlFor="ail-notes">
                  <Textarea
                    id="ail-notes"
                    placeholder="Additional notes…"
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                  />
                </FormField>
                <div className="flex justify-end">
                  <Button type="submit">Add Ailment</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-ail-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-ail-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Ailment</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Condition" htmlFor="edit-ail-condition">
                  <Input id="edit-ail-condition" required value={editForm.condition ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, condition: e.target.value }))} />
                </FormField>
                <FormField label="Status" htmlFor="edit-ail-status">
                  <Select id="edit-ail-status" value={editForm.status ?? "active"}
                    onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value as AilmentStatus }))}>
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                  </Select>
                </FormField>
                <FormField label="Onset Date" htmlFor="edit-ail-onset">
                  <Input id="edit-ail-onset" type="date" value={editForm.onset_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, onset_date: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Treating Doctor" htmlFor="edit-ail-doctor">
                    <DoctorPicker
                      doctorId={editForm.treating_doctor_id ?? null}
                      doctorOther={editForm.treating_doctor ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, treating_doctor_id: id, treating_doctor: other }))}
                    />
                  </FormField>
                </div>
              </div>
              <FormField label="Notes" htmlFor="edit-ail-notes">
                <Textarea id="edit-ail-notes" value={editForm.notes ?? ""}
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
