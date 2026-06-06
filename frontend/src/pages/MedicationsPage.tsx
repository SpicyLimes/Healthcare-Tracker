import { useEffect, useState, type FormEvent } from "react";
import { medicationsApi, type Medication, type MedicationInput, type MedicationKind } from "../api/medications";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";

const EMPTY: MedicationInput = {
  name: "",
  kind: "medication",
  dose: null,
  frequency: null,
  route: null,
  prescribing_doctor: null,
  start_date: null,
  end_date: null,
  is_active: true,
  notes: null,
};

export default function MedicationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Medication[]>([]);
  const [form, setForm] = useState<MedicationInput>(EMPTY);
  const [error, setError] = useState("");

  async function reload() {
    setRows(await medicationsApi.list());
  }
  useEffect(() => {
    reload().catch(() => setError("Failed to load medications"));
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

  return (
    <AppShell>
      <PageLayout
        title="Medications"
        description="Track current and past medications, dosages, and prescribing doctors."
      >
        {isAdmin && (
          <Card>
            <CardContent className="py-6">
              <form onSubmit={onAdd} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Medication Name" htmlFor="med-name">
                    <Input
                      id="med-name"
                      required
                      placeholder="e.g. Lisinopril"
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Kind" htmlFor="med-kind">
                    <Select
                      id="med-kind"
                      value={form.kind ?? "medication"}
                      onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as MedicationKind }))}
                    >
                      <option value="medication">Medication</option>
                      <option value="vitamin">Vitamin</option>
                      <option value="supplement">Supplement</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Dose" htmlFor="med-dose">
                    <Input
                      id="med-dose"
                      placeholder="e.g. 10 mg"
                      value={form.dose ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, dose: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="Frequency" htmlFor="med-frequency">
                    <Input
                      id="med-frequency"
                      placeholder="e.g. Once daily"
                      value={form.frequency ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, frequency: e.target.value || null }))}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Route" htmlFor="med-route">
                    <Select
                      id="med-route"
                      value={form.route ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, route: e.target.value || null }))}
                    >
                      <option value="">Select…</option>
                      <option value="oral">Oral</option>
                      <option value="topical">Topical</option>
                      <option value="injection">Injection</option>
                      <option value="inhaled">Inhaled</option>
                      <option value="other">Other</option>
                    </Select>
                  </FormField>
                  <FormField label="Prescribing Doctor" htmlFor="med-prescriber">
                    <Input
                      id="med-prescriber"
                      placeholder="Doctor name"
                      value={form.prescribing_doctor ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, prescribing_doctor: e.target.value || null }))}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Start Date" htmlFor="med-start">
                    <Input
                      id="med-start"
                      type="date"
                      value={form.start_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="End Date" htmlFor="med-end">
                    <Input
                      id="med-end"
                      type="date"
                      value={form.end_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value || null }))}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Status" htmlFor="med-active">
                    <Select
                      id="med-active"
                      value={form.is_active === false ? "false" : "true"}
                      onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.value === "true" }))}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Notes" htmlFor="med-notes">
                  <Textarea
                    id="med-notes"
                    placeholder="Side effects, instructions, or other notes…"
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                  />
                </FormField>
                <div className="flex justify-end">
                  <Button type="submit">Add Medication</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kind</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dose</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Route</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Active</th>
                {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{r.kind}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.dose ?? ""}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{r.route ?? ""}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.is_active ? "Yes" : "No"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>
                        Delete
                      </Button>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <DocumentsPanel section="medications" recordId={r.id} isAdmin={isAdmin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageLayout>
    </AppShell>
  );
}
