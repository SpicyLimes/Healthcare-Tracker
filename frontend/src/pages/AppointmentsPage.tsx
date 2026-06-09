import React, { useEffect, useRef, useState, type FormEvent } from "react";
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
import { localToUtcIso, formatInTimezone } from "@/lib/datetime";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import { useColumnResize } from "@/hooks/useColumnResize";
import { SortableTh } from "@/components/SortableTh";

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

function toLocalInputValue(isoUtc: string | null | undefined, timezone: string): string {
  if (!isoUtc) return "";
  try {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return formatter.format(new Date(isoUtc)).replace(" ", "T").slice(0, 16);
  } catch {
    return isoUtc.slice(0, 16);
  }
}

export default function AppointmentsPage() {
  const { user } = useAuth();
  const tz = user?.timezone ?? "America/Chicago";
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { sorted: sortedRows, sort, toggleSort } = useSort(rows, "appointment_datetime", "asc");
  const tableRef = useRef<HTMLTableElement>(null);
  const { colWidths, autoFitColumn } = useColumnResize(tableRef);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<AppointmentInput>(EMPTY);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState<AppointmentInput>(EMPTY);
  const [editError, setEditError] = useState("");

  async function reload() { setRows(await appointmentsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => { setError("Failed to load appointments"); setRows([]); }).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  function resolveDoctorName(id: string | null, other: string | null): string {
    if (id) return doctors.find((d) => d.id === id)?.name ?? other ?? "";
    return other ?? "";
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        ...form,
        appointment_datetime: localToUtcIso(form.appointment_datetime, tz),
      };
      await appointmentsApi.create(payload);
      setForm(EMPTY);
      await reload();
    } catch { setError("Could not add record"); }
  }

  async function onDelete(id: string) {
    try { await appointmentsApi.remove(id); await reload(); }
    catch { setError("Could not delete record"); }
  }

  function openEdit(r: Appointment) {
    setEditingRow(r);
    setEditForm({ appointment_datetime: toLocalInputValue(r.appointment_datetime, tz), appointment_type: r.appointment_type, doctor_id: r.doctor_id, doctor_other: r.doctor_other, location: r.location, reason: r.reason, status: r.status, notes: r.notes });
    setEditError("");
  }
  function closeEdit() { setEditingRow(null); }
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError("");
    try {
      const payload = {
        ...editForm,
        appointment_datetime: localToUtcIso(editForm.appointment_datetime ?? "", tz),
      };
      await appointmentsApi.update(editingRow.id, payload);
      setEditingRow(null);
      await reload();
    } catch { setEditError("Could not update record"); }
  }

  return (
    <AppShell>
      <PageLayout
        title="Appointments"
        description="Manage upcoming and past healthcare appointments."
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="w-8" />
                    <SortableTh label="Date / Time" sortKey="appointment_datetime" sort={sort} onSort={toggleSort} colIndex={2} width={colWidths["appointment_datetime"]} onAutoFit={autoFitColumn} />
                    <SortableTh label="Type" sortKey="appointment_type" sort={sort} onSort={toggleSort} colIndex={3} width={colWidths["appointment_type"]} onAutoFit={autoFitColumn} />
                    <SortableTh label="Doctor" sortKey="doctor_id" sort={sort} onSort={toggleSort} colIndex={4} width={colWidths["doctor_id"]} onAutoFit={autoFitColumn} />
                    <SortableTh label="Location" sortKey="location" sort={sort} onSort={toggleSort} colIndex={5} width={colWidths["location"]} onAutoFit={autoFitColumn} />
                    <SortableTh label="Reason" sortKey="reason" sort={sort} onSort={toggleSort} colIndex={6} width={colWidths["reason"]} onAutoFit={autoFitColumn} />
                    <SortableTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} colIndex={7} width={colWidths["status"]} onAutoFit={autoFitColumn} />
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="text-center py-6 text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && sortedRows.map((r) => {
                    const typeLabel = APPOINTMENT_TYPES.find((t) => t.value === r.appointment_type)?.label ?? "—";
                    return (
                      <React.Fragment key={r.id}>
                        <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-2 py-3 w-8">
                            <button
                              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={expandedId === r.id ? "Collapse" : "Expand"}
                            >
                              {expandedId === r.id
                                ? <ChevronDown className="size-4" />
                                : <ChevronRight className="size-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{formatInTimezone(r.appointment_datetime, tz)}</td>
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
                            <td className="px-4 py-3 space-x-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                              <Button variant="destructive" size="sm" onClick={() => onDelete(r.id)}>Delete</Button>
                            </td>
                          )}
                        </tr>
                        {expandedId === r.id && (
                          <tr className="bg-muted/20">
                            <td colSpan={isAdmin ? 8 : 7} className="px-4 py-3 text-sm text-muted-foreground">
                              <div className="flex flex-col gap-3">
                                {r.notes && (
                                  <div className="whitespace-pre-wrap">
                                    <span className="font-medium text-foreground mr-2">Notes:</span>{r.notes}
                                  </div>
                                )}
                                <DocumentsPanel section="appointments" recordId={r.id} isAdmin={isAdmin} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {!loading && rows.length === 0 && (
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
      </PageLayout>
      {editingRow && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-appt-heading"
             onKeyDown={(e) => e.key === "Escape" && closeEdit()}
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-appt-heading" className="font-heading text-base font-semibold text-foreground mb-4">Edit Appointment</h2>
            {editError && <p role="alert" className="mb-4 text-sm text-destructive">{editError}</p>}
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Date / Time" htmlFor="edit-appt-datetime">
                  <Input id="edit-appt-datetime" required type="datetime-local" value={editForm.appointment_datetime}
                    onChange={(e) => setEditForm((s) => ({ ...s, appointment_datetime: e.target.value }))} />
                </FormField>
                <FormField label="Appointment Type" htmlFor="edit-appt-type">
                  <Select id="edit-appt-type" value={editForm.appointment_type ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, appointment_type: (e.target.value as AppointmentType) || null }))}>
                    <option value="">Select…</option>
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Doctor" htmlFor="edit-appt-doctor">
                    <DoctorPicker
                      doctorId={editForm.doctor_id ?? null}
                      doctorOther={editForm.doctor_other ?? null}
                      onChange={(id, other) => setEditForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
                    />
                  </FormField>
                </div>
                <FormField label="Location" htmlFor="edit-appt-location">
                  <Input id="edit-appt-location" value={editForm.location ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, location: e.target.value || null }))} />
                </FormField>
                <FormField label="Reason" htmlFor="edit-appt-reason">
                  <Input id="edit-appt-reason" value={editForm.reason ?? ""}
                    onChange={(e) => setEditForm((s) => ({ ...s, reason: e.target.value || null }))} />
                </FormField>
                <FormField label="Status" htmlFor="edit-appt-status">
                  <Select id="edit-appt-status" value={editForm.status ?? "upcoming"}
                    onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value as AppointmentStatus }))}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <FormField label="Notes" htmlFor="edit-appt-notes">
                <Textarea id="edit-appt-notes" value={editForm.notes ?? ""}
                  onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value || null }))} />
              </FormField>
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
