import * as React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface MobileFieldConfig {
  key: string
  value: string | null
}

export interface MobileBadgeConfig {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
}

interface MobileRecordListProps<T extends { id: string | number }> {
  records: T[]
  getHeadline: (record: T) => string
  getSubtitle?: (record: T) => string | null
  getBadge?: (record: T) => MobileBadgeConfig | null
  getFields: (record: T) => MobileFieldConfig[]
  expandedContent?: (record: T) => React.ReactNode
  isAdmin?: boolean
  onEdit?: (record: T) => void
  onDelete?: (record: T) => void
  emptyMessage?: string
}

export function MobileRecordList<T extends { id: string | number }>({
  records,
  getHeadline,
  getSubtitle,
  getBadge,
  getFields,
  expandedContent,
  isAdmin,
  onEdit,
  onDelete,
  emptyMessage = "No records found.",
}: MobileRecordListProps<T>) {
  const [expandedId, setExpandedId] = React.useState<string | number | null>(null)

  if (records.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    )
  }

  return (
    <div className="space-y-2">
      {records.map((record) => {
        const isExpanded = expandedId === record.id
        const badge = getBadge?.(record) ?? null
        const subtitle = getSubtitle?.(record) ?? null
        const fields = getFields(record)

        return (
          <div
            key={record.id}
            className="rounded-lg border border-border bg-card"
          >
            <button
              type="button"
              className="flex w-full items-start justify-between gap-2 p-3 text-left"
              onClick={() => setExpandedId(isExpanded ? null : record.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {getHeadline(record)}
                  </span>
                  {badge && (
                    <Badge variant={badge.variant} className="shrink-0 text-xs">
                      {badge.label}
                    </Badge>
                  )}
                </div>
                {subtitle && (
                  <p className="mt-0.5 text-sm text-muted-foreground truncate">
                    {subtitle}
                  </p>
                )}
              </div>
              <span className="mt-0.5 shrink-0 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-3 pb-3 pt-2">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-xs text-muted-foreground">{field.key}</dt>
                      <dd className="text-sm text-foreground">
                        {field.value ?? "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
                {expandedContent && (
                  <div className="mt-3">{expandedContent(record)}</div>
                )}
                {(onEdit || onDelete) && isAdmin && (
                  <div className="mt-3 flex gap-2">
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(record)}
                      >
                        Edit
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(record)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
