import * as React from "react"
import { Button } from "@/components/ui/button"
import { useSort, type SortDirection } from "@/hooks/useSort"
import { SortableTh } from "@/components/SortableTh"
import {
  MobileRecordList,
  type MobileBadgeConfig,
} from "@/components/MobileRecordList"
import { RecordDetailModal, type DetailField } from "@/components/RecordDetailModal"

export interface PrimaryColumn<T> {
  header: string
  sortKey?: string
  render: (row: T) => React.ReactNode
  className?: string
}

export interface RecordTableProps<T extends object> {
  rows: T[]
  loading: boolean
  isAdmin: boolean
  getRowId: (row: T) => string

  primaryColumns: PrimaryColumn<T>[]
  defaultSortKey?: string
  defaultSortDir?: SortDirection

  detailTitle: (row: T) => string
  detailFields: (row: T) => DetailField[]
  renderDetailExtra?: (row: T) => React.ReactNode

  getHeadline: (row: T) => string
  getSubtitle?: (row: T) => string | null
  getBadge?: (row: T) => MobileBadgeConfig | null

  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  renderRowActions?: (row: T) => React.ReactNode
  emptyMessage?: string
  pageSize?: number
}

export function RecordTable<T extends object>({
  rows,
  loading,
  isAdmin,
  getRowId,
  primaryColumns,
  defaultSortKey,
  defaultSortDir = "asc",
  detailTitle,
  detailFields,
  renderDetailExtra,
  getHeadline,
  getSubtitle,
  getBadge,
  onEdit,
  onDelete,
  renderRowActions,
  emptyMessage = "No records yet.",
  pageSize = 10,
}: RecordTableProps<T>) {
  const firstSortKey =
    defaultSortKey ?? primaryColumns.find((c) => c.sortKey)?.sortKey ?? ""
  const { sorted, sort, toggleSort } = useSort(rows, firstSortKey, defaultSortDir)
  const sortedRows = sorted

  const [visibleCount, setVisibleCount] = React.useState(pageSize)
  React.useEffect(() => {
    setVisibleCount(pageSize)
  }, [sort, rows, pageSize])

  const pagedRows = sortedRows.slice(0, visibleCount)
  const remaining = sortedRows.length - pagedRows.length

  const [detailRow, setDetailRow] = React.useState<T | null>(null)

  const actionColSpan = primaryColumns.length + 1 // + actions column

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden">
        <MobileRecordList
          records={pagedRows as Array<T & { id: string | number }>}
          getHeadline={getHeadline}
          getSubtitle={getSubtitle}
          getBadge={getBadge}
          getFields={(r) =>
            detailFields(r).map((f) => ({
              key: f.label,
              value: f.value == null || f.value === "" ? null : String(f.value),
            }))
          }
          expandedContent={renderDetailExtra}
          isAdmin={isAdmin}
          onEdit={onEdit}
          onDelete={onDelete}
          emptyMessage={emptyMessage}
        />
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {primaryColumns.map((col) =>
                col.sortKey ? (
                  <SortableTh
                    key={col.header}
                    label={col.header}
                    sortKey={col.sortKey}
                    sort={sort}
                    onSort={toggleSort}
                  />
                ) : (
                  <th
                    key={col.header}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {col.header}
                  </th>
                )
              )}
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={actionColSpan}
                  className="py-6 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              pagedRows.map((r) => (
                <tr
                  key={getRowId(r)}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  {primaryColumns.map((col) => (
                    <td
                      key={col.header}
                      className={col.className ?? "px-4 py-3 text-muted-foreground"}
                    >
                      {col.render(r)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {renderRowActions?.(r)}
                    <Button variant="outline" size="sm" aria-label={`More details for ${detailTitle(r)}`} onClick={() => setDetailRow(r)}>
                      More
                    </Button>
                    {isAdmin && onEdit && (
                      <Button variant="outline" size="sm" aria-label={`Edit ${detailTitle(r)}`} onClick={() => onEdit(r)}>
                        Edit
                      </Button>
                    )}
                    {isAdmin && onDelete && (
                      <Button variant="destructive" size="sm" aria-label={`Delete ${detailTitle(r)}`} onClick={() => onDelete(r)}>
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={actionColSpan}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && remaining > 0 && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + pageSize)}>
            Show More ({remaining} more)
          </Button>
        </div>
      )}

      {detailRow && (
        <RecordDetailModal
          title={detailTitle(detailRow)}
          fields={detailFields(detailRow)}
          isAdmin={isAdmin}
          extra={renderDetailExtra?.(detailRow)}
          onClose={() => setDetailRow(null)}
          onEdit={
            onEdit
              ? () => {
                  const r = detailRow
                  setDetailRow(null)
                  onEdit(r)
                }
              : undefined
          }
        />
      )}
    </>
  )
}
