import * as React from "react"
import { Navigate } from "react-router-dom"
import { Sparkles, ShieldCheck } from "lucide-react"
import { getAiSettings } from "@/api/settings"
import ChatConversation from "./ChatConversation"

/**
 * Dedicated full-screen assistant route (mobile). Uses 100dvh so the pinned
 * input area sits above the on-screen keyboard, and the message list scrolls
 * within the remaining space.
 */
export default function AiAssistantPage() {
  const [enabled, setEnabled] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    getAiSettings()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false))
  }, [])

  // Still loading settings → render nothing yet
  if (enabled === null) return null

  // AI disabled → bounce back home
  if (!enabled) return <Navigate to="/" replace />

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="size-3.5" />
          </span>
          AI Assistant
        </h1>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3" />
          Answers come only from your records, on your local network.
        </p>
      </header>

      <ChatConversation />
    </div>
  )
}
