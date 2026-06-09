import React, { useEffect, useState, type FormEvent } from "react";
import { insurancesApi, type Insurance, type InsuranceInput } from "../api/insurances";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { SortableTh } from "@/components/SortableTh";

export default function InsurancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Insurance[]>([]);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows as Record<string, unknown>[], "insurer_name", "asc");
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    reload().catch(() => setError("Failed to load insurance records"));
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-8" />
                <SortableTh label="Insurer" sortKey="insurer_name" sort={sort} onSort={toggleSort} />
                <SortableTh label="Policy #" sortKey="policy_number" sort={sort} onSort={toggleSort} />
                <SortableTh label="Group #" sortKey="group_number" sort={sort} onSort={toggleSort} />
                <SortableTh label="Phone" sortKey="contact_phone" sort={sort} onSort={toggleSort} />
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
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
                    <td className="px-4 py-3 font-medium text-foreground">{r.insurer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.policy_number ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.group_number ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.contact_phone ?? ""}</td>
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
                          <DocumentsPanel section="insurances" recordId={r.id} isAdmin={isAdmin} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No insurance records yet.
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
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
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
