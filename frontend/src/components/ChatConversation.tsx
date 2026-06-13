import * as React from "react"
import { Send, Sparkles, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { sendChat, AiUnavailableError, type ChatMessage, type Proposal } from "@/api/ai"
import { cn } from "@/lib/utils"

/**
 * A message as shown in the conversation. Superset of the API's ChatMessage: it
 * adds an "error" pseudo-role (rendered but never sent to the model) and optional
 * tools_used metadata returned alongside an assistant answer.
 */
interface DisplayMessage {
  role: "user" | "assistant" | "error"
  content: string
  tools_used?: string[]
  proposals?: Proposal[]
}

interface ChatConversationProps {
  /**
   * When true, the empty state also shows a "Privacy Note" explaining the
   * local-only model and model-capability caveats. Used on the full-screen
   * mobile page, which has the room for it; the compact desktop sheet omits it.
   */
  showPrivacyNote?: boolean
  /**
   * The configured model name. When set, the empty state shows an
   * "AI MODEL: <name>" line above the Privacy Note (mobile page only).
   */
  modelName?: string | null
}

/**
 * The shared conversation body used by both the desktop Sheet (AiChatPanel) and
 * the mobile full-screen page (AiAssistantPage). Owns its own message/input/loading
 * state. Fills its parent — wrap it in a flex column with a constrained height.
 */
export default function ChatConversation({ showPrivacyNote = false, modelName }: ChatConversationProps) {
  const [messages, setMessages] = React.useState<DisplayMessage[]>([])
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages update
  React.useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, loading])

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
          proposals: response.proposals,
        },
      ])
    } catch (err) {
      let errorContent = "Something went wrong. Please try again."
      if (err instanceof AiUnavailableError) {
        errorContent = "AI is unavailable — check Settings."
      } else if (err instanceof DOMException && err.name === "AbortError") {
        errorContent = "Request timed out — the model is taking longer than expected. Try again in a moment."
      }
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
    <div className="flex flex-1 flex-col min-h-0">
      {/* Message list */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="m-auto max-w-[16rem] text-center">
            <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Sparkles className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
              Ask about your Health Records
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              e.g. “What are the current medications?” or “List upcoming appointments.”
            </p>

            {modelName && (
              <p className="mt-5 text-xs">
                <span className="font-semibold uppercase tracking-wide text-primary">
                  AI Model:
                </span>{" "}
                <span className="text-sky-600 dark:text-sky-400">{modelName}</span>
              </p>
            )}

            {showPrivacyNote && (
              <div className="mt-5 border-t border-border/60 pt-4">
                <p className="mb-2 flex justify-center">
                  <ShieldCheck className="size-7 text-primary/60" />
                </p>
                <p className="text-xs font-medium text-foreground">Privacy Note</p>
                <p className="mt-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                  The assistant runs a private, locally-hosted language model,
                  so your records stay on your network and are never shared with
                  any outside service.
                </p>
                <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                  Models differ in capability. To add records or read documents,
                  pick a model that supports Tool Use (and Vision for documents).
                </p>
              </div>
            )}
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
            {msg.role === "assistant" &&
              msg.proposals &&
              msg.proposals.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {msg.proposals.map((p, j) => (
                    <div
                      key={j}
                      className="rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium capitalize">{p.action}</span>
                      {" · "}
                      <span className="text-muted-foreground">
                        {p.section.replace(/_/g, " ")}
                      </span>
                      {p.fields && Object.keys(p.fields).length > 0 && (
                        <div className="mt-0.5 text-muted-foreground">
                          {Object.entries(p.fields)
                            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
                            .join(" · ")}
                        </div>
                      )}
                      {p.warnings &&
                        p.warnings.map((w, k) => (
                          <div key={k} className="mt-0.5 text-amber-600 dark:text-amber-400">
                            ⚠ {w}
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
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
    </div>
  )
}
