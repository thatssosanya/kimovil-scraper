import { memo, useMemo, useState } from "react";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/Button";
import { Trash2, ChevronDown, Loader2 } from "lucide-react";
import { RatingCleanupDialog } from "@/src/components/dashboard/rating/components/dialogs/RatingCleanupDialog";
import { api } from "@/src/utils/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/src/components/ui/DropdownMenu";
import { DeviceTypeSelector } from "@/src/components/dashboard/device/components/DeviceTypeSelector";
import { toast } from "sonner";

// Only keep toggles that are true on/off; others are tri-state below
export const QUICK_FILTER_CONFIG = [
  {
    id: "hasOutdatedPrices",
    label: "С устаревшими ценами",
  },
] as const;

interface QuickFiltersProps {
  activeFilters: string[];
  onFilterChange?: (filters: string[]) => void;
  deviceType?: string;
  onDeviceTypeChange?: (value?: string) => void;
}

const QuickFilters = memo(function QuickFilters({
  activeFilters,
  onFilterChange,
  deviceType,
  onDeviceTypeChange,
}: QuickFiltersProps) {
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  // Tri-state derived values from activeFilters
  const profileState: "all" | "with" | "without" = useMemo(() => {
    if (activeFilters.includes("hasProfile")) return "with";
    if (activeFilters.includes("noProfile")) return "without";
    return "all";
  }, [activeFilters]);

  const ratingsState: "all" | "in" | "out" = useMemo(() => {
    if (activeFilters.includes("inRatings")) return "in";
    if (activeFilters.includes("noRatings")) return "out";
    return "all";
  }, [activeFilters]);

  const duplicatesState: "all" | "potential" | "confirmed" = useMemo(() => {
    if (activeFilters.includes("duplicatesPotential")) return "potential";
    if (activeFilters.includes("duplicatesConfirmed")) return "confirmed";
    return "all";
  }, [activeFilters]);

  const isInRatingsActive = ratingsState === "in";
  const isDuplicatesFilterActive = duplicatesState !== "all";

  const { data: duplicateStats } = api.device.getDuplicateStats.useQuery(
    undefined,
    {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
    }
  );

  const utils = api.useUtils();
  const scanMutation = api.device.scanForDuplicates.useMutation({
    onSuccess: (result) => {
      const parts = [`Найдено ${result.groupsFound} групп, отмечено ${result.devicesMarked} устройств`];
      if (result.backfilledCount > 0) {
        parts.push(`Нормализовано ${result.backfilledCount} названий`);
      }
      toast.success("Сканирование завершено", {
        description: parts.join(". "),
      });
      void utils.device.getDuplicateStats.invalidate();
      void utils.device.getAllDevices.invalidate();
    },
    onError: (error) => {
      toast.error("Ошибка сканирования", {
        description: error.message,
      });
    },
  });

  const totalDuplicates = (duplicateStats?.potential ?? 0) + (duplicateStats?.duplicate ?? 0);

  // Check for orphaned data only when inRatings filter is active
  const { data: orphanedCheck } = api.rating.hasOrphanedRatingData.useQuery(
    undefined,
    {
      enabled: isInRatingsActive,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    }
  );

  const shouldShowCleanupButton =
    isInRatingsActive && orphanedCheck?.hasOrphanedData;

  return (
    <>
      <div className="flex items-center gap-2">
        {/** Shared styles */}
        {/** active: bold contrast; inactive: subtle */}
        {/** keep h-8 and cursor-pointer consistent */}
        {/* Profiles tri-state as cycle button */}
        <button
          onClick={() => {
            if (!onFilterChange) return;
            const withoutBoth = activeFilters.filter(
              (f) => f !== "hasProfile" && f !== "noProfile"
            );
            const nextState = profileState === "all" ? "with" : profileState === "with" ? "without" : "all";
            const next =
              nextState === "with"
                ? [...withoutBoth, "hasProfile"]
                : nextState === "without"
                ? [...withoutBoth, "noProfile"]
                : withoutBoth;
            onFilterChange(next);
          }}
          className={cn(
            "inline-flex h-8 items-center rounded-sm px-3 text-xs font-medium cursor-pointer active:scale-95",
            profileState === "all"
              ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-100 dark:bg-[hsl(0_0%_20%)] dark:text-gray-200 dark:hover:bg-[hsl(0_0%_25%)]"
              : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-[hsl(0_0%_9%)] dark:hover:bg-[hsl(0_0%_12%)]"
          )}
        >
          {profileState === "all"
            ? "Все устройства"
            : profileState === "with"
            ? "С профилями"
            : "Без профиля"}
        </button>

        {/* Type selector dropdown with list */}
        {deviceType && deviceType.trim() ? (
          <button
            onClick={() => onDeviceTypeChange?.("")}
            className={cn(
              "inline-flex h-8 items-center rounded-sm px-3 text-xs font-medium cursor-pointer active:scale-95",
              "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-[hsl(0_0%_9%)] dark:hover:bg-[hsl(0_0%_12%)]"
            )}
            title="Сбросить тип"
          >
            {deviceType}
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs font-medium cursor-pointer active:scale-95 transition-all duration-200",
                  "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-[hsl(0_0%_20%)] dark:text-gray-200 dark:hover:bg-[hsl(0_0%_25%)]",
                  "data-[state=open]:bg-zinc-200 data-[state=open]:dark:bg-[hsl(0_0%_25%)]"
                )}
              >
                Тип
                <ChevronDown className="h-3 w-3 transition-transform duration-200 data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="start" 
              className="z-[1000] min-w-[18rem] p-2 animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-top-2"
            >
              <DeviceTypeSelector
                value={deviceType}
                onChange={(val) => onDeviceTypeChange?.(val || "")}
                placeholder="Выберите тип"
                inline
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Ratings tri-state as cycle button */}
        <button
          onClick={() => {
            if (!onFilterChange) return;
            const withoutBoth = activeFilters.filter(
              (f) => f !== "inRatings" && f !== "noRatings"
            );
            const nextState = ratingsState === "all" ? "in" : ratingsState === "in" ? "out" : "all";
            const next =
              nextState === "in"
                ? [...withoutBoth, "inRatings"]
                : nextState === "out"
                ? [...withoutBoth, "noRatings"]
                : withoutBoth;
            onFilterChange(next);
          }}
          className={cn(
            "inline-flex h-8 items-center rounded-sm px-3 text-xs font-medium cursor-pointer active:scale-95",
            ratingsState === "all"
              ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-100 dark:bg-[hsl(0_0%_20%)] dark:text-gray-200 dark:hover:bg-[hsl(0_0%_25%)]"
              : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-[hsl(0_0%_9%)] dark:hover:bg-[hsl(0_0%_12%)]"
          )}
        >
          {ratingsState === "all" ? "В рейтингах" : ratingsState === "in" ? "В рейтингах" : "Не в рейтингах"}
        </button>

        {/* Duplicates tri-state filter */}
        <button
          onClick={() => {
            if (!onFilterChange) return;
            const withoutBoth = activeFilters.filter(
              (f) => f !== "duplicatesPotential" && f !== "duplicatesConfirmed"
            );
            const nextState = duplicatesState === "all" ? "potential" : duplicatesState === "potential" ? "confirmed" : "all";
            const next =
              nextState === "potential"
                ? [...withoutBoth, "duplicatesPotential"]
                : nextState === "confirmed"
                ? [...withoutBoth, "duplicatesConfirmed"]
                : withoutBoth;
            onFilterChange(next);
          }}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs font-medium cursor-pointer active:scale-95",
            duplicatesState === "all"
              ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-100 dark:bg-[hsl(0_0%_20%)] dark:text-gray-200 dark:hover:bg-[hsl(0_0%_25%)]"
              : "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
          )}
        >
          {duplicatesState === "all" 
            ? "Дубликаты" 
            : duplicatesState === "potential" 
            ? "Потенциальные" 
            : "Подтверждённые"}
          {totalDuplicates > 0 && (
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              duplicatesState === "all"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-white/20 text-white"
            )}>
              {totalDuplicates}
            </span>
          )}
        </button>

        {/* Scan for duplicates button - show when filter is active */}
        {isDuplicatesFilterActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="h-8 gap-1.5 text-xs"
          >
            {scanMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : null}
            {scanMutation.isPending ? "Сканирование..." : "Сканировать"}
          </Button>
        )}

        {/* Outdated prices toggle */}
        {QUICK_FILTER_CONFIG.map((filter) => {
          const isActive = activeFilters.includes(filter.id);
          return (
            <button
              key={filter.id}
              onClick={() =>
                onFilterChange?.(
                  isActive
                    ? activeFilters.filter((f) => f !== filter.id)
                    : [...activeFilters, filter.id]
                )
              }
              className={cn(
                "inline-flex h-8 items-center rounded-sm px-3 text-xs font-medium cursor-pointer",
                "active:scale-95",
                isActive
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-[hsl(354_73%_56%)] dark:hover:bg-[hsl(354_73%_50%)]"
                  : "bg-zinc-100 text-zinc-900 hover:bg-zinc-100 dark:bg-[hsl(0_0%_20%)] dark:text-gray-200 dark:hover:bg-[hsl(0_0%_25%)]"
              )}
            >
              {filter.label}
            </button>
          );
        })}

        {shouldShowCleanupButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCleanupDialogOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Trash2 className="h-3 w-3" />
            Очистить устаревшие
            {orphanedCheck?.totalCount && (
              <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {orphanedCheck.totalCount}
              </span>
            )}
          </Button>
        )}
      </div>

      <RatingCleanupDialog
        open={cleanupDialogOpen}
        onOpenChange={setCleanupDialogOpen}
        onCleanupComplete={() => {
          // handled by dialog
        }}
      />
    </>
  );
});

export default QuickFilters;
