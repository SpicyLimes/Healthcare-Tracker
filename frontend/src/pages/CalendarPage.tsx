// frontend/src/pages/CalendarPage.tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarApi, type CalendarEvent, type CalendarEventType, EVENT_TYPE_LABELS } from "../api/calendar";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import { RecordTable } from "@/components/RecordTable";
import { RecordFormModal } from "@/components/RecordFormModal";
import { localToUtcIso, formatInTimezone } from "@/lib/datetime";

// ─── Event routing ───────────────────────────────────────────────────────────

const EVENT_ROUTES: Partial<Record<CalendarEventType, string>> = {
  visit_log: "/visit-logs",
  surgery: "/surgeries",
  hospitalization: "/hospitalizations",
  vaccination: "/vaccinations",
  medication: "/medications",
};

// ─── Appointment helpers ─────────────────────────────────────────────────────

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

// ─── Calendar helpers ────────────────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function groupByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    (map[e.date] ??= []).push(e);
  }
  return map;
}

// Multi-day events (hospitalizations, medications) are grouped by start date only.
function groupByMonth(events: CalendarEvent[]): { label: string; events: CalendarEvent[] }[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = e.date.slice(0, 7); // YYYY-MM
    (map.get(key) ?? map.set(key, []).get(key)!).push(e);
  }
  return Array.from(map.entries()).map(([key, evs]) => {
    const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${key}-01`)
    );
    return { label, events: evs };
  });
}

// ─── Month Grid ──────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

interface DayCellProps {
  dateStr: string;
  events: CalendarEvent[];
  isToday: boolean;
  isCurrentMonth: boolean;
  onEventClick: (e: CalendarEvent) => void;
}

function DayCell({ dateStr, events, isToday, isCurrentMonth, onEventClick }: DayCellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const day = Number(dateStr.slice(8));
  const visible = events.slice(0, MAX_CHIPS);
  const overflow = events.length - MAX_CHIPS;

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div
      className={cn(
        "relative min-h-[80px] border-b border-r border-border p-1 text-xs",
        !isCurrentMonth && "bg-muted/30"
      )}
      ref={ref}
    >
      <span
        className={cn(
          "mb-0.5 flex size-5 items-center justify-center rounded-full font-medium",
          isToday
            ? "bg-primary text-primary-foreground"
            : isCurrentMonth
            ? "text-foreground"
            : "text-muted-foreground"
        )}
      >
        {day}
      </span>

      <div className="flex flex-col gap-0.5">
        {visible.map((e) => (
          <button
            key={`${e.type}-${e.id}`}
            onClick={() => onEventClick(e)}
            className="w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white hover:opacity-80 transition-opacity"
            style={{ backgroundColor: e.color }}
            title={e.title}
          >
            {e.title}
          </button>
        ))}
        {overflow > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-left text-[10px] text-primary hover:underline"
            aria-label={`+${overflow} more events`}
          >
            +{overflow} more
          </button>
        )}
      </div>

      {open && events.length > MAX_CHIPS && (
        <div className="absolute left-0 top-full z-50 w-48 rounded-lg border border-border bg-popover p-2 shadow-lg">
          <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
            {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
              new Date(dateStr + "T00:00:00Z")
            )}
          </p>
          {events.map((e) => (
            <div key={`${e.type}-${e.id}`} className="flex items-center gap-1.5 py-0.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
              <span className="truncate text-[11px] text-foreground">{e.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MonthGridProps {
  events: CalendarEvent[];
  year: number;
  month: number;
  onEventClick: (e: CalendarEvent) => void;
}

function MonthGrid({ events, year, month, onEventClick }: MonthGridProps) {
  const byDate = groupByDate(events);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const today = isoToday();

  const cells: Array<{ dateStr: string } | null> = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: isoDate(year, month, d) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-2 text-center text-[11px] font-semibold uppercase text-muted-foreground">
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) =>
          cell ? (
            <DayCell
              key={cell.dateStr}
              dateStr={cell.dateStr}
              events={byDate[cell.dateStr] ?? []}
              isToday={cell.dateStr === today}
              isCurrentMonth
              onEventClick={onEventClick}
            />
          ) : (
            <div key={`blank-${i}`} className="min-h-[80px] border-b border-r border-border bg-muted/30" />
          )
        )}
      </div>
    </div>
  );
}

// ─── Agenda List ─────────────────────────────────────────────────────────────

interface AgendaListProps {
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}

function AgendaList({ events, onEventClick }: AgendaListProps) {
  if (events.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">No events to show</div>
    );
  }

  const today = isoToday();
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const groups = groupByMonth(sorted).reverse();

  const formatAgendaDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(iso + "T00:00:00Z")
    );

  const renderRow = (e: CalendarEvent) => (
    <div
      key={`${e.type}-${e.id}`}
      data-testid="agenda-row"
      onClick={() => onEventClick(e)}
      className="flex cursor-pointer items-center gap-3 py-2 hover:bg-muted/40 rounded transition-colors"
    >
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: e.color }} />
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{formatAgendaDate(e.date)}</span>
      <span className="flex-1 truncate text-sm text-foreground">{e.title}</span>
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {EVENT_TYPE_LABELS[e.type]}
      </Badge>
    </div>
  );

  return (
    <div className="rounded-lg border border-border divide-y divide-border">
      {groups.map(({ label, events: groupEvents }) => {
        const past = groupEvents.filter((e) => e.date < today);
        const future = groupEvents.filter((e) => e.date >= today);
        const hasTodayDivider = past.length > 0 && future.length > 0;
        return (
          <div key={label}>
            <div className="bg-muted/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="px-4">
              {past.map(renderRow)}
              {hasTodayDivider && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-primary/30" />
                  <span className="text-[10px] font-semibold text-primary">Today</span>
                  <div className="h-px flex-1 bg-primary/30" />
                </div>
              )}
              {future.map(renderRow)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Appointments Section ────────────────────────────────────────────────────

interface AppointmentsSectionProps {
  tz: string;
  isAdmin: boolean;
  onRegisterOpenById?: (fn: (id: string) => void) => void;
}

function AppointmentsSection({ tz, isAdmin, onRegisterOpenById }: AppointmentsSectionProps) {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState<Appointment | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<AppointmentInput>(EMPTY);
  const [modalError, setModalError] = useState("");

  async function reload() { setRows(await appointmentsApi.list()); }
  useEffect(() => {
    setLoading(true);
    reload().catch(() => setError("Failed to load appointments")).finally(() => setLoading(false));
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  useEffect(() => {
    onRegisterOpenById?.((id: string) => {
      const r = rows.find((row) => row.id === id);
      if (r) openEdit(r);
    });
  }, [rows, onRegisterOpenById]);

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

  function closeModal() {
    setModalMode(null);
    setEditingRow(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    try {
      const payload = { ...form, appointment_datetime: localToUtcIso(form.appointment_datetime, tz) };
      if (modalMode === "edit" && editingRow) {
        await appointmentsApi.update(editingRow.id, payload);
      } else {
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

  return (
    <>
      {isAdmin && (
        <div className="mb-3 flex justify-end">
          <Button onClick={openAdd}>+ Add</Button>
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          <RecordTable
            rows={rows.filter((r) => r.status !== "completed")}
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
            getHeadline={(r) => appointmentTypeLabel(r.appointment_type) || "Appointment"}
            getSubtitle={(r) => formatInTimezone(r.appointment_datetime, tz)}
            getBadge={(r) => ({ label: r.status, variant: STATUS_VARIANT[r.status] })}
            onEdit={(r) => openEdit(r)}
            onDelete={(r) => onDelete(r.id)}
            emptyMessage="No appointment records yet."
          />
        </CardContent>
      </Card>

      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

      {modalMode && (
        <RecordFormModal
          title={modalMode === "edit" ? "Edit Appointment" : "Add Appointment"}
          submitLabel={modalMode === "edit" ? "Save" : "Add Appointment"}
          error={modalError || null}
          onClose={closeModal}
          onSubmit={onSubmit}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Date / Time" htmlFor="appointment_datetime">
              <Input
                id="appointment_datetime"
                required
                type="datetime-local"
                value={form.appointment_datetime}
                onChange={(e) => setForm((s) => ({ ...s, appointment_datetime: e.target.value }))}
              />
            </FormField>

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

            <div className="sm:col-span-2">
              <FormField label="Doctor" htmlFor="appt-doctor">
                <DoctorPicker
                  doctorId={form.doctor_id ?? null}
                  doctorOther={form.doctor_other ?? null}
                  onChange={(id, other) => setForm((s) => ({ ...s, doctor_id: id, doctor_other: other }))}
                />
              </FormField>
            </div>

            <FormField label="Location" htmlFor="location">
              <Input
                id="location"
                value={form.location ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, location: e.target.value || null }))}
                placeholder="e.g. Main Street Clinic"
              />
            </FormField>

            <FormField label="Reason" htmlFor="reason">
              <Input
                id="reason"
                value={form.reason ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value || null }))}
                placeholder="e.g. Annual physical"
              />
            </FormField>

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
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = "month" | "agenda";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPage() {
  const { user } = useAuth();
  const tz = user?.timezone ?? "America/Chicago";
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const openApptById = useRef<((id: string) => void) | null>(null);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("month");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    calendarApi
      .list()
      .then(setEvents)
      .catch(() => setError("Failed to load calendar events"))
      .finally(() => setLoading(false));
  }, []);

  function handleEventClick(e: CalendarEvent) {
    if (e.type === "appointment") {
      openApptById.current?.(e.id);
      return;
    }
    const route = EVENT_ROUTES[e.type];
    if (route) navigate(`${route}?open=${e.id}`);
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((e) => e.date.startsWith(monthPrefix));

  return (
    <AppShell>
      <PageLayout
        title="Calendar"
        description="A unified view of all time-based health records."
        action={
          <div className="hidden md:flex">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setView("month")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "month"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Month
              </button>
              <button
                onClick={() => setView("agenda")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "agenda"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Agenda
              </button>
            </div>
          </div>
        }
      >
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {/* Appointments — above calendar */}
        {!loading && (
          <>
            <div className="mb-3">
              <h2 className="font-heading text-base font-semibold text-foreground">Appointments</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Manage upcoming and past healthcare appointments.</p>
            </div>
            <AppointmentsSection
              tz={tz}
              isAdmin={isAdmin}
              onRegisterOpenById={(fn) => { openApptById.current = fn; }}
            />
          </>
        )}

        <div className="mt-8">
          {/* Mobile: always show mobile nav + AgendaList */}
          {!loading && !error && (
            <div className="md:hidden">
              <Card>
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={prevMonth}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="text-sm font-semibold text-foreground">
                      {MONTH_NAMES[month]} {year}
                    </span>
                    <button
                      onClick={nextMonth}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
              <Card className="mt-4">
                <CardContent className="p-0 max-h-[420px] overflow-y-auto">
                  <AgendaList events={events} onEventClick={handleEventClick} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Desktop: show month grid or agenda based on view toggle */}
          {!loading && !error && view === "month" && (
            <div className="hidden md:block">
              <Card>
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={prevMonth}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="text-sm font-semibold text-foreground">
                      {MONTH_NAMES[month]} {year}
                    </span>
                    <button
                      onClick={nextMonth}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                  <MonthGrid events={monthEvents} year={year} month={month} onEventClick={handleEventClick} />
                </CardContent>
              </Card>
            </div>
          )}

          {!loading && !error && view === "agenda" && (
            <div className="hidden md:block">
              <Card>
                <CardContent className="p-0">
                  <AgendaList events={events} onEventClick={handleEventClick} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </PageLayout>
    </AppShell>
  );
}
