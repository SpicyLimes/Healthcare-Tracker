import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { familyHistoryApi, type FamilyHistory, type FamilyHistoryInput } from "../api/familyHistory";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { useColumnResize } from "@/hooks/useColumnResize";
import { SortableTh } from "@/components/SortableTh";

export default function FamilyHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<FamilyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows, "condition", "asc");
  const tableRef = useRef<HTMLTableElement>(null);
  const { colWidths, autoFitColumn } = useColumnResize(tableRef);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    relative: "",
    condition: "",
    age_of_onset: "",
    notes: "",
  });
  const [editingRow, setEditingRow] = useState<FamilyHistory | null>(null);
  const [editForm, setEditForm] = useState({ relative: "", condition: "", age_of_onset: "", notes: "" });
  const [editError, setEditError] = useState("");

  async function reload() {
    setRows(await familyHistoryApi.list());
  }

  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load family history"); setRows([]); }).finally(() => setLoading(false));
  }, []);

  function set(key: keyof typeof form, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== ""),
      ) as typeof form;
      await familyHistoryApi.create(payload);
      setForm({ relative: "", condition: "", age_of_onset: "", notes: "" });
      await reload();
    } catch {
      setError("Could not add family history record");
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await familyHistoryApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete family history record");
    }
  }

  function openEdit(r: FamilyHistory) {
    setEditingRow(r);
    setEditForm({
      relative: r.relative,
      condition: r.condition,
      age_of_onset: r.age_of_onset ?? "",
      notes: r.notes ?? "",
    });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(editForm).map(([k, v]) => [k, v === "" ? null : v])
      ) as unknown as FamilyHistoryInput;
      await familyHistoryApi.update(editingRow.id, payload);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout title="Family Health History" description="Hereditary conditions and family medical history.">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-8" />
                <SortableTh label="Relative" sortKey="relative" sort={sort} onSort={toggleSort} colIndex={2} width={colWidths["relative"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Condition" sortKey="condition" sort={sort} onSort={toggleSort} colIndex={3} width={colWidths["condition"]} onAutoFit={autoFitColumn} />
                <SortableTh label="Age of Onset" sortKey="age_of_onset" sort={sort} onSort={toggleSort} colIndex={4} width={colWidths["age_of_onset"]} onAutoFit={autoFitColumn} />
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center py-6 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && sortedRows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0">
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
                    <td className="px-4 py-3 font-medium text-foreground">{r.relative}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.condition}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.age_of_onset ?? ""}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>Delete</Button>
                      </td>
                    )}
                  </tr>
                  {expandedId === r.id && r.notes && (
                    <tr className="bg-muted/20">
                      <td colSpan={isAdmin ? 5 : 4} className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                        <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No family history records yet.
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
                  <FormField label="Relative" htmlFor="relative">
                    <Input
                      id="relative"
                      type="text"
                      required
                      value={form.relative}
                      onChange={(e) => set("relative", e.target.value)}
                      placeholder="e.g. Father, Maternal grandmother"
                    />
                  </FormField>

                  <FormField label="Condition" htmlFor="condition">
                    <Input
                      id="condition"
                      type="text"
                      required
                      value={form.condition}
                      onChange={(e) => set("condition", e.target.value)}
                      placeholder="e.g. Type 2 diabetes"
                    />
                  </FormField>

                  <FormField label="Age of onset" htmlFor="age_of_onset">
                    <Input
                      id="age_of_onset"
                      type="text"
                      value={form.age_of_onset}
                      onChange={(e) => set("age_of_onset", e.target.value)}
                      placeholder="e.g. 55"
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label="Notes" htmlFor="notes">
                      <Textarea
                        id="notes"
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                        placeholder="Additional notes..."
                      />
                    </FormField>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Add record</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-fh-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-fh-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Family History</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Relative" htmlFor="edit-fh-relative">
                  <Input id="edit-fh-relative" required value={editForm.relative}
                    onChange={(e) => setEditForm((s) => ({ ...s, relative: e.target.value }))} />
                </FormField>
                <FormField label="Condition" htmlFor="edit-fh-condition">
                  <Input id="edit-fh-condition" required value={editForm.condition}
                    onChange={(e) => setEditForm((s) => ({ ...s, condition: e.target.value }))} />
                </FormField>
                <FormField label="Age of Onset" htmlFor="edit-fh-onset">
                  <Input id="edit-fh-onset" value={editForm.age_of_onset}
                    onChange={(e) => setEditForm((s) => ({ ...s, age_of_onset: e.target.value }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-fh-notes">
                    <Textarea id="edit-fh-notes" value={editForm.notes}
                      onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value }))} />
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
