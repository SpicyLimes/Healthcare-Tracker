import * as React from "react"
import { Button } from "@/components/ui/button"

export interface RecordFormModalProps {
  title: string
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  error?: string | null
  submitLabel?: string
  children: React.ReactNode
}

export function RecordFormModal({
  title,
  onClose,
  onSubmit,
  error,
  submitLabel = "Save",
  children,
}: RecordFormModalProps) {
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await onSubmit(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="form-backdrop"
      onClick={onClose}
    >
      <div
        className="mx-4 sm:mx-auto w-full sm:w-[60vw] sm:max-w-3xl rounded-xl border border-border bg-card p-4 sm:p-6 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {children}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
