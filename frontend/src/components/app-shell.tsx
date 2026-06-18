import * as React from "react"
import { Menu, Sun, Moon, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useInRouterContext } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { NavSidebar } from "@/components/nav-sidebar"
import { useTheme } from "@/components/theme-provider"
import { AccentPicker } from "@/components/accent-picker"
import { AuthContext } from "@/auth/AuthContext"
import SummaryBuilder from "@/components/SummaryBuilder"
import AiChatPanel from "@/components/AiChatPanel"

const ALL_SECTIONS = [
  "doctors", "appointments", "medications", "ailments", "surgeries",
  "hospitalizations", "vaccinations", "vision_history", "dental_history",
  "visit_logs", "vitals", "insurances", "pharmacies", "family_history",
  "nutrition_plan", "profile",
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const auth = React.useContext(AuthContext)
  const user = auth?.user
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const inRouter = useInRouterContext()

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Desktop sidebar */}
      {inRouter && (
        <aside
          className={`hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:flex lg:flex-col ${
            collapsed ? "w-14" : "w-60"
          }`}
        >
          <NavSidebar collapsed={collapsed} />
        </aside>
      )}

      {/* Mobile drawer */}
      {inRouter && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" showCloseButton className="w-60 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <NavSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4">
          {/* Mobile menu trigger */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 lg:h-8 lg:w-8 lg:hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
            <span className="sr-only">Open menu</span>
          </Button>

          {/* Desktop collapse toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </Button>

          {/* User info */}
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
            <span className="hidden sm:inline">{user?.full_name || user?.email}</span>
            {user?.role === "admin" && (
              <Badge variant="secondary" className="hidden sm:inline-flex">Admin</Badge>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Summary trigger (admin + viewer) */}
          {user && (
            <SummaryBuilder mode="admin" availableSections={ALL_SECTIONS} />
          )}

          {/* Accent color picker */}
          <AccentPicker isDark={theme === "dark"} />

          {/* Theme toggle */}
          <Button variant="ghost" size="icon-sm" className="h-9 w-9 lg:h-8 lg:w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={toggleTheme}>
            {theme === "dark" ? <Sun /> : <Moon />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Floating AI chat panel — available to all authenticated users */}
        {user && <AiChatPanel />}

        {/* Footer */}
        <footer className="shrink-0 border-t border-sidebar-border bg-sidebar px-6 py-3">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-0.5 text-center text-[0.7rem] text-sidebar-foreground/60">
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
              <span>© {new Date().getFullYear()}</span>
              <a href="https://spicylimes.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-sidebar-foreground transition-colors">
                <img src="/spicylimes.png" alt="SpicyLimes.io" className="size-4" />
                SpicyLimes.io
              </a>
              <span>· All Rights Reserved ·</span>
              <a
                href="https://github.com/SpicyLimes/Healthcare-Tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-sidebar-foreground transition-colors"
              >
                <img src="/github.svg" alt="" className="size-4" />
                <span>GitHub ↗</span>
              </a>
            </div>
            <p className="italic">For Personal Health Record Keeping ONLY - Not a substitute for Professional Medical Advice</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
