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
import { formatDatetime } from "@/lib/format";

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
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<AppointmentInput>(EMPTY);
  const [error, setError] = useState("");

  async function reload() { setRows(await appointmentsApi.list()); }
  useEffect(() => {
    reload().catch(() => setError("Failed to load appointments"));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try { await appointmentsApi.create(form); setForm(EMPTY); await reload(); }
    catch { setError("Could not add record"); }
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
      >
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

                <div className="mt-4 flex justify-end">
                  <Button type="submit">Add Appointment</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date / Time</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const typeLabel = APPOINTMENT_TYPES.find((t) => t.value === r.appointment_type)?.label ?? "—";
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{formatDatetime(r.appointment_datetime)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{typeLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {resolveDoctorName(r.doctor_id, r.doctor_other)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.location ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                            {r.status}
                          </Badge>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>
                              Delete
                            </Button>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <DocumentsPanel section="appointments" recordId={r.id} isAdmin={isAdmin} />
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No appointment records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    </AppShell>
  );
}
