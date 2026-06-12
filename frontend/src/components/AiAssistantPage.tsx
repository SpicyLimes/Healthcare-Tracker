import * as React from "react"
import { Navigate } from "react-router-dom"
import { Menu, Sparkles, ShieldCheck } from "lucide-react"
import { getAiSettings, type AiSettings } from "@/api/settings"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { NavSidebar } from "@/components/nav-sidebar"
import ChatConversation from "./ChatConversation"

/**
 * Dedicated full-screen assistant route (mobile). Uses 100dvh so the pinned
 * input area sits above the on-screen keyboard, and the message list scrolls
 * within the remaining space. Because this route does not use AppShell, it
 * provides its own hamburger that opens the shared NavSidebar so the user can
 * still navigate the rest of the app.
 */
export default function AiAssistantPage() {
  const [settings, setSettings] = React.useState<AiSettings | null | undefined>(undefined)
  const [navOpen, setNavOpen] = React.useState(false)

  React.useEffect(() => {
    getAiSettings()
      .then(setSettings)
      .catch(() => setSettings(null))
  }, [])

  // Still loading settings → render nothing yet
  if (settings === undefined) return null

  // AI disabled (or settings failed to load) → bounce back home
  if (!settings?.enabled) return <Navigate to="/" replace />

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        {/* Hamburger → shared nav sidebar in a left sheet */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <button
            type="button"
            aria-label="Open navigation menu"
            className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <SheetContent side="left" showCloseButton className="w-60 p-0">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <NavSidebar onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Title block */}
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </span>
            AI Assistant
          </h1>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3" />
            Answers come only from your records.
          </p>
        </div>
      </header>

      <ChatConversation showPrivacyNote modelName={settings.model} />
    </div>
  )
}
