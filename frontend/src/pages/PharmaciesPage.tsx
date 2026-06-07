import React, { useEffect, useState, type FormEvent } from "react";
import { pharmaciesApi, type Pharmacy, type PharmacyInput } from "../api/pharmacies";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";

export default function PharmaciesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Pharmacy[]>([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    reload().catch(() => setError("Failed to load pharmacies"));
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.phone ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.address ?? ""}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>Delete</Button>
                      </td>
                    )}
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
                      <td colSpan={isAdmin ? 5 : 4} className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                        <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No pharmacies yet.
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
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
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
