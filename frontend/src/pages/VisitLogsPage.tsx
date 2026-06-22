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
import { formatDate, feetInchesToIn, inToFeetInches, formatHeight } from "@/lib/format";
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
  bp_systolic: null,
  bp_diastolic: null,
  pulse_bpm: null,
  height_in: null,
  weight_lb: null,
  temperature_f: null,
  respiratory_rate: null,
  spo2: null,
  blood_glucose: null,
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
  const [heightFt, setHeightFt] = useState<number | null>(null);
  const [heightIn, setHeightIn] = useState<number | null>(null);

  async function reload() { setRows(await visitLogsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load visit logs"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  useEffect(() => {
    setForm((s) => ({ ...s, height_in: feetInchesToIn(heightFt, heightIn) }));
  }, [heightFt, heightIn]);

  function openAdd() {
    setForm(EMPTY);
    setHeightFt(null);
    setHeightIn(null);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: VisitLog) {
    setEditingRow(r);
    const { ft, inches } = inToFeetInches(r.height_in);
    setHeightFt(ft);
    setHeightIn(inches);
    setForm({
      visit_date: r.visit_date,
      visit_time: r.visit_time,
      doctor_id: r.doctor_id,
      doctor_other: r.doctor_other,
      reason: r.reason,
      summary: r.summary,
      follow_up: r.follow_up,
      follow_up_date: r.follow_up_date,
      notes: r.notes,
      bp_systolic: r.bp_systolic,
      bp_diastolic: r.bp_diastolic,
      pulse_bpm: r.pulse_bpm,
      height_in: r.height_in,
      weight_lb: r.weight_lb,
      temperature_f: r.temperature_f,
      respiratory_rate: r.respiratory_rate,
      spo2: r.spo2,
      blood_glucose: r.blood_glucose,
    });
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
                { label: "Blood Pressure", value: (r.bp_systolic != null && r.bp_diastolic != null) ? `${r.bp_systolic}/${r.bp_diastolic} mmHg` : null },
                { label: "Pulse", value: r.pulse_bpm != null ? `${r.pulse_bpm} bpm` : null },
                { label: "Height", value: r.height_in != null ? formatHeight(r.height_in) : null },
                { label: "Weight", value: r.weight_lb != null ? `${r.weight_lb} lb` : null },
                { label: "Temperature", value: r.temperature_f != null ? `${r.temperature_f}°F` : null },
                { label: "Respiratory Rate", value: r.respiratory_rate != null ? `${r.respiratory_rate} breaths/min` : null },
                { label: "SpO2", value: r.spo2 != null ? `${r.spo2}%` : null },
                { label: "Blood Glucose", value: r.blood_glucose != null ? `${r.blood_glucose} mg/dL` : null },
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

            <div className="sm:col-span-2 border-t border-border pt-4 text-sm font-medium text-muted-foreground">
              Vitals (optional) — captured to the Vitals page
            </div>
            <FormField label="Systolic (mmHg)" htmlFor="vl-sys">
              <Input id="vl-sys" type="number" value={form.bp_systolic ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, bp_systolic: e.target.value === "" ? null : Number(e.target.value) }))} />
            </FormField>
            <FormField label="Diastolic (mmHg)" htmlFor="vl-dia">
              <Input id="vl-dia" type="number" value={form.bp_diastolic ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, bp_diastolic: e.target.value === "" ? null : Number(e.target.value) }))} />
            </FormField>
            <FormField label="Pulse (bpm)" htmlFor="vl-pulse">
              <Input id="vl-pulse" type="number" value={form.pulse_bpm ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, pulse_bpm: e.target.value === "" ? null : Number(e.target.value) }))} />
            </FormField>

            {/* Height — ft/in two-field input */}
            <div className="sm:col-span-2">
              <FormField label="Height" htmlFor="vl-height-ft">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Input
                      id="vl-height-ft"
                      type="number"
                      min={0}
                      max={8}
                      className="w-16"
                      placeholder="ft"
                      value={heightFt ?? ""}
                      onChange={(e) => {
                        setHeightFt(e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))));
                      }}
                    />
                    <span className="text-sm text-muted-foreground">ft</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      id="vl-height-in"
                      type="number"
                      min={0}
                      max={11}
                      className="w-16"
                      placeholder="in"
                      value={heightIn ?? ""}
                      onChange={(e) => {
                        setHeightIn(e.target.value === "" ? null : Math.min(11, Math.max(0, Math.floor(Number(e.target.value)))));
                      }}
                    />
                    <span className="text-sm text-muted-foreground">in</span>
                  </div>
                </div>
              </FormField>
            </div>

            {/* Weight */}
            <FormField label="Weight (lb)" htmlFor="vl-weight">
              <Input
                id="vl-weight"
                type="number"
                step="0.1"
                value={form.weight_lb ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, weight_lb: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="e.g. 150"
              />
            </FormField>

            {/* Temperature */}
            <FormField label="Temperature (°F)" htmlFor="vl-temp">
              <Input
                id="vl-temp"
                type="number"
                step="0.1"
                value={form.temperature_f ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, temperature_f: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="e.g. 98.6"
              />
            </FormField>

            {/* Respiratory Rate */}
            <FormField label="Respiratory Rate (/min)" htmlFor="vl-resp">
              <Input
                id="vl-resp"
                type="number"
                value={form.respiratory_rate ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, respiratory_rate: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="e.g. 16"
              />
            </FormField>

            {/* SpO2 */}
            <FormField label="SpO2 (%)" htmlFor="vl-spo2">
              <Input
                id="vl-spo2"
                type="number"
                min={0}
                max={100}
                value={form.spo2 ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, spo2: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="e.g. 98"
              />
            </FormField>

            {/* Blood Glucose */}
            <FormField label="Blood Glucose (mg/dL)" htmlFor="vl-glucose">
              <Input
                id="vl-glucose"
                type="number"
                value={form.blood_glucose ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, blood_glucose: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="e.g. 95"
              />
            </FormField>
          </div>
        </RecordFormModal>
      )}
    </AppShell>
  );
}
