import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Pill,
  Stethoscope,
  HeartPulse,
  Shield,
  Building2,
  Users,
  Scissors,
  Hospital,
  Eye,
  Smile,
  Syringe,
  ClipboardList,
  CalendarDays,
  FolderOpen,
  KeyRound,
  Share2,
  ScrollText,
  UserCog,
  ChevronRight,
} from "lucide-react";
import { fetchHealth, type HealthStatus } from "../api/health";
import { calendarApi, type CalendarEvent, EVENT_TYPE_LABELS } from "../api/calendar";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const NON_ADMIN_SECTIONS = [
  {
    group: "Records",
    description: "Your personal health profile and care providers.",
    items: [
      { to: "/profile", label: "Profile", icon: User, desc: "Personal info & demographics" },
      { to: "/medications", label: "Medications", icon: Pill, desc: "Current & past medications" },
      { to: "/doctors", label: "Doctors", icon: Stethoscope, desc: "Physicians & specialists" },
      { to: "/ailments", label: "Ailment History", icon: HeartPulse, desc: "Diagnoses & conditions" },
    ],
  },
  {
    group: "Coverage",
    description: "Insurance plans and pharmacy contacts.",
    items: [
      { to: "/insurance", label: "Insurance", icon: Shield, desc: "Health insurance policies" },
      { to: "/pharmacies", label: "Pharmacies", icon: Building2, desc: "Preferred pharmacies" },
    ],
  },
  {
    group: "History",
    description: "Medical events and hereditary health information.",
    items: [
      { to: "/family-history", label: "Family History", icon: Users, desc: "Hereditary conditions" },
      { to: "/surgeries", label: "Surgeries", icon: Scissors, desc: "Surgical procedures" },
      { to: "/hospitalizations", label: "Hospitalizations", icon: Hospital, desc: "Hospital stays" },
      { to: "/vision-history", label: "Vision History", icon: Eye, desc: "Eye exams & prescriptions" },
      { to: "/dental-history", label: "Dental History", icon: Smile, desc: "Dental records" },
      { to: "/vaccinations", label: "Vaccinations", icon: Syringe, desc: "Immunization records" },
    ],
  },
  {
    group: "Activity",
    description: "Doctor visits, upcoming appointments, and stored documents.",
    items: [
      { to: "/visit-logs", label: "Visit Logs", icon: ClipboardList, desc: "Provider visit notes" },
      { to: "/appointments", label: "Appointments", icon: CalendarDays, desc: "Scheduled appointments" },
      { to: "/documents", label: "Documents", icon: FolderOpen, desc: "Medical documents & files" },
    ],
  },
  {
    group: "Account",
    description: "Security settings and sharing preferences.",
    items: [
      { to: "/change-password", label: "Change Password", icon: KeyRound, desc: "Update your password" },
      { to: "/share-links", label: "Share Links", icon: Share2, desc: "Share records with providers" },
    ],
  },
];

const ADMIN_SECTION = {
  group: "Admin",
  description: "System administration and user management.",
  items: [
    { to: "/audit-log", label: "Audit Log", icon: ScrollText, desc: "System activity log" },
    { to: "/users", label: "Manage Users", icon: UserCog, desc: "User accounts & roles" },
  ],
};

export default function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
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

  const sections =
    user?.role === "admin"
      ? [...NON_ADMIN_SECTIONS, ADMIN_SECTION]
      : NON_ADMIN_SECTIONS;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-semibold text-foreground text-balance">
            Welcome back, {user?.full_name || user?.email}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Your personal health records are organized and ready to access. Use the sections below or the sidebar to navigate.
          </p>
          {health && (
            <p className="mt-1 text-xs text-muted-foreground">
              Backend: {health.status} — Database: {health.database}
            </p>
          )}
        </div>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="mb-2">
            <div className="mb-3">
              <h2 className="font-heading text-sm font-semibold text-foreground">Upcoming Events</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your next scheduled health events.</p>
            </div>
            <Card>
              <CardContent className="py-2 px-4 divide-y divide-border">
                {upcomingEvents.map((e) => (
                  <div key={`${e.type}-${e.id}`} className="flex items-center gap-3 py-2">
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
                        new Date(e.date + "T00:00:00Z")
                      )}
                    </span>
                    <span className="flex-1 truncate text-sm text-foreground">{e.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {EVENT_TYPE_LABELS[e.type]}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Section grid */}
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.group}>
              <div className="mb-3">
                <h2 className="font-heading text-sm font-semibold text-foreground">
                  {section.group}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {section.description}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} className="group">
                      <Card className="transition-all duration-150 hover:ring-primary/40 hover:ring-2 cursor-pointer">
                        <CardContent className="flex items-center gap-3 py-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="size-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.label}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.desc}
                            </p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
