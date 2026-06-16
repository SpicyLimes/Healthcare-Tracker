import type { SortState } from "@/hooks/useSort";

interface SortableThProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  width?: number;
  colIndex?: number;
  onAutoFit?: (sortKey: string, colIndex: number) => void;
  onStartResize?: (sortKey: string, colIndex: number, e: React.PointerEvent) => void;
}

export function SortableTh({ label, sortKey, sort, onSort, width, colIndex, onAutoFit, onStartResize }: SortableThProps) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive
    ? sort.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <th
      className="relative px-4 py-3 text-left font-medium text-muted-foreground"
      aria-sort={ariaSort}
      style={width !== undefined ? { width: `${width}px` } : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        aria-label={`Sort by ${label}${isActive ? `, ${ariaSort}` : ""}`}
      >
        {label}
        <span className="text-xs opacity-50">
          {isActive ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
      {colIndex !== undefined && (onAutoFit !== undefined || onStartResize !== undefined) && (
        <span
          role="separator"
          aria-orientation="vertical"
          onPointerDown={onStartResize ? (e) => onStartResize(sortKey, colIndex, e) : undefined}
          onDoubleClick={onAutoFit ? (e) => { e.stopPropagation(); onAutoFit(sortKey, colIndex); } : undefined}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none bg-border/30 hover:bg-primary/60 active:bg-primary transition-colors"
          title="Drag to resize · double-click to auto-fit"
          aria-label={`Resize ${label} column`}
        />
      )}
    </th>
  );
}
