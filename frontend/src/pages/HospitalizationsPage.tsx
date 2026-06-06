import { useEffect, useState, type FormEvent } from "react";
import { hospitalizationsApi, type Hospitalization, type HospitalizationInput } from "../api/hospitalizations";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";

export default function HospitalizationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Hospitalization[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<HospitalizationInput>({ facility: "" });
  const [error, setError] = useState("");

  async function reload() { setRows(await hospitalizationsApi.list()); }
  useEffect(() => {
    reload().catch(() => setError("Failed to load hospitalizations"));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await hospitalizationsApi.create(form); setForm({ facility: "" }); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await hospitalizationsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  return (
    <AppShell>
      <PageLayout title="Hospitalizations" description="Hospital stays and inpatient events.">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Facility</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admission</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Discharge</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Outcome</th>
                    {isAdmin && <th className="px-4 py-3" />}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{r.facility}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.admission_date ?? ""}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.discharge_date ?? ""}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.reason ?? ""}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {resolveDoctorName(r.attending_physician_id, r.attending_physician_other)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.outcome ?? ""}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>
                            Delete
                          </Button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <DocumentsPanel section="hospitalizations" recordId={r.id} isAdmin={isAdmin} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No hospitalization records yet.
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
                  {/* Facility (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Facility" htmlFor="facility">
                      <Input
                        id="facility"
                        type="text"
                        required
                        value={form.facility}
                        onChange={(e) => setForm((s) => ({ ...s, facility: e.target.value }))}
                        placeholder="e.g. General Hospital"
                      />
                    </FormField>
                  </div>

                  {/* Admission Date | Discharge Date */}
                  <FormField label="Admission Date" htmlFor="admission_date">
                    <Input
                      id="admission_date"
                      type="date"
                      value={form.admission_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, admission_date: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="Discharge Date" htmlFor="discharge_date">
                    <Input
                      id="discharge_date"
                      type="date"
                      value={form.discharge_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, discharge_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Reason (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Reason" htmlFor="reason">
                      <Input
                        id="reason"
                        type="text"
                        value={form.reason ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))}
                        placeholder="e.g. Pneumonia"
                      />
                    </FormField>
                  </div>

                  {/* Attending Physician (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Doctor" htmlFor="attending_physician">
                      <DoctorPicker
                        doctorId={form.attending_physician_id ?? null}
                        doctorOther={form.attending_physician_other ?? null}
                        onChange={(id, other) => setForm((s) => ({ ...s, attending_physician_id: id, attending_physician_other: other }))}
                      />
                    </FormField>
                  </div>

                  {/* Outcome (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Outcome" htmlFor="outcome">
                      <Textarea
                        id="outcome"
                        value={form.outcome ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, outcome: e.target.value || null }))}
                        placeholder="Describe the outcome..."
                      />
                    </FormField>
                  </div>

                  {/* Notes (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Notes" htmlFor="notes">
                      <Textarea
                        id="notes"
                        value={form.notes ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                        placeholder="Additional notes..."
                      />
                    </FormField>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add Record</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
    </AppShell>
  );
}
