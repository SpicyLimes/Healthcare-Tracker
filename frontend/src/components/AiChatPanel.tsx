import * as React from "react"
import { MessageCircle, Send } from "lucide-react"
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

interface Message {
  role: "user" | "assistant" | "error"
  content: string
  tools_used?: string[]
}

export default function AiChatPanel() {
  const [enabled, setEnabled] = React.useState<boolean | null>(null)
  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([])
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

    const userMsg: Message = { role: "user", content: trimmed }
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
        className="fixed bottom-6 right-6 z-40 gap-2 shadow-lg"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="size-4" />
        Assistant
      </Button>

      {/* Chat panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle>AI Assistant</SheetTitle>
          </SheetHeader>

          {/* Message list */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Ask a question about your health records.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user" &&
                    "ml-auto bg-primary text-primary-foreground",
                  msg.role === "assistant" &&
                    "mr-auto bg-muted text-foreground",
                  msg.role === "error" &&
                    "mr-auto bg-destructive/10 text-destructive border border-destructive/20"
                )}
              >
                <p>{msg.content}</p>
                {msg.role === "assistant" &&
                  msg.tools_used &&
                  msg.tools_used.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tools: {msg.tools_used.join(", ")}
                    </p>
                  )}
              </div>
            ))}
            {loading && (
              <div className="mr-auto rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Thinking…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border px-4 py-3 flex gap-2 items-end">
            <textarea
              className={cn(
                "flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm",
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
