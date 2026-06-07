import { useEffect, useState, type FormEvent } from "react";
import { medicationsApi, type Medication, type MedicationInput, type MedicationKind } from "../api/medications";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
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
  prescribing_doctor_id: null,
  is_active: true,
  notes: null,
};

export default function MedicationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Medication[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<MedicationInput>(EMPTY);
  const [error, setError] = useState("");

  async function reload() {
    setRows(await medicationsApi.list());
  }
  useEffect(() => {
    reload().catch(() => setError("Failed to load medications"));
    doctorsApi.list().then(setDoctors).catch(() => {});
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

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  return (
    <AppShell>
      <PageLayout
        title="Medications"
        description="Track current and past medications, dosages, and prescribing doctors."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kind</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dose</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Frequency</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Route</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Prescribing Doctor</th>
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
                  <td className="px-4 py-3 text-muted-foreground">{r.frequency ?? ""}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{r.route ?? ""}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {resolveDoctorName(r.prescribing_doctor_id, r.prescribing_doctor)}
                  </td>
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No medication records yet.
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
                  <FormField label="Medication Name" htmlFor="med-name">
                    <Input id="med-name" required placeholder="e.g. Lisinopril"
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
                  </FormField>
                  <FormField label="Kind" htmlFor="med-kind">
                    <Select id="med-kind" value={form.kind ?? "medication"}
                      onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as MedicationKind }))}>
                      <option value="medication">Medication</option>
                      <option value="vitamin">Vitamin</option>
                      <option value="supplement">Supplement</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Dose" htmlFor="med-dose">
                    <Input id="med-dose" placeholder="e.g. 10 mg"
                      value={form.dose ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, dose: e.target.value || null }))} />
                  </FormField>
                  <FormField label="Frequency" htmlFor="med-frequency">
                    <Input id="med-frequency" placeholder="e.g. Once daily"
                      value={form.frequency ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, frequency: e.target.value || null }))} />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField label="Route" htmlFor="med-route">
                    <Select id="med-route" value={form.route ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, route: e.target.value || null }))}>
                      <option value="">Select…</option>
                      <option value="oral">Oral</option>
                      <option value="topical">Topical</option>
                      <option value="injection">Injection</option>
                      <option value="inhaled">Inhaled</option>
                      <option value="other">Other</option>
                    </Select>
                  </FormField>
                  <FormField label="Status" htmlFor="med-active">
                    <Select id="med-active" value={form.is_active === false ? "false" : "true"}
                      onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.value === "true" }))}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Prescribing Doctor" htmlFor="med-prescriber">
                  <DoctorPicker
                    doctorId={form.prescribing_doctor_id ?? null}
                    doctorOther={form.prescribing_doctor ?? null}
                    onChange={(id, other) => setForm((s) => ({ ...s, prescribing_doctor_id: id, prescribing_doctor: other }))}
                  />
                </FormField>
                <FormField label="Notes" htmlFor="med-notes">
                  <Textarea id="med-notes" placeholder="Side effects, instructions, or other notes…"
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))} />
                </FormField>
                <div className="flex justify-end">
                  <Button type="submit">Add Medication</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
    </AppShell>
  );
}
