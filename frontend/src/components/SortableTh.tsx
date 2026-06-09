import type { SortState } from "@/hooks/useSort";

interface SortableThProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  width?: number;
  colIndex?: number;
  onAutoFit?: (sortKey: string, colIndex: number) => void;
}

export function SortableTh({ label, sortKey, sort, onSort, width, colIndex, onAutoFit }: SortableThProps) {
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
      {onAutoFit !== undefined && colIndex !== undefined && (
        <button
          type="button"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onAutoFit(sortKey, colIndex);
          }}
          className="absolute right-0 top-0 h-full w-1 cursor-pointer hover:bg-border/60 active:bg-border focus:outline-none"
          title="Double-click to auto-fit column"
          aria-label={`Auto-fit ${label} column`}
          tabIndex={-1}
        />
      )}
    </th>
  );
}
