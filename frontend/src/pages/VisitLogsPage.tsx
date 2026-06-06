import { useEffect, useState, type FormEvent } from "react";
import { visitLogsApi, type VisitLog, type VisitLogInput } from "../api/visitLogs";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { formatDate } from "@/lib/format";

const EMPTY: VisitLogInput = {
  visit_date: null,
  doctor_id: null,
  doctor_other: null,
  reason: null,
  summary: null,
  follow_up: null,
  follow_up_date: null,
  notes: null,
};

export default function VisitLogsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<VisitLog[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<VisitLogInput>(EMPTY);
  const [error, setError] = useState("");

  async function reload() { setRows(await visitLogsApi.list()); }
  useEffect(() => {
    reload().catch(() => setError("Failed to load visit logs"));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await visitLogsApi.create(form); setForm(EMPTY); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await visitLogsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  return (
    <AppShell>
      <PageLayout
        title="Visit Logs"
        description="Record doctor visits, summaries, and follow-up actions."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Summary</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Follow-up Date</th>
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{formatDate(r.visit_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{resolveDoctorName(r.doctor_id, r.doctor_other)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {r.summary ? r.summary.slice(0, 60) + (r.summary.length > 60 ? "…" : "") : ""}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.follow_up_date ?? ""}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>
                            Delete
                          </Button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <DocumentsPanel section="visit_logs" recordId={r.id} isAdmin={isAdmin} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No visit log records yet.
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
                  {/* Visit Date */}
                  <FormField label="Visit Date" htmlFor="visit_date">
                    <Input
                      id="visit_date"
                      type="date"
                      value={form.visit_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Reason */}
                  <FormField label="Reason" htmlFor="reason">
                    <Input
                      id="reason"
                      value={form.reason ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))}
                      placeholder="e.g. Annual checkup"
                    />
                  </FormField>

                  {/* Doctor (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Doctor" htmlFor="visit-doctor">
                      <DoctorPicker
                        doctorId={form.doctor_id ?? null}
                        doctorOther={form.doctor_other ?? null}
                        onChange={(id, other) => setForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
                      />
                    </FormField>
                  </div>

                  {/* Summary (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Summary" htmlFor="summary">
                      <Textarea
                        id="summary"
                        placeholder="Summary of the visit…"
                        value={form.summary ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, summary: e.target.value || null }))}
                      />
                    </FormField>
                  </div>

                  {/* Follow-up Notes (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Follow-up Notes" htmlFor="follow_up">
                      <Textarea
                        id="follow_up"
                        placeholder="Follow-up instructions or next steps…"
                        value={form.follow_up ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, follow_up: e.target.value || null }))}
                      />
                    </FormField>
                  </div>

                  {/* Follow-up Date */}
                  <FormField label="Follow-up Date" htmlFor="follow_up_date">
                    <Input
                      id="follow_up_date"
                      type="date"
                      value={form.follow_up_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, follow_up_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Notes (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Notes" htmlFor="visit-notes">
                      <Textarea
                        id="visit-notes"
                        placeholder="Additional notes…"
                        value={form.notes ?? ""}
                        onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add Visit</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PageLayout>
    </AppShell>
  );
}
