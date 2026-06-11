import * as React from "react"
import { MessageCircle, Send, Sparkles, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { getAiSettings } from "@/api/settings"
import { sendChat, AiUnavailableError, type ChatMessage } from "@/api/ai"
import { cn } from "@/lib/utils"

/**
 * A message as shown in the panel. Superset of the API's ChatMessage: it adds an
 * "error" pseudo-role (rendered but never sent to the model) and optional
 * tools_used metadata returned alongside an assistant answer.
 */
interface DisplayMessage {
  role: "user" | "assistant" | "error"
  content: string
  tools_used?: string[]
}

export default function AiChatPanel() {
  const [enabled, setEnabled] = React.useState<boolean | null>(null)
  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<DisplayMessage[]>([])
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // Load settings on mount
  React.useEffect(() => {
    getAiSettings()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false))
  }, [])

  // Scroll to bottom when messages update
  React.useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, loading])

  // Not yet loaded, or disabled → render nothing
  if (!enabled) return null

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: DisplayMessage = { role: "user", content: trimmed }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput("")
    setLoading(true)

    // Build the chat payload (user/assistant only — strip error pseudo-messages)
    const chatHistory: ChatMessage[] = updatedMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    try {
      const response = await sendChat(chatHistory)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer,
          tools_used: response.tools_used,
        },
      ])
    } catch (err) {
      const errorContent =
        err instanceof AiUnavailableError
          ? "AI is unavailable — check Settings."
          : "Something went wrong. Please try again."
      setMessages((prev) => [
        ...prev,
        { role: "error", content: errorContent },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
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
        onClick={() => setOpen(true)}
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

          {/* Message list */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="m-auto max-w-[16rem] text-center">
                <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Sparkles className="size-5" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Ask about your health records
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  e.g. “What are the current medications?” or “List upcoming appointments.”
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                  msg.role === "user" &&
                    "ml-auto rounded-br-md bg-primary text-primary-foreground",
                  msg.role === "assistant" &&
                    "mr-auto rounded-bl-md bg-muted text-foreground",
                  msg.role === "error" &&
                    "mr-auto rounded-bl-md border border-destructive/20 bg-destructive/10 text-destructive"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" &&
                  msg.tools_used &&
                  msg.tools_used.length > 0 && (
                    <p className="mt-1.5 border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
                      Looked up: {msg.tools_used.join(", ")}
                    </p>
                  )}
              </div>
            ))}
            {loading && (
              <div className="mr-auto flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex items-end gap-2 border-t border-border px-4 py-3">
            <textarea
              className={cn(
                "flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                "min-h-10 max-h-32"
              )}
              placeholder="Ask about the records…"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <Button
              variant="default"
              size="icon"
              aria-label="Send"
              className="rounded-xl"
              disabled={loading || !input.trim()}
              onClick={handleSend}
            >
              <Send className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
