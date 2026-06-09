import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

export function useSort<T extends object>(
  rows: T[],
  defaultKey: string,
  defaultDirection: SortDirection = "asc"
) {
  const [sort, setSort] = useState<SortState>({ key: defaultKey, direction: defaultDirection });

  function toggleSort(key: string) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ra = a as Record<string, unknown>;
      const rb = b as Record<string, unknown>;
      const av = ra[sort.key] ?? "";
      const bv = rb[sort.key] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  return { sorted, sort, toggleSort };
}
