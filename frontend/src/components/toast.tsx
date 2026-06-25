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

interface ToastState {
  /** Show a transient notification. Auto-dismisses after a few seconds. */
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  info: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  error: "border-red-500/40 bg-red-500/15 text-red-100",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
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
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
