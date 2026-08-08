import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "info" | "error";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface AckDialog {
  id: number;
  message: string;
}

interface ToastState {
  /** Show a transient, auto-dismissing notification (bottom-center). */
  showToast: (message: string, variant?: ToastVariant) => void;
  /**
   * Show a centered, persistent acknowledgment dialog that stays until the
   * user clicks "Understood". Use for messages the user must actively see
   * (e.g. "your submission needs approval").
   */
  showAck: (message: string) => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);

// Tokenised so each theme supplies its own foreground. These previously used
// dark-theme text shades (text-emerald-100 etc.) with no `dark:` variant, so in
// the light theme the text sat at ~1.1:1 against its own background — toasts
// are the only transient confirmation on 13 record pages, and a light-theme
// user could not tell a successful save from a silent failure.
const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-success/40 bg-success/15 text-success-foreground",
  info: "border-info/40 bg-info/15 text-info-foreground",
  error: "border-destructive/40 bg-destructive/15 text-destructive-foreground",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [acks, setAcks] = useState<AckDialog[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const showAck = useCallback((message: string) => {
    const id = nextId.current++;
    setAcks((prev) => [...prev, { id, message }]);
  }, []);

  const dismissAck = useCallback((id: number) => {
    setAcks((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Only the most recent ack is shown (one at a time).
  const activeAck = acks[acks.length - 1];

  return (
    <ToastContext.Provider value={{ showToast, showAck }}>
      {children}

      {/* Transient toasts: bottom-CENTER so they don't cover the bottom-right
          AI Assistant bubble. */}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-lg backdrop-blur ${VARIANT_STYLES[t.variant]}`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Persistent acknowledgment dialog: dead-center, must be dismissed. */}
      {activeAck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Notice"
            className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-xl"
          >
            <p className="text-sm text-card-foreground">{activeAck.message}</p>
            <button
              type="button"
              autoFocus
              onClick={() => dismissAck(activeAck.id)}
              className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
