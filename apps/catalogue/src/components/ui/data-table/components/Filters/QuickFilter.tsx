import { memo } from "react";
import { cn } from "@/src/lib/utils";
import type { DataTableFiltersProps } from "../../types";

export const DataTableQuickFilters = memo(function DataTableQuickFilters({
  filters,
}: DataTableFiltersProps) {
  if (!filters.length) return null;

  return (
    <div className="flex items-center gap-2 py-2">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={filter.onClick}
          className={cn(
            "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors",
            "hover:bg-zinc-100",
            filter.isActive
              ? "bg-zinc-900 text-white hover:bg-zinc-800"
              : "bg-zinc-100 text-zinc-900"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
});
