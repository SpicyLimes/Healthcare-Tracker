import { useEffect, useState, type FormEvent } from "react";
import { insurancesApi, type Insurance, type InsuranceInput } from "../api/insurances";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";

export default function InsurancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    insurer_name: "",
    policy_number: "",
    group_number: "",
    contact_phone: "",
    notes: "",
  });
  const [editingRow, setEditingRow] = useState<Insurance | null>(null);
  const [editForm, setEditForm] = useState({ insurer_name: "", policy_number: "", group_number: "", contact_phone: "", notes: "" });
  const [editError, setEditError] = useState("");

  async function reload() {
    setRows(await insurancesApi.list());
  }

  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load insurance records"); setRows([]); }).finally(() => setLoading(false));
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
      await insurancesApi.create(payload);
      setForm({ insurer_name: "", policy_number: "", group_number: "", contact_phone: "", notes: "" });
      await reload();
    } catch {
      setError("Could not add insurance record");
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await insurancesApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete insurance record");
    }
  }

  function openEdit(r: Insurance) {
    setEditingRow(r);
    setEditForm({
      insurer_name: r.insurer_name,
      policy_number: r.policy_number ?? "",
      group_number: r.group_number ?? "",
      contact_phone: r.contact_phone ?? "",
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
      ) as unknown as InsuranceInput;
      await insurancesApi.update(editingRow.id, payload);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout title="Insurance" description="Health insurance policies and contact information.">
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="insurer_name"
              primaryColumns={[
                { header: "Insurer", sortKey: "insurer_name", render: (r) => r.insurer_name, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Policy #", sortKey: "policy_number", render: (r) => r.policy_number ?? "" },
                { header: "Phone", sortKey: "contact_phone", render: (r) => r.contact_phone ?? "" },
              ]}
              detailTitle={(r) => r.insurer_name}
              detailFields={(r) => [
                { label: "Policy #", value: r.policy_number },
                { label: "Group #", value: r.group_number },
                { label: "Phone", value: r.contact_phone },
                { label: "Address", value: r.contact_address },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="insurances" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.insurer_name}
              getSubtitle={(r) => r.policy_number ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No insurance records yet."
            />
          </CardContent>
        </Card>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {isAdmin && (
          <Card>
            <CardContent className="py-6">
              <form onSubmit={onAdd} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FormField label="Insurer name" htmlFor="insurer_name">
                      <Input
                        id="insurer_name"
                        type="text"
                        required
                        value={form.insurer_name}
                        onChange={(e) => set("insurer_name", e.target.value)}
                        placeholder="e.g. Blue Cross Blue Shield"
                      />
                    </FormField>
                  </div>

                  <FormField label="Policy #" htmlFor="policy_number">
                    <Input
                      id="policy_number"
                      type="text"
                      value={form.policy_number}
                      onChange={(e) => set("policy_number", e.target.value)}
                      placeholder="e.g. XYZ123456"
                    />
                  </FormField>

                  <FormField label="Group #" htmlFor="group_number">
                    <Input
                      id="group_number"
                      type="text"
                      value={form.group_number}
                      onChange={(e) => set("group_number", e.target.value)}
                      placeholder="e.g. GRP987654"
                    />
                  </FormField>

                  <FormField label="Contact phone" htmlFor="contact_phone">
                    <Input
                      id="contact_phone"
                      type="tel"
                      value={form.contact_phone}
                      onChange={(e) => set("contact_phone", e.target.value)}
                      placeholder="e.g. +1 800-555-0100"
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
                  <Button type="submit">Add insurance</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-ins-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-ins-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Insurance</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Insurer Name" htmlFor="edit-ins-insurer">
                    <Input id="edit-ins-insurer" required value={editForm.insurer_name}
                      onChange={(e) => setEditForm((s) => ({ ...s, insurer_name: e.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Policy #" htmlFor="edit-ins-policy">
                  <Input id="edit-ins-policy" value={editForm.policy_number}
                    onChange={(e) => setEditForm((s) => ({ ...s, policy_number: e.target.value }))} />
                </FormField>
                <FormField label="Group #" htmlFor="edit-ins-group">
                  <Input id="edit-ins-group" value={editForm.group_number}
                    onChange={(e) => setEditForm((s) => ({ ...s, group_number: e.target.value }))} />
                </FormField>
                <FormField label="Contact Phone" htmlFor="edit-ins-phone">
                  <Input id="edit-ins-phone" type="tel" value={editForm.contact_phone}
                    onChange={(e) => setEditForm((s) => ({ ...s, contact_phone: e.target.value }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-ins-notes">
                    <Textarea id="edit-ins-notes" value={editForm.notes}
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
