import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity, User, Pill, Stethoscope, HeartPulse, Shield, Building2, Users,
  Scissors, Hospital, Eye, Smile, Syringe, ClipboardList, Bell,
  FolderOpen, KeyRound, Share2, ScrollText, UserCog, LogOut, DatabaseBackup,
  LayoutDashboard, Calendar, CheckCircle2, Database, StickyNote, Salad, Bot, Inbox,
} from "lucide-react";
import { pendingSubmissionCount, myPendingCount } from "@/api/submissions";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/auth/useAuth";
import { fetchHealth, type HealthStatus } from "@/api/health";

const toolsGroup = {
  label: "Tools",
  items: [
    { to: "/calendar", label: "Calendar", icon: Calendar },
    { to: "/notes", label: "Notes / To-Do's", icon: StickyNote },
  ],
};

const navGroups = [
  {
    label: "Records",
    items: [
      { to: "/profile", label: "Profile", icon: User },
      { to: "/medications", label: "Medications", icon: Pill },
      { to: "/doctors", label: "Doctors", icon: Stethoscope },
      { to: "/ailments", label: "Ailment History", icon: HeartPulse },
    ],
  },
  {
    label: "Coverage",
    items: [
      { to: "/insurance", label: "Insurance", icon: Shield },
      { to: "/pharmacies", label: "Pharmacies", icon: Building2 },
    ],
  },
  {
    label: "History",
    items: [
      { to: "/family-history", label: "Family History", icon: Users },
      { to: "/procedures", label: "Procedures", icon: Scissors },
      { to: "/hospitalizations", label: "Hospitalizations", icon: Hospital },
      { to: "/vision-history", label: "Vision History", icon: Eye },
      { to: "/dental-history", label: "Dental History", icon: Smile },
      { to: "/vaccinations", label: "Vaccinations", icon: Syringe },
    ],
  },
  {
    label: "Activity",
    items: [
      { to: "/doc-logs", label: "Visit & Call Logs", icon: ClipboardList },
      { to: "/vitals", label: "Vitals", icon: Activity },
      { to: "/nutrition-plan", label: "Nutrition Plan", icon: Salad },
      { to: "/documents", label: "Documents", icon: FolderOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/change-password", label: "Settings", icon: KeyRound },
    ],
  },
];

const adminItems = [
  { to: "/submissions", label: "Submissions", icon: Inbox },
  { to: "/reminders", label: "Daily Reminders", icon: Bell },
  { to: "/share-links", label: "Share Links", icon: Share2 },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText },
  { to: "/users", label: "Manage Users", icon: UserCog },
  { to: "/settings", label: "AI Settings", icon: Bot },
  { to: "/backups", label: "Backups", icon: DatabaseBackup },
];

interface NavSidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavSidebar({ collapsed = false, onNavigate }: NavSidebarProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContributor = user?.role === "contributor";
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  // Admins see how many submissions await review; contributors see how many of
  // their own are still waiting. myPendingCount() was built for this and had
  // zero production callers, so a contributor had no way to tell whether a
  // proposal from Tuesday had been acted on.
  useEffect(() => {
    if (!isAdmin && !isContributor) return;
    const fetchCount = isAdmin ? pendingSubmissionCount : myPendingCount;
    const load = () => fetchCount().then(setPendingCount).catch(() => setPendingCount(0));
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [isAdmin, isContributor]);

  const navLink = (
    to: string,
    label: string,
    Icon: React.ElementType,
    active: boolean
  ) => {
    const linkClass = cn(
      "flex items-center rounded-lg text-sm transition-colors",
      collapsed ? "size-9 justify-center" : "gap-2.5 px-2 py-1.5",
      active
        ? "bg-primary/15 text-primary font-medium"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:ring-1 hover:ring-[var(--nav-hover-ring)]"
    );

    const inner = (
      <Link to={to} onClick={onNavigate} className={linkClass}>
        <Icon className="size-4 shrink-0" />
        {!collapsed && label}
      </Link>
    );

    if (!collapsed) return inner;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  // Same nav link with a pending-count badge. Shared so the admin queue and the
  // contributor's own queue cannot drift apart visually.
  const navLinkWithCount = (
    to: string,
    label: string,
    Icon: React.ElementType,
    active: boolean,
    count: number
  ) => {
    if (count <= 0) return navLink(to, label, Icon, active);
    return (
      <div className="relative">
        {navLink(to, label, Icon, active)}
        <span
          className={cn(
            "absolute rounded-full bg-primary font-bold text-primary-foreground text-[0.6rem]",
            collapsed
              ? "-right-1 -top-1 px-1"
              : "right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5"
          )}
        >
          {count}
        </span>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="flex h-full flex-col overflow-y-auto py-4">
        <Link
          to="/"
          onClick={onNavigate}
          className={cn(
            "flex items-center transition-opacity hover:opacity-80",
            collapsed ? "justify-center px-0 pb-5" : "gap-2.5 px-4 pb-2"
          )}
        >
          <img src="/logo.png" alt="HealthCare Tracker" className="size-10 shrink-0 rounded-lg" />
          {!collapsed && (
            <span className="text-[1.0rem] font-semibold text-foreground">
              HealthCare Tracker
            </span>
          )}
        </Link>
        {!collapsed && (() => {
          const tz = user?.timezone ?? "America/Chicago";
          const now = new Date();
          const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(now);
          const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: tz }).format(now);
          const day = parseInt(new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz }).format(now), 10);
          const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: tz }).format(now);
          const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th"
            : day % 10 === 1 ? "st"
            : day % 10 === 2 ? "nd"
            : day % 10 === 3 ? "rd" : "th";
          return (
            <div className="mt-3 px-4 pb-3 flex flex-col items-center">
              <div className="border-t border-sidebar-border mb-2" style={{ width: "75%" }} />
              <p className="text-[0.7rem] font-bold text-sidebar-foreground/80 tracking-wide text-center">
                {weekday} | {month} {day}{suffix}, {year}
              </p>
              <div className="border-t border-sidebar-border mt-2" style={{ width: "75%" }} />
            </div>
          );
        })()}

        <div className={cn("flex flex-1 flex-col gap-5", collapsed ? "items-center px-0" : "px-3")}>
          <ul className={cn("list-none flex flex-col gap-0.5", collapsed && "items-center")}>
            <li>{navLink("/", "Dashboard", LayoutDashboard, pathname === "/")}</li>
          </ul>

          <div key={toolsGroup.label} className={cn(collapsed && "flex flex-col items-center")}>
            {!collapsed && (
              <p className="mb-1 px-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {toolsGroup.label}
              </p>
            )}
            {collapsed && <Separator className="mb-2 w-6" />}
            <ul className={cn("list-none flex flex-col gap-0.5", collapsed && "items-center")}>
              {toolsGroup.items.map((item) => (
                <li key={item.to}>{navLink(item.to, item.label, item.icon, pathname === item.to)}</li>
              ))}
            </ul>
          </div>

          {navGroups.map((group) => (
            <div key={group.label} className={cn(collapsed && "flex flex-col items-center")}>
              {!collapsed && (
                <p className="mb-1 px-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              {collapsed && <Separator className="mb-2 w-6" />}
              <ul className={cn("list-none flex flex-col gap-0.5", collapsed && "items-center")}>
                {group.items.map((item) => (
                  <li key={item.to}>{navLink(item.to, item.label, item.icon, pathname === item.to)}</li>
                ))}
                {group.label === "Account" && isContributor && (
                  <li>
                    {navLinkWithCount(
                      "/my-submissions", "My Submissions", Inbox,
                      pathname === "/my-submissions", pendingCount
                    )}
                  </li>
                )}
              </ul>
            </div>
          ))}

          {isAdmin && (
            <div className={cn(collapsed && "flex flex-col items-center")}>
              <Separator className="mb-4" />
              {!collapsed && (
                <p className="mb-1 px-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </p>
              )}
              <ul className={cn("list-none flex flex-col gap-0.5", collapsed && "items-center")}>
                {adminItems.map((item) => (
                  <li key={item.to}>
                    {item.to === "/submissions"
                      ? navLinkWithCount(item.to, item.label, item.icon, pathname === item.to, pendingCount)
                      : navLink(item.to, item.label, item.icon, pathname === item.to)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto pb-2">
            {!collapsed && user && (
              <div
                className="mb-1 px-2 py-1 text-xs text-muted-foreground truncate"
                title={user.full_name || user.email}
              >
                {user.full_name || user.email}
              </div>
            )}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={logout}
                    className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="size-4 shrink-0" />
                    <span className="sr-only">Log out</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Log out</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4 shrink-0" />
                Log out
              </button>
            )}

            {/* Backend / DB status */}
            {!collapsed && health && (
              <div className="mt-3 border-t border-border pt-3 px-2 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                  <CheckCircle2 className="size-3 shrink-0 text-primary" />
                  <span>Backend: {health.status.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                  <Database className="size-3 shrink-0 text-primary" />
                  <span>DB: {health.database.charAt(0).toUpperCase() + health.database.slice(1)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
}
