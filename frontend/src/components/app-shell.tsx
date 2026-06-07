import * as React from "react"
import { Menu, Sun, Moon, CheckCircle2, Database, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useInRouterContext } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { NavSidebar } from "@/components/nav-sidebar"
import { useTheme } from "@/components/theme-provider"
import { AccentPicker } from "@/components/accent-picker"
import { AuthContext } from "@/auth/AuthContext"

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
          className={`hidden shrink-0 border-r border-border bg-sidebar transition-all duration-200 lg:flex lg:flex-col ${
            collapsed ? "w-14" : "w-60"
          }`}
        >
          <NavSidebar collapsed={collapsed} />
        </aside>
      )}

      {/* Mobile drawer */}
      {inRouter && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" showCloseButton className="w-60 p-0">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <NavSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          {/* Mobile menu trigger */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
            <span className="sr-only">Open menu</span>
          </Button>

          {/* Desktop collapse toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:flex"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </Button>

          {/* Status badges */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{user?.full_name || user?.email}</span>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {user?.role}
            </Badge>
            <div className="hidden items-center gap-1 sm:flex">
              <CheckCircle2 className="size-3 text-primary" />
              <span>Backend: ok</span>
            </div>
            <div className="hidden items-center gap-1 sm:flex">
              <Database className="size-3 text-primary" />
              <span>DB: connected</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Accent color picker */}
          <AccentPicker isDark={theme === "dark"} />

          {/* Theme toggle */}
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme}>
            {theme === "dark" ? <Sun /> : <Moon />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
