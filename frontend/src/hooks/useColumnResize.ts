// frontend/src/hooks/useColumnResize.ts
import { useCallback, useState } from "react";

export function useColumnResize(tableRef: React.RefObject<HTMLTableElement | null>) {
  const [colWidths, setColWidths] = useState<Record<string, number | undefined>>({});

  const autoFitColumn = useCallback(
    (sortKey: string, colIndex: number) => {
      const table = tableRef.current;
      if (!table) return;

      let maxWidth = 0;

      // Measure all tbody cells for this column, skipping spanned rows (expanded detail rows)
      const cells = table.querySelectorAll<HTMLTableCellElement>(
        `tbody tr td:nth-child(${colIndex})`
      );
      cells.forEach((cell) => {
        if (cell.colSpan > 1) return;
        const prev = cell.style.whiteSpace;
        cell.style.whiteSpace = "nowrap";
        maxWidth = Math.max(maxWidth, cell.scrollWidth);
        cell.style.whiteSpace = prev;
      });

      // Also measure the th itself (header label width)
      const th = table.querySelector<HTMLTableCellElement>(
        `thead th:nth-child(${colIndex})`
      );
      if (th) {
        const prev = th.style.whiteSpace;
        th.style.whiteSpace = "nowrap";
        maxWidth = Math.max(maxWidth, th.scrollWidth);
        th.style.whiteSpace = prev;
      }

      const width = maxWidth + 16; // 16px padding buffer

      setColWidths((prev) => {
        const next = { ...prev, [sortKey]: width };
        // Apply table-layout: fixed when any column is overridden
        table.style.tableLayout = "fixed";
        return next;
      });
    },
    [tableRef]
  );

  return { colWidths, autoFitColumn };
}
