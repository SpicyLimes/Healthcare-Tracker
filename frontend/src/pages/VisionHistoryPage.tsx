import { useEffect, useState, type FormEvent } from "react";
import { visionHistoryApi, type VisionHistory, type VisionHistoryInput } from "../api/visionHistory";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";

export default function VisionHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<VisionHistory[]>([]);
  const [form, setForm] = useState<VisionHistoryInput>({});
  const [error, setError] = useState("");

  async function reload() { setRows(await visionHistoryApi.list()); }
  useEffect(() => { reload().catch(() => setError("Failed to load vision history")); }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await visionHistoryApi.create(form); setForm({}); await reload(); }
    catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await visionHistoryApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <AppShell>
      <PageLayout title="Vision History" description="Eye exams, prescriptions, and vision care.">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rx OD</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rx OS</th>
                    {isAdmin && <th className="px-4 py-3" />}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{r.visit_date ?? ""}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.provider_other ?? ""}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.rx_od ?? ""}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.rx_os ?? ""}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>
                            Delete
                          </Button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <DocumentsPanel section="vision_history" recordId={r.id} isAdmin={isAdmin} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No vision history records yet.
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
                  {/* Visit Date (half width) */}
                  <FormField label="Visit Date" htmlFor="visit_date">
                    <Input
                      id="visit_date"
                      type="date"
                      value={form.visit_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Provider (full width) */}
                  <div className="sm:col-span-2">
                    <FormField label="Provider" htmlFor="provider">
                      <DoctorPicker
                        doctorId={form.provider_id ?? null}
                        doctorOther={form.provider_other ?? null}
                        onChange={(id, other) => setForm((s) => ({ ...s, provider_id: id, provider_other: other }))}
                      />
                    </FormField>
                  </div>

                  {/* Rx OD | Rx OS */}
                  <FormField label="Rx OD (right eye)" htmlFor="rx_od">
                    <Input
                      id="rx_od"
                      type="text"
                      value={form.rx_od ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, rx_od: e.target.value || null }))}
                      placeholder="e.g. -2.50"
                    />
                  </FormField>
                  <FormField label="Rx OS (left eye)" htmlFor="rx_os">
                    <Input
                      id="rx_os"
                      type="text"
                      value={form.rx_os ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, rx_os: e.target.value || null }))}
                      placeholder="e.g. -2.75"
                    />
                  </FormField>

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
