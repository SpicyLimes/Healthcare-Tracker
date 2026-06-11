import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  User, Pill, Stethoscope, HeartPulse, Shield, Building2, Users,
  Scissors, Hospital, Eye, Smile, Syringe, ClipboardList,
  FolderOpen, KeyRound, Share2, ScrollText, UserCog, LogOut,
  LayoutDashboard, Calendar, CheckCircle2, Database, StickyNote, Salad, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/auth/useAuth";
import { fetchHealth, type HealthStatus } from "@/api/health";

const calendarGroup = {
  label: "Calendar",
  items: [
    { to: "/calendar", label: "Calendar", icon: Calendar },
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
      { to: "/surgeries", label: "Surgeries", icon: Scissors },
      { to: "/hospitalizations", label: "Hospitalizations", icon: Hospital },
      { to: "/vision-history", label: "Vision History", icon: Eye },
      { to: "/dental-history", label: "Dental History", icon: Smile },
      { to: "/vaccinations", label: "Vaccinations", icon: Syringe },
    ],
  },
  {
    label: "Activity",
    items: [
      { to: "/visit-logs", label: "Visit Logs", icon: ClipboardList },
      { to: "/nutrition-plan", label: "Nutrition Plan", icon: Salad },
      { to: "/documents", label: "Documents", icon: FolderOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/change-password", label: "Settings", icon: KeyRound },
      { to: "/share-links", label: "Share Links", icon: Share2 },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/notes", label: "Notes / To-Do's", icon: StickyNote },
    ],
  },
];

const adminItems = [
  { to: "/audit-log", label: "Audit Log", icon: ScrollText },
  { to: "/users", label: "Manage Users", icon: UserCog },
  { to: "/settings", label: "AI Settings", icon: Bot },
];

interface NavSidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavSidebar({ collapsed = false, onNavigate }: NavSidebarProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

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
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
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

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="flex h-full flex-col overflow-y-auto py-4">
        <Link
          to="/"
          onClick={onNavigate}
          className={cn(
            "flex items-center pb-5 transition-opacity hover:opacity-80",
            collapsed ? "justify-center px-0" : "gap-2.5 px-4"
          )}
        >
          <img src="/logo.png" alt="Healthcare Tracker" className="size-10 shrink-0 rounded-lg" />
          {!collapsed && (
            <span className="text-[1.0rem] font-semibold text-foreground">
              Healthcare Tracker
            </span>
          )}
        </Link>

        <div className={cn("flex flex-1 flex-col gap-5", collapsed ? "items-center px-0" : "px-3")}>
          <ul className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
            <li>{navLink("/", "Dashboard", LayoutDashboard, pathname === "/")}</li>
          </ul>

          <div key={calendarGroup.label} className={cn(collapsed && "flex flex-col items-center")}>
            {!collapsed && (
              <p className="mb-1 px-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {calendarGroup.label}
              </p>
            )}
            {collapsed && <Separator className="mb-2 w-6" />}
            <ul className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
              {calendarGroup.items.map((item) => (
                <li key={item.label}>{navLink(item.to, item.label, item.icon, pathname === item.to)}</li>
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
              <ul className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
                {group.items.map((item) => (
                  <li key={item.to}>{navLink(item.to, item.label, item.icon, pathname === item.to)}</li>
                ))}
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
              <ul className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
                {adminItems.map((item) => (
                  <li key={item.to}>{navLink(item.to, item.label, item.icon, pathname === item.to)}</li>
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
