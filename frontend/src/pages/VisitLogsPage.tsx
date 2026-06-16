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
import { RecordTable } from "@/components/RecordTable";

function formatDateWithTime(dateStr: string | null, timeStr: string | null): string {
  if (!dateStr) return "—";
  const datePart = formatDate(dateStr);
  if (!timeStr) return datePart;
  // timeStr is "HH:MM" or "HH:MM:SS" — render as 12-hour
  const [h, m] = timeStr.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${datePart} · ${h12}:${m} ${ampm}`;
}

const EMPTY: VisitLogInput = {
  visit_date: null,
  visit_time: null,
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
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<VisitLogInput>(EMPTY);
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState<VisitLog | null>(null);
  const [editForm, setEditForm] = useState<VisitLogInput>(EMPTY);
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await visitLogsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load visit logs"); setRows([]); }).finally(() => setLoading(false));
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

  function openEdit(r: VisitLog) {
    setEditingRow(r);
    setEditForm({ visit_date: r.visit_date, visit_time: r.visit_time, doctor_id: r.doctor_id, doctor_other: r.doctor_other, reason: r.reason, summary: r.summary, follow_up: r.follow_up, follow_up_date: r.follow_up_date, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      await visitLogsApi.update(editingRow.id, editForm);
      closeEdit();
      await reload();
    } catch { setEditError("Could not update record"); }
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
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="visit_date"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date", sortKey: "visit_date", render: (r) => r.visit_date ? formatDateWithTime(r.visit_date, r.visit_time) : "", className: "px-4 py-3 font-medium text-foreground" },
                { header: "Doctor", sortKey: "doctor_other", render: (r) => resolveDoctorName(r.doctor_id, r.doctor_other) },
                { header: "Reason", sortKey: "reason", render: (r) => r.reason ?? "" },
              ]}
              detailTitle={(r) => r.visit_date ? formatDateWithTime(r.visit_date, r.visit_time) : "Visit"}
              detailFields={(r) => [
                { label: "Date", value: r.visit_date ? formatDateWithTime(r.visit_date, r.visit_time) : null },
                { label: "Doctor", value: resolveDoctorName(r.doctor_id, r.doctor_other) || null },
                { label: "Reason", value: r.reason },
                { label: "Summary", value: r.summary },
                { label: "Follow-up", value: r.follow_up },
                { label: "Follow-up Date", value: r.follow_up_date },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="visit_logs" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => r.visit_date ? formatDateWithTime(r.visit_date, r.visit_time) : "Visit"}
              getSubtitle={(r) => resolveDoctorName(r.doctor_id, r.doctor_other) || null}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No visit log records yet."
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
                  {/* Visit Date */}
                  <FormField label="Visit Date" htmlFor="visit_date">
                    <Input
                      id="visit_date"
                      type="date"
                      required
                      value={form.visit_date ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
                    />
                  </FormField>

                  {/* Visit Time */}
                  <FormField label="Visit Time" htmlFor="visit_time">
                    <Input
                      id="visit_time"
                      type="time"
                      value={form.visit_time ?? ""}
                      onChange={(e) => setForm((s) => ({ ...s, visit_time: e.target.value || null }))}
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
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-vl-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="mx-4 sm:mx-auto w-full sm:max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-vl-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Visit Log</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Visit Date" htmlFor="edit-vl-date">
                  <Input id="edit-vl-date" type="date" value={editForm.visit_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, visit_date: e.target.value || null }))} />
                </FormField>
                <FormField label="Visit Time" htmlFor="edit-vl-time">
                  <Input id="edit-vl-time" type="time" value={editForm.visit_time ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, visit_time: e.target.value || null }))} />
                </FormField>
                <FormField label="Reason" htmlFor="edit-vl-reason">
                  <Input id="edit-vl-reason" value={editForm.reason ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, reason: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Doctor" htmlFor="edit-vl-doctor">
                    <DoctorPicker
                      doctorId={editForm.doctor_id ?? null}
                      doctorOther={editForm.doctor_other ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Summary" htmlFor="edit-vl-summary">
                    <Textarea id="edit-vl-summary" value={editForm.summary ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, summary: e.target.value || null }))} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Follow-up Notes" htmlFor="edit-vl-followup">
                    <Textarea id="edit-vl-followup" value={editForm.follow_up ?? ""}
                      onChange={(e) => setEditForm((s) => ({ ...s, follow_up: e.target.value || null }))} />
                  </FormField>
                </div>
                <FormField label="Follow-up Date" htmlFor="edit-vl-followup-date">
                  <Input id="edit-vl-followup-date" type="date" value={editForm.follow_up_date ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, follow_up_date: e.target.value || null }))} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="edit-vl-notes">
                    <Textarea id="edit-vl-notes" value={editForm.notes ?? ""}
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
