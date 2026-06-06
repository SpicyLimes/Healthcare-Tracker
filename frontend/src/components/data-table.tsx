import { cn } from "@/lib/utils"

interface Column {
  label: string
  key?: string
}

interface DataTableProps {
  columns: Column[]
  emptyMessage?: string
  className?: string
}

export function DataTable({ columns, emptyMessage = "No records yet.", className }: DataTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-border", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((col) => (
              <th
                key={col.label}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              colSpan={columns.length}
              className="px-4 py-12 text-center text-sm text-muted-foreground"
            >
              {emptyMessage}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
