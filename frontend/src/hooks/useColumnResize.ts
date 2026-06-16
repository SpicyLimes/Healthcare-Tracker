// frontend/src/hooks/useColumnResize.ts
import { useCallback, useState, type RefObject } from "react";

const MIN_COL_WIDTH = 48;

export function useColumnResize(tableRef: RefObject<HTMLTableElement | null>) {
  const [colWidths, setColWidths] = useState<Record<string, number | undefined>>({});

  function measureColumn(table: HTMLTableElement, colIndex: number): number {
    let maxWidth = 0;
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
    const th = table.querySelector<HTMLTableCellElement>(`thead th:nth-child(${colIndex})`);
    if (th) {
      const prev = th.style.whiteSpace;
      th.style.whiteSpace = "nowrap";
      maxWidth = Math.max(maxWidth, th.scrollWidth);
      th.style.whiteSpace = prev;
    }
    return maxWidth;
  }

  const autoFitColumn = useCallback(
    (sortKey: string, colIndex: number) => {
      const table = tableRef.current;
      if (!table) return;
      const maxWidth = measureColumn(table, colIndex);
      if (maxWidth === 0) return;
      table.style.tableLayout = "fixed";
      setColWidths((prev) => ({ ...prev, [sortKey]: maxWidth + 16 }));
    },
    [tableRef]
  );

  const autoFitAll = useCallback(
    (columns: { sortKey: string; colIndex: number }[]) => {
      const table = tableRef.current;
      if (!table) return;
      const next: Record<string, number> = {};
      let any = false;
      for (const { sortKey, colIndex } of columns) {
        const w = measureColumn(table, colIndex);
        if (w > 0) { next[sortKey] = w + 16; any = true; }
      }
      if (!any) return;
      table.style.tableLayout = "fixed";
      setColWidths((prev) => ({ ...prev, ...next }));
    },
    [tableRef]
  );

  const startDrag = useCallback(
    (sortKey: string, colIndex: number, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const table = tableRef.current;
      if (!table) return;
      table.style.tableLayout = "fixed";
      const startX = e.clientX;
      const th = table.querySelector<HTMLTableCellElement>(`thead th:nth-child(${colIndex})`);
      const startWidth = th ? th.getBoundingClientRect().width : 120;

      function onMove(ev: PointerEvent) {
        const delta = ev.clientX - startX;
        const width = Math.max(MIN_COL_WIDTH, Math.round(startWidth + delta));
        setColWidths((prev) => ({ ...prev, [sortKey]: width }));
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [tableRef]
  );

  return { colWidths, autoFitColumn, autoFitAll, startDrag };
}
