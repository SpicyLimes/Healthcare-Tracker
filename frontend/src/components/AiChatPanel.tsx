import * as React from "react"
import { UNSAFE_NavigationContext, useInRouterContext } from "react-router-dom"
import { MessageCircle, Sparkles, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { getAiSettings } from "@/api/settings"
import ChatConversation from "./ChatConversation"

/**
 * Like useNavigate, but safe to call when there is no surrounding Router (e.g.
 * the existing AiChatPanel unit tests render the panel without a router). The
 * underlying NavigationContext is always available and never throws; we read
 * its navigator directly and fall back to a no-op when one isn't present.
 */
function useSafeNavigate() {
  const inRouter = useInRouterContext()
  const ctx = React.useContext(UNSAFE_NavigationContext)
  const navigator = ctx?.navigator
  return React.useCallback(
    (to: string) => {
      if (inRouter && navigator) navigator.push(to)
    },
    [inRouter, navigator]
  )
}

export default function AiChatPanel() {
  const [enabled, setEnabled] = React.useState<boolean | null>(null)
  const [open, setOpen] = React.useState(false)
  const navigate = useSafeNavigate()

  // Load settings on mount
  React.useEffect(() => {
    getAiSettings()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false))
  }, [])

  // Not yet loaded, or disabled → render nothing
  if (!enabled) return null

  function openAssistant() {
    // On small screens, navigate to the dedicated full-screen page so the input
    // pins above the on-screen keyboard. On desktop (or where matchMedia is
    // unavailable, e.g. jsdom in tests), open the right-side Sheet.
    const mql =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 639px)")
        : null
    if (mql && mql.matches) {
      navigate("/assistant")
    } else {
      setOpen(true)
    }
  }

  return (
    <>
      {/* Floating launcher button */}
      <Button
        variant="default"
        size="lg"
        aria-label="AI assistant"
        className="fixed bottom-6 right-6 z-40 gap-2 rounded-full shadow-lg ring-1 ring-primary/20 transition-transform hover:-translate-y-0.5"
        onClick={openAssistant}
      >
        <MessageCircle className="size-4" />
        Assistant
      </Button>

      {/* Chat panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="size-3.5" />
              </span>
              AI Assistant
            </SheetTitle>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3" />
              Answers come only from your records, on your local network.
            </p>
          </SheetHeader>

          <ChatConversation />
        </SheetContent>
      </Sheet>
    </>
  )
}
