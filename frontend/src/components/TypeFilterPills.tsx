// frontend/src/components/TypeFilterPills.tsx
import { cn } from "@/lib/utils";

interface TypeOption {
  value: string;
  label: string;
}

interface TypeFilterPillsProps {
  options: readonly TypeOption[];
  active: Set<string>;
  onToggle: (value: string) => void;
}

export function TypeFilterPills({ options, active, onToggle }: TypeFilterPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
      {options.map((o) => {
        const on = active.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            className={cn(
              "rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors",
              on ? "bg-background text-foreground" : "bg-muted text-muted-foreground opacity-50"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
