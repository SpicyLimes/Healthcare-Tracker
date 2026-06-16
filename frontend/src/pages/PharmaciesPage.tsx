import { useEffect, useState, type FormEvent } from "react";
import { pharmaciesApi, type Pharmacy, type PharmacyInput } from "../api/pharmacies";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";

export default function PharmaciesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    notes: "",
  });
  const [editingRow, setEditingRow] = useState<Pharmacy | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", phone: "", notes: "" });
  const [editError, setEditError] = useState("");

  async function reload() {
    setRows(await pharmaciesApi.list());
  }

  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load pharmacies"); setRows([]); }).finally(() => setLoading(false));
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
      await pharmaciesApi.create(payload);
      setForm({ name: "", address: "", phone: "", notes: "" });
      await reload();
    } catch {
      setError("Could not add pharmacy");
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await pharmaciesApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete pharmacy");
    }
  }

  function openEdit(r: Pharmacy) {
    setEditingRow(r);
    setEditForm({
      name: r.name,
      address: r.address ?? "",
      phone: r.phone ?? "",
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
      ) as unknown as PharmacyInput;
      await pharmaciesApi.update(editingRow.id, payload);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout title="Pharmacies" description="Preferred pharmacies and contact information.">
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="name"
              primaryColumns={[
                { header: "Name", sortKey: "name", render: (r) => r.name, className: "px-4 py-3 font-medium text-foreground" },
                { header: "Phone", sortKey: "phone", render: (r) => r.phone ?? "" },
                { header: "Address", sortKey: "address", render: (r) => r.address ?? "" },
              ]}
              detailTitle={(r) => r.name}
              detailFields={(r) => [
                { label: "Phone", value: r.phone },
                { label: "Address", value: r.address },
                { label: "Fax", value: r.fax },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="pharmacies" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.name}
              getSubtitle={(r) => r.phone ?? null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No pharmacy records yet."
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
                    <FormField label="Name" htmlFor="name">
                      <Input
                        id="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="e.g. CVS Pharmacy"
                      />
                    </FormField>
                  </div>

                  <FormField label="Phone" htmlFor="phone">
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="e.g. +1 555-555-0100"
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label="Address" htmlFor="address">
                      <Textarea
                        id="address"
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        placeholder="Street address..."
                      />
                    </FormField>
                  </div>

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
                  <Button type="submit">Add pharmacy</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-pharm-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-pharm-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Pharmacy</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Name" htmlFor="edit-pharm-name">
                    <Input id="edit-pharm-name" required value={editForm.name}
                      onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Phone" htmlFor="edit-pharm-phone">
                  <Input id="edit-pharm-phone" type="tel" value={editForm.phone}
                    onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Address" htmlFor="edit-pharm-address">
                    <Textarea id="edit-pharm-address" value={editForm.address}
                      onChange={(e) => setEditForm((s) => ({ ...s, address: e.target.value }))} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-pharm-notes">
                    <Textarea id="edit-pharm-notes" value={editForm.notes}
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
