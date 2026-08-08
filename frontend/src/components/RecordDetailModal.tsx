import * as React from "react"
import { Button } from "@/components/ui/button"
import { useModalDismiss } from "@/lib/use-modal-dismiss"

export interface DetailField {
  label: string
  value: React.ReactNode | null
}

interface RecordDetailModalProps {
  title: string
  fields: DetailField[]
  isAdmin: boolean
  onClose: () => void
  onEdit?: () => void
  extra?: React.ReactNode
}

function isEmpty(v: React.ReactNode | null): boolean {
  return v === null || v === undefined || v === ""
}

export function RecordDetailModal({
  title,
  fields,
  isAdmin,
  onClose,
  onEdit,
  extra,
}: RecordDetailModalProps) {
  const overlayRef = useModalDismiss(onClose)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={overlayRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="detail-backdrop"
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

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map((f, i) => (
            <div key={`${f.label}-${i}`}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm text-foreground whitespace-pre-wrap">
                {isEmpty(f.value) ? "—" : f.value}
              </dd>
            </div>
          ))}
        </dl>

        {extra && <div className="mt-4 border-t border-border pt-4">{extra}</div>}

        <div className="mt-6 flex justify-end gap-2">
          {isAdmin && onEdit && (
            <Button type="button" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
