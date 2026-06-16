import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { MessageCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { getAiStatus, type AiStatus } from "@/api/ai"
import ChatConversation from "./ChatConversation"

type PanelWidth = "standard" | "medium" | "large"

const WIDTH_CLASSES: Record<PanelWidth, string> = {
  standard: "sm:max-w-md",
  medium: "sm:max-w-lg",
  large: "sm:max-w-xl",
}

const LS_KEY = "ai-panel-width"

function savedWidth(): PanelWidth {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === "medium" || v === "large") return v
  } catch {
    // localStorage unavailable
  }
  return "standard"
}

export default function AiChatPanel() {
  const [status, setStatus] = React.useState<AiStatus | null>(null)
  const [open, setOpen] = React.useState(false)
  const [width, setWidth] = React.useState<PanelWidth>(savedWidth)
  const navigate = useNavigate()
  const location = useLocation()

  const refresh = React.useCallback(() => {
    getAiStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  React.useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisible)
    }
    // Re-run on route change so navigating to a new page re-checks status.
  }, [refresh, location.pathname])

  if (!status?.enabled) return null

  function selectWidth(w: PanelWidth) {
    setWidth(w)
    try { localStorage.setItem(LS_KEY, w) } catch { /* ignore */ }
  }

  function openAssistant() {
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
        <SheetContent
          side="right"
          className={`flex flex-col p-0 ${WIDTH_CLASSES[width]}`}
        >
          <SheetHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Sparkles className="size-3.5" />
                </span>
                AI Assistant
              </SheetTitle>

              {/* Width preset buttons — pr-8 keeps the L button clear of the absolute close X */}
              <div className="flex items-center gap-1 pr-8">
                {(["standard", "medium", "large"] as PanelWidth[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-label={w.charAt(0).toUpperCase() + w.slice(1)}
                    onClick={() => selectWidth(w)}
                    className={`rounded px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide transition-colors ${
                      width === w
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {w === "standard" ? "S" : w === "medium" ? "M" : "L"}
                  </button>
                ))}
              </div>
            </div>
          </SheetHeader>

          <ChatConversation showPrivacyNote modelName={status.model} />
        </SheetContent>
      </Sheet>
    </>
  )
}
