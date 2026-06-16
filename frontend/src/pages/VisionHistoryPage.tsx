import { useEffect, useState, type FormEvent } from "react";
import { visionHistoryApi, type VisionHistory, type VisionHistoryInput } from "../api/visionHistory";
import { doctorsApi, type Doctor } from "../api/doctors";
import DoctorPicker from "../components/DoctorPicker";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { RecordTable } from "@/components/RecordTable";

export default function VisionHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<VisionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<VisionHistoryInput>({});
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState<VisionHistory | null>(null);
  const [editForm, setEditForm] = useState<VisionHistoryInput>({});
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await visionHistoryApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load vision history"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

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

  function openEdit(r: VisionHistory) {
    setEditingRow(r);
    setEditForm({ visit_date: r.visit_date, provider_id: r.provider_id, provider_other: r.provider_other, rx_od: r.rx_od, rx_os: r.rx_os, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await visionHistoryApi.update(editingRow.id, editForm);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout title="Vision History" description="Eye exams, prescriptions, and vision care.">
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="visit_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date", sortKey: "visit_date", render: (r) => r.visit_date ?? "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Provider", sortKey: "provider_other", render: (r) => resolveDoctorName(r.provider_id, r.provider_other) },
                { header: "Rx OD", sortKey: "rx_od", render: (r) => r.rx_od ?? "" },
              ]}
              detailTitle={(r) => r.visit_date ?? "Vision Visit"}
              detailFields={(r) => [
                { label: "Date", value: r.visit_date },
                { label: "Provider", value: resolveDoctorName(r.provider_id, r.provider_other) || null },
                { label: "Rx OD", value: r.rx_od },
                { label: "Rx OS", value: r.rx_os },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="vision_history" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.visit_date ?? "Vision Visit"}
              getSubtitle={(r) => resolveDoctorName(r.provider_id, r.provider_other) || null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No vision history records yet."
            />
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
                      required
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
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-vis-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-vis-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Vision Record</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Visit Date" htmlFor="edit-vis-date">
                  <Input id="edit-vis-date" type="date" value={editForm.visit_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, visit_date: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Provider" htmlFor="edit-vis-provider">
                    <DoctorPicker
                      doctorId={editForm.provider_id ?? null}
                      doctorOther={editForm.provider_other ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, provider_id: id, provider_other: other }))}
                    />
                  </FormField>
                </div>
                <FormField label="Rx OD (right eye)" htmlFor="edit-vis-od">
                  <Input id="edit-vis-od" value={editForm.rx_od ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, rx_od: e.target.value || null }))} />
                </FormField>
                <FormField label="Rx OS (left eye)" htmlFor="edit-vis-os">
                  <Input id="edit-vis-os" value={editForm.rx_os ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, rx_os: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-vis-notes">
                    <Textarea id="edit-vis-notes" value={editForm.notes ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value || null }))} />
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
