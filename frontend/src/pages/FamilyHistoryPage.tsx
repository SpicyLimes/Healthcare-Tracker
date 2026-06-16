import { useEffect, useState, type FormEvent } from "react";
import { familyHistoryApi, type FamilyHistory, type FamilyHistoryInput } from "../api/familyHistory";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";

export default function FamilyHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<FamilyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="relative"
              primaryColumns={[
                { header: "Relative", sortKey: "relative", render: (r) => r.relative, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Condition", sortKey: "condition", render: (r) => r.condition },
                { header: "Age of Onset", sortKey: "age_of_onset", render: (r) => r.age_of_onset ?? "" },
              ]}
              detailTitle={(r) => `${r.relative} — ${r.condition}`}
              detailFields={(r) => [
                { label: "Relative", value: r.relative },
                { label: "Condition", value: r.condition },
                { label: "Age of Onset", value: r.age_of_onset },
                { label: "Notes", value: r.notes },
              ]}
              getHeadline={(r) => `${r.relative} — ${r.condition}`}
              getSubtitle={(r) => r.condition ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No family history records yet."
            />
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
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
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
