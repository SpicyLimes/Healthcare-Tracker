import type { SortState } from "@/hooks/useSort";

interface SortableThProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
}

export function SortableTh({ label, sortKey, sort, onSort }: SortableThProps) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive
    ? sort.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <th
      className="px-4 py-3 text-left font-medium text-muted-foreground"
      aria-sort={ariaSort}
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
    </th>
  );
}
