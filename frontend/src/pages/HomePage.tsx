import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StickyNote } from "lucide-react";
import { calendarApi, type CalendarEvent, EVENT_TYPE_LABELS } from "../api/calendar";
import { useAuth } from "../auth/useAuth";
import { formatInTimezone } from "@/lib/datetime";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatEventTime(e: CalendarEvent, tz: string): string {
  if (e.type === "appointment" && e.time) {
    // e.time is "HH:MM" in UTC; reconstruct a full ISO string using e.date
    return formatInTimezone(`${e.date}T${e.time}:00Z`, tz);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(e.date + "T00:00:00Z")
  );
}

function getGreeting(tz: string): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()),
    10
  );
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function HomePage() {
  const { user } = useAuth();
  const tz = user?.timezone ?? "America/Chicago";
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    calendarApi
      .list()
      .then((events) => {
        const upcoming = events
          .filter((e) => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5);
        setUpcomingEvents(upcoming);
      })
      .catch(() => {});
  }, []);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-semibold text-foreground text-balance">
            {getGreeting(tz)}, {user?.full_name || user?.email}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Your personal health records are organized and ready to access. Use the sidebar to navigate.
          </p>
        </div>

        {/* Viewer notice */}
        {user?.role !== "admin" && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
            <StickyNote className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Have a note, correction, or comment?
              </p>
              <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-200">
                Use the{" "}
                <Link to="/notes" className="font-medium underline underline-offset-2 hover:opacity-80">
                  Notes / To-Do's
                </Link>{" "}
                page to add personal notes, flag corrections, or track follow-up items. To search, please use the 'AI Assistant' located in the bottom right corner of your screen.
              </p>
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="mb-8">
            <div className="mb-3">
              <h2 className="font-heading text-sm font-semibold text-foreground">Upcoming Events</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your next scheduled health events.</p>
            </div>
            <Card>
              <CardContent className="py-2 px-4 divide-y divide-border">
                {upcomingEvents.map((e) => (
                  <div key={`${e.type}-${e.id}`} className="flex items-center gap-3 py-2">
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="w-32 shrink-0 text-xs text-muted-foreground">
                      {formatEventTime(e, tz)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm text-foreground">{e.title}</span>
                      {e.type === "appointment" && e.doctor_name && (
                        <span className="block truncate text-xs text-muted-foreground">{e.doctor_name}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {EVENT_TYPE_LABELS[e.type]}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </AppShell>
  );
}
