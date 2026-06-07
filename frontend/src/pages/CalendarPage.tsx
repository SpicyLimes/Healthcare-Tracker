// frontend/src/pages/CalendarPage.tsx
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarApi, type CalendarEvent, EVENT_TYPE_LABELS } from "../api/calendar";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

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

// Multi-day events (hospitalizations, medications) are grouped by start date only;
// they won't appear in the month that contains their end date.
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
}

function DayCell({ dateStr, events, isToday, isCurrentMonth }: DayCellProps) {
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
          <div
            key={`${e.type}-${e.id}`}
            className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: e.color }}
            title={e.title}
          >
            {e.title}
          </div>
        ))}
        {overflow > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-left text-[10px] text-primary hover:underline"
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
}

function MonthGrid({ events, year, month }: MonthGridProps) {
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
}

function AgendaList({ events }: AgendaListProps) {
  if (events.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">No events to show</div>
    );
  }

  const today = isoToday();
  const groups = groupByMonth(events);

  const formatAgendaDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(iso + "T00:00:00Z")
    );

  const renderRow = (e: CalendarEvent) => (
    <div key={`${e.type}-${e.id}`} className="flex items-center gap-3 py-2">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = "month" | "agenda";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPage() {
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
        }
      >
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {!loading && !error && view === "month" && (
          <>
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
            <MonthGrid events={monthEvents} year={year} month={month} />
          </>
        )}

        {!loading && !error && view === "agenda" && <AgendaList events={events} />}
      </PageLayout>
    </AppShell>
  );
}
