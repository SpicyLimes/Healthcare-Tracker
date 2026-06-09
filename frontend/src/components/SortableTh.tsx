import type { SortState } from "@/hooks/useSort";

interface SortableThProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
}

export function SortableTh({ label, sortKey, sort, onSort }: SortableThProps) {
  const isActive = sort.key === sortKey;
  return (
    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <span className="text-xs opacity-50">
          {isActive ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
