import React, { useEffect, useState, type FormEvent } from "react";
import { doctorsApi, type Doctor, type DoctorInput } from "../api/doctors";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";

const EMPTY: DoctorInput = {
  name: "",
  specialty: null,
  practice: null,
  phone: null,
  address: null,
  patient_portal_url: null,
  notes: null,
};

export default function DoctorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Doctor[]>([]);
  const [form, setForm] = useState<DoctorInput>(EMPTY);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<Doctor | null>(null);
  const [editForm, setEditForm] = useState<DoctorInput>(EMPTY);
  const [editError, setEditError] = useState("");

  async function reload() {
    setRows(await doctorsApi.list());
  }
  useEffect(() => {
    reload().catch(() => setError("Failed to load doctors"));
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await doctorsApi.create(form);
      setForm(EMPTY);
      await reload();
    } catch {
      setError("Could not add record");
    }
  }

  async function onDelete(id: string) {
    try {
      await doctorsApi.remove(id);
      await reload();
    } catch {
      setError("Could not delete record");
    }
  }

  function openEdit(r: Doctor) {
    setEditingRow(r);
    setEditForm({ name: r.name, specialty: r.specialty, practice: r.practice, phone: r.phone, address: r.address, patient_portal_url: r.patient_portal_url, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await doctorsApi.update(editingRow.id, editForm);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout
        title="Doctors & Specialists"
        description="Manage your physicians, specialists, and care providers."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-8" />
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Specialty</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Practice</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Portal URL</th>
                {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
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
                    <td className="px-4 py-3 text-muted-foreground">{r.specialty ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.practice ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.phone ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.patient_portal_url ? (
                        <a
                          href={r.patient_portal_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Portal
                        </a>
                      ) : ""}
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
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-3 text-sm text-muted-foreground">
                        <div className="flex flex-col gap-3">
                          {r.address && (
                            <div>
                              <span className="font-medium text-foreground mr-2">Address:</span>
                              <span className="whitespace-pre-wrap">{r.address}</span>
                            </div>
                          )}
                          {r.notes && (
                            <div className="whitespace-pre-wrap">
                              <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                            </div>
                          )}
                          <DocumentsPanel section="doctors" recordId={r.id} isAdmin={isAdmin} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
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
                  <FormField label="Name" htmlFor="doc-name">
                    <Input
                      id="doc-name"
                      required
                      placeholder="Doctor's full name"
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Specialty" htmlFor="doc-specialty">
                    <Input
                      id="doc-specialty"
                      placeholder="e.g. Cardiology"
                      value={form.specialty ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, specialty: e.target.value || null }))}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Practice / Clinic" htmlFor="doc-practice">
                    <Input
                      id="doc-practice"
                      placeholder="Practice or clinic name"
                      value={form.practice ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, practice: e.target.value || null }))}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Phone" htmlFor="doc-phone">
                    <Input id="doc-phone" type="tel" placeholder="(555) 000-0000"
                      value={form.phone ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value || null }))} />
                  </FormField>
                  <FormField label="Patient Portal URL" htmlFor="doc-portal">
                    <Input id="doc-portal" type="url" placeholder="https://portal.example.com"
                      value={form.patient_portal_url ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, patient_portal_url: e.target.value || null }))} />
                  </FormField>
                </div>
                <FormField label="Address" htmlFor="doc-address">
                  <Textarea id="doc-address" placeholder="Street address, city, state, zip"
                    value={form.address ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, address: e.target.value || null }))} />
                </FormField>
                <FormField label="Notes" htmlFor="doc-notes">
                  <Textarea
                    id="doc-notes"
                    placeholder="Additional notes…"
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                  />
                </FormField>
                <div className="flex justify-end">
                  <Button type="submit">Add Doctor</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-doc-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-doc-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Doctor</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Name" htmlFor="edit-doc-name">
                  <Input id="edit-doc-name" required value={editForm.name ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
                </FormField>
                <FormField label="Specialty" htmlFor="edit-doc-specialty">
                  <Input id="edit-doc-specialty" value={editForm.specialty ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, specialty: e.target.value || null }))} />
                </FormField>
                <FormField label="Practice / Clinic" htmlFor="edit-doc-practice">
                  <Input id="edit-doc-practice" value={editForm.practice ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, practice: e.target.value || null }))} />
                </FormField>
                <FormField label="Phone" htmlFor="edit-doc-phone">
                  <Input id="edit-doc-phone" type="tel" value={editForm.phone ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value || null }))} />
                </FormField>
                <FormField label="Patient Portal URL" htmlFor="edit-doc-portal">
                  <Input id="edit-doc-portal" type="url" value={editForm.patient_portal_url ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, patient_portal_url: e.target.value || null }))} />
                </FormField>
              </div>
              <FormField label="Address" htmlFor="edit-doc-address">
                <Textarea id="edit-doc-address" value={editForm.address ?? ""}
                  onChange={(e) => setEditForm((s) => ({ ...s, address: e.target.value || null }))} />
              </FormField>
              <FormField label="Notes" htmlFor="edit-doc-notes">
                <Textarea id="edit-doc-notes" value={editForm.notes ?? ""}
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
