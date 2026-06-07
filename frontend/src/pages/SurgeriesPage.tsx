import React, { useEffect, useState, type FormEvent } from "react";
import { surgeriesApi, type Surgery, type SurgeryInput } from "../api/surgeries";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { ChevronRight, ChevronDown } from "lucide-react";

export default function SurgeriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Surgery[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<SurgeryInput>({ procedure: "" });
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function reload() { setRows(await surgeriesApi.list()); }
  useEffect(() => {
    reload().catch(() => setError("Failed to load surgeries"));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await surgeriesApi.create(form);
      setForm({ procedure: "" });
      await reload();
    } catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await surgeriesApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  return (
    <AppShell>
      <PageLayout title="Surgery Records" description="Surgical procedures and outcomes.">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Procedure</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Surgeon</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hospital</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Outcome</th>
                    {isAdmin && <th className="px-4 py-3" />}
                    <th className="px-4 py-3" />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{r.procedure}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.surgery_date ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {resolveDoctorName(r.surgeon_id, r.surgeon_other)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.hospital ?? ""}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.outcome ?? ""}</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>
                              Delete
                            </Button>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <DocumentsPanel section="surgeries" recordId={r.id} isAdmin={isAdmin} />
                        </td>
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
                          <td colSpan={isAdmin ? 8 : 7} className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                            <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No surgery records yet.
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
                  {/* Procedure (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Procedure" htmlFor="procedure">
                      <Input
                        id="procedure"
                        type="text"
                        required
                        value={form.procedure}
                        onChange={(e) => setForm((s) => ({ ...s, procedure: e.target.value }))}
                        placeholder="e.g. Appendectomy"
                      />
                    </FormField>
                  </div>

                  {/* Date | Hospital */}
                  <FormField label="Surgery Date" htmlFor="surgery_date">
                    <Input
                      id="surgery_date"
                      type="date"
                      value={form.surgery_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, surgery_date: e.target.value || null }))}
                    />
                  </FormField>
                  <FormField label="Hospital" htmlFor="hospital">
                    <Input
                      id="hospital"
                      type="text"
                      value={form.hospital ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, hospital: e.target.value || null }))}
                      placeholder="e.g. General Hospital"
                    />
                  </FormField>

                  {/* Surgeon (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Surgeon" htmlFor="surgeon">
                      <DoctorPicker
                        doctorId={form.surgeon_id ?? null}
                        doctorOther={form.surgeon_other ?? null}
                        onChange={(id, other) => setForm((s) => ({ ...s, surgeon_id: id, surgeon_other: other }))}
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
