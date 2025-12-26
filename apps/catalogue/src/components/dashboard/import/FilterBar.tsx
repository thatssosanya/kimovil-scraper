import { cn } from "@/src/lib/utils";

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  stats?: {
    corrupted: number;
    valid: number;
    scraped: number;
    rawData: number;
    aiData: number;
  };
  matchedCount?: number;
}

const filters = [
  { id: "all", label: "Все" },
  { id: "has_ai", label: "С AI данными" },
  { id: "matched", label: "В каталоге" },
  { id: "unmatched", label: "Не в каталоге" },
] as const;

export function FilterBar({ activeFilter, onFilterChange, stats, matchedCount }: FilterBarProps) {
  const getCount = (filterId: string): number | undefined => {
    if (!stats) return undefined;
    switch (filterId) {
      case "has_ai":
        return stats.aiData;
      case "has_raw":
        return stats.rawData;
      case "scraped":
        return stats.scraped;
      case "valid":
        return stats.valid;
      case "corrupted":
        return stats.corrupted;
      case "matched":
        return matchedCount;
      default:
        return undefined;
    }
  };

  return (
    <div className="flex items-center gap-1">
      {filters.map((filter) => {
        const count = getCount(filter.id);
        const isActive = activeFilter === filter.id;

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            )}
          >
            {filter.label}
            {count !== undefined && (
              <span
                className={cn(
                  "rounded px-1 text-[10px]",
                  isActive
                    ? "bg-white/20 dark:bg-black/20"
                    : "bg-zinc-200 dark:bg-zinc-700"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
