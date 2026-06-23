import { useEffect, useState, type FormEvent } from "react";
import {
  appointmentsApi,
  type Appointment,
  type AppointmentInput,
  type AppointmentStatus,
  type AppointmentType,
} from "../api/appointments";
import DoctorPicker from "../components/DoctorPicker";
import { doctorsApi, type Doctor } from "../api/doctors";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";
import { localToUtcIso, formatInTimezone, toLocalInputValue } from "@/lib/datetime";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";

const STATUSES: AppointmentStatus[] = ["upcoming", "completed", "cancelled", "rescheduled"];

const STATUS_VARIANT: Record<AppointmentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  upcoming: "default",
  completed: "secondary",
  cancelled: "destructive",
  rescheduled: "outline",
};

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: "annual_checkup", label: "Annual Checkup" },
  { value: "follow_up", label: "Follow-up" },
  { value: "specialist", label: "Specialist" },
  { value: "lab", label: "Lab/Blood Work" },
  { value: "imaging", label: "Imaging" },
  { value: "dental", label: "Dental" },
  { value: "vision", label: "Vision" },
  { value: "other", label: "Other" },
];

const EMPTY: AppointmentInput = {
  appointment_datetime: "",
  appointment_type: null,
  doctor_id: null,
  doctor_other: null,
  location: null,
  reason: null,
  status: "upcoming",
  notes: null,
};

export default function AppointmentsPage() {
  const { user } = useAuth();
  const tz = user?.timezone ?? "America/Chicago";
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<Appointment | null>(null);
  const [form, setForm] = useState<AppointmentInput>(EMPTY);
  const [modalError, setModalError] = useState("");

  async function reload() { setRows(await appointmentsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load appointments"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  function appointmentTypeLabel(t: AppointmentType | null): string {
    return APPOINTMENT_TYPES.find((x) => x.value === t)?.label ?? "";
  }

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  function openAdd() {
    setForm(EMPTY);
    setEditingRow(null);
    setModalError("");
    setModalMode("add");
  }

  function openEdit(r: Appointment) {
    setEditingRow(r);
    setForm({
      appointment_datetime: toLocalInputValue(r.appointment_datetime, tz),
      appointment_type: r.appointment_type,
      doctor_id: r.doctor_id,
      doctor_other: r.doctor_other,
      location: r.location,
      reason: r.reason,
      status: r.status,
      notes: r.notes,
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
        const payload = {
          ...form,
          appointment_datetime: localToUtcIso(form.appointment_datetime, tz),
        };
        await appointmentsApi.update(editingRow.id, payload);
      } else {
        const payload = {
          ...form,
          appointment_datetime: localToUtcIso(form.appointment_datetime, tz),
        };
        await appointmentsApi.create(payload);
      }
      closeModal();
      await reload();
    } catch {
      setModalError(modalMode === "edit" ? "Could not update record" : "Could not add record");
    }
  }

  async function onDelete(id: string) {
    try { await appointmentsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  return (
    <AppShell>
      <PageLayout
        title="Appointments"
        description="Manage upcoming and past healthcare appointments."
        action={isAdmin ? <Button onClick={openAdd}>+ Add</Button> : undefined}
      >
        <Card>
          <CardContent className="p-0">
            <RecordTable
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              getRowId={(r) => r.id}
              defaultSortKey="appointment_datetime"
              defaultSortDir="desc"
              primaryColumns={[
                { header: "Date / Time", sortKey: "appointment_datetime", render: (r) => formatInTimezone(r.appointment_datetime, tz), className: "px-4 py-3 font-medium text-foreground" },
                { header: "Doctor", sortKey: "doctor_other", render: (r) => resolveDoctorName(r.doctor_id, r.doctor_other) },
                { header: "Status", sortKey: "status", render: (r) => <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">{r.status}</Badge> },
              ]}
              detailTitle={(r) => formatInTimezone(r.appointment_datetime, tz)}
              detailFields={(r) => [
                { label: "Type", value: appointmentTypeLabel(r.appointment_type) || null },
                { label: "Doctor", value: resolveDoctorName(r.doctor_id, r.doctor_other) || null },
                { label: "Location", value: r.location },
                { label: "Reason", value: r.reason },
                { label: "Status", value: <span className="capitalize">{r.status}</span> },
                { label: "Notes", value: r.notes },
              ]}
              renderDetailExtra={(r) => <DocumentsPanel section="appointments" recordId={r.id} isAdmin={isAdmin} />}
              getHeadline={(r) => formatInTimezone(r.appointment_datetime, tz)}
              getSubtitle={(r) => resolveDoctorName(r.doctor_id, r.doctor_other) || null}
              getBadge={(r) => ({ label: r.status, variant: STATUS_VARIANT[r.status] })}
              onEdit={(r) => openEdit(r)}
              onDelete={(r) => onDelete(r.id)}
              emptyMessage="No appointment records yet."
            />
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </PageLayout>
      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Appointment" : "Add Appointment"}
          submitLabel={modalMode === "edit" ? "Save" : "Add Appointment"}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Date/Time */}
            <FormField label="Date / Time" htmlFor="appointment_datetime">
              <Input
                id="appointment_datetime"
                required
                type="datetime-local"
                value={form.appointment_datetime}
                onChange={(e) => setForm((s) => ({ ...s, appointment_datetime: e.target.value }))}
              />
            </FormField>

            {/* Appointment Type */}
            <FormField label="Appointment Type" htmlFor="appointment_type">
              <Select
                id="appointment_type"
                value={form.appointment_type ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, appointment_type: (e.target.value as AppointmentType) || null }))}
              >
                <option value="">Select…</option>
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </FormField>

            {/* Doctor (full width) */}
            <div className="sm:col-span-2">
              <FormField label="Doctor" htmlFor="appt-doctor">
                <DoctorPicker
                  doctorId={form.doctor_id ?? null}
                  doctorOther={form.doctor_other ?? null}
                  onChange={(id, other) => setForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
                />
              </FormField>
            </div>

            {/* Location */}
            <FormField label="Location" htmlFor="location">
              <Input
                id="location"
                value={form.location ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, location: e.target.value || null }))}
                placeholder="e.g. Main Street Clinic"
              />
            </FormField>

            {/* Reason */}
            <FormField label="Reason" htmlFor="reason">
              <Input
                id="reason"
                value={form.reason ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))}
                placeholder="e.g. Annual physical"
              />
            </FormField>

            {/* Status */}
            <FormField label="Status" htmlFor="status">
              <Select
                id="status"
                value={form.status ?? "upcoming"}
                onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as AppointmentStatus }))}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </Select>
            </FormField>

            {/* Notes (full width) */}
            <div className="sm:col-span-2">
              <FormField label="Notes" htmlFor="appt-notes">
                <Textarea
                  id="appt-notes"
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
