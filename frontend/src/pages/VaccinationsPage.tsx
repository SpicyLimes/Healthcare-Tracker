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
  const [form, setForm] = useState<VaccinationInput>(EMPTY);
  const [error, setError] = useState("");

  async function reload() { setRows(await vaccinationsApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load vaccinations")); }, []);

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

  return (
    <AppShell>
      <PageLayout
        title="Vaccinations"
        description="Track immunization history, lot numbers, and upcoming booster dates."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vaccine</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Manufacturer</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date Administered</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Administrator</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Next Due</th>
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{r.vaccine}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.manufacturer ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.administered_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.administrator ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.next_due_date)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>
                            Delete
                          </Button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <DocumentsPanel section="vaccinations" recordId={r.id} isAdmin={isAdmin} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No vaccination records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
    </AppShell>
  );
}
