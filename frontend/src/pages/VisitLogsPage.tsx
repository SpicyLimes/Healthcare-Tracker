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
import { RecordFormModal } from "@/components/RecordFormModal";

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
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<VisitLog | null>(null);
  const [form, setForm] = useState<VisitLogInput>(EMPTY);
  const [modalError, setModalError] = useState("");

  async function reload() { setRows(await visitLogsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load visit logs"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: VisitLog) {
    setEditingRow(r);
    setForm({ visit_date: r.visit_date, visit_time: r.visit_time, doctor_id: r.doctor_id, doctor_other: r.doctor_other, reason: r.reason, summary: r.summary, follow_up: r.follow_up, follow_up_date: r.follow_up_date, notes: r.notes });
    setModalError("");
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingRow(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    try {
      if (modalMode === "edit" && editingRow) {
        await visitLogsApi.update(editingRow.id, form);
      } else {
        await visitLogsApi.create(form);
      }
      closeModal();
      await reload();
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add record");
    }
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
        action={isAdmin ? <Button onClick={openAdd}>+ Add</Button> : undefined}
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
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Visit Log" : "Add Visit Log"}
          submitLabel={modalMode === "edit" ? "Save" : "Add Visit"}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Visit Date */}
            <FormField label="Visit Date" htmlFor="vl-date">
              <Input
                id="vl-date"
                type="date"
                required
                value={form.visit_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, visit_date: e.target.value || null }))}
              />
            </FormField>

            {/* Visit Time (optional) */}
            <FormField label="Visit Time" htmlFor="vl-time">
              <Input
                id="vl-time"
                type="time"
                value={form.visit_time ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, visit_time: e.target.value || null }))}
              />
            </FormField>

            {/* Reason */}
            <FormField label="Reason" htmlFor="vl-reason">
              <Input
                id="vl-reason"
                value={form.reason ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))}
                placeholder="e.g. Annual checkup"
              />
            </FormField>

            {/* Doctor (full width) */}
            <div className="sm:col-span-2">
              <FormField label="Doctor" htmlFor="vl-doctor">
                <DoctorPicker
                  doctorId={form.doctor_id ?? null}
                  doctorOther={form.doctor_other ?? null}
                  onChange={(id, other) => setForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
                />
              </FormField>
            </div>

            {/* Summary (full width) */}
            <div className="sm:col-span-2">
              <FormField label="Summary" htmlFor="vl-summary">
                <Textarea
                  id="vl-summary"
                  placeholder="Summary of the visit…"
                  value={form.summary ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, summary: e.target.value || null }))}
                />
              </FormField>
            </div>

            {/* Follow-up Notes (full width) */}
            <div className="sm:col-span-2">
              <FormField label="Follow-up Notes" htmlFor="vl-followup">
                <Textarea
                  id="vl-followup"
                  placeholder="Follow-up instructions or next steps…"
                  value={form.follow_up ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, follow_up: e.target.value || null }))}
                />
              </FormField>
            </div>

            {/* Follow-up Date */}
            <FormField label="Follow-up Date" htmlFor="vl-followup-date">
              <Input
                id="vl-followup-date"
                type="date"
                value={form.follow_up_date ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, follow_up_date: e.target.value || null }))}
              />
            </FormField>

            {/* Notes (full width) */}
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="vl-notes">
                <Textarea
                  id="vl-notes"
                  placeholder="Additional notes…"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value || null }))}
                />
              </FormField>
            </div>
          </div>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
