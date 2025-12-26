import { useState, useEffect } from "react";
import { Widget } from "../Widget";
import { api } from "@/src/utils/api";
import { cn } from "@/src/lib/utils";
import { PriceRangeChip } from "@/src/components/dashboard/device/PriceRangeChip";
import type { ManagedWidgetProps } from "../types";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/src/components/ui/ContextMenu";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type AgeCategory = "fresh" | "aging" | "old" | "veryOld" | "notSelling";

type AvailabilityStatus = "selling" | "not_in_sale" | "not_yet_in_sale";

const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  selling: "Продается",
  not_in_sale: "Нет в продаже",
  not_yet_in_sale: "Еще нет в продаже",
};

const AVAILABILITY_STATUS_STYLES: Record<
  AvailabilityStatus,
  { text: string; bg: string }
> = {
  selling: {
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  not_in_sale: {
    text: "text-gray-700 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800/50",
  },
  not_yet_in_sale: {
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
};

function AvailabilityStatusBadge({ status }: { status: AvailabilityStatus }) {
  const styles = AVAILABILITY_STATUS_STYLES[status];
  const label = AVAILABILITY_STATUS_LABELS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        styles.text,
        styles.bg
      )}
    >
      {label}
    </span>
  );
}

interface StatRowProps {
  label: string;
  count: number;
  total: number;
  colorClass: string;
  bgColorClass: string;
  expanded?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  category?: AgeCategory;
}

function StatRow({ label, count, total, colorClass, bgColorClass, expanded, onClick, isSelected }: StatRowProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const barWidth = Math.round(percentage);

  if (!expanded) {
    return (
      <button
        onClick={onClick}
        disabled={count === 0}
        className={cn(
          "group w-full space-y-1.5 py-1.5 text-left",
          onClick && count > 0 && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-lg px-2 -mx-2 transition-colors",
          count === 0 && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium dark:text-gray-300">{label}</span>
          <span className={cn("text-sm font-bold tabular-nums", colorClass)}>{count}</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800/50">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              bgColorClass
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={cn(
        "group w-full space-y-2 py-2.5 text-left transition-all rounded-lg px-3 -mx-3",
        onClick && count > 0 && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30",
        isSelected && "bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-300 dark:ring-gray-700 shadow-sm",
        count === 0 && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-sm font-medium transition-colors",
          isSelected ? "text-gray-900 dark:text-white font-semibold" : "dark:text-gray-200"
        )}>{label}</span>
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-sm font-bold tabular-nums transition-all",
            isSelected && "text-base",
            colorClass
          )}>{count}</span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-14 text-right tabular-nums">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800/50">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            bgColorClass
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </button>
  );
}

export function DeviceStatsWidget({ className, expanded, onToggleExpand }: ManagedWidgetProps) {
  const [selectedCategory, setSelectedCategory] = useState<AgeCategory | null>(null);
  const [updatingDeviceId, setUpdatingDeviceId] = useState<string | null>(null);
  
  const utils = api.useUtils();
  const { data, isLoading, error } = api.dashboardWidgets.getDeviceUpdateStats.useQuery();
  
  const { data: devicesData, isLoading: isLoadingDevices } = api.dashboardWidgets.getDevicesByAgeCategory.useQuery(
    { category: selectedCategory! },
    { enabled: expanded && selectedCategory !== null }
  );

  const updateAvailabilityStatus = api.device.updateDeviceAvailabilityStatus.useMutation({
    onSuccess: (_data, variables) => {
      const statusLabel = AVAILABILITY_STATUS_LABELS[variables.status];
      toast.success("Статус обновлен", {
        description: `Статус устройства изменен на "${statusLabel}"`,
      });
      
      // Refetch both the stats and the device list
      void utils.dashboardWidgets.getDeviceUpdateStats.invalidate();
      if (selectedCategory) {
        void utils.dashboardWidgets.getDevicesByAgeCategory.invalidate({ 
          category: selectedCategory 
        });
      }
      
      setUpdatingDeviceId(null);
    },
    onError: (error) => {
      toast.error("Ошибка", {
        description: error.message || "Не удалось обновить статус устройства",
      });
      setUpdatingDeviceId(null);
    },
  });

  // Reset selected category when widget is collapsed
  useEffect(() => {
    if (!expanded) {
      setSelectedCategory(null);
    }
  }, [expanded]);

  const handleCategoryClick = (category: AgeCategory) => {
    if (!expanded) {
      onToggleExpand();
    }
    setSelectedCategory(category);
  };

  const handleUpdateStatus = (deviceId: string, status: AvailabilityStatus) => {
    setUpdatingDeviceId(deviceId);
    updateAvailabilityStatus.mutate({ deviceId, status });
  };

  const stats = data
    ? [
        {
          category: "veryOld" as const,
          label: "Критично (>6 месяцев)",
          count: data.veryOld,
          colorClass: "text-red-600 dark:text-red-400",
          bgColorClass: "bg-gradient-to-r from-red-500 to-red-600 dark:from-red-400 dark:to-red-500",
        },
        {
          category: "old" as const,
          label: "Устарело (1-6 месяцев)",
          count: data.old,
          colorClass: "text-orange-600 dark:text-orange-400",
          bgColorClass: "bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500",
        },
        {
          category: "aging" as const,
          label: "Устаревает (2-4 недели)",
          count: data.aging,
          colorClass: "text-yellow-600 dark:text-yellow-500",
          bgColorClass: "bg-gradient-to-r from-yellow-500 to-yellow-600 dark:from-yellow-400 dark:to-yellow-500",
        },
        {
          category: "fresh" as const,
          label: "Свежие (до 14 дней)",
          count: data.fresh,
          colorClass: "text-emerald-600 dark:text-emerald-400",
          bgColorClass: "bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500",
        },
      ]
    : [];
  
  const handleOpenDevice = (deviceId: string) => {
    window.open(`/dashboard/devices/${deviceId}`, "_blank");
  };

  return (
    <Widget
      title="Обновление цен"
      loading={isLoading}
      error={error?.message}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      className={cn(expanded && "md:col-span-2 md:col-start-1", className)}
    >
      <div className="space-y-0.5">
        {stats.map((stat) => (
          <StatRow
            key={stat.label}
            label={stat.label}
            count={stat.count}
            total={data?.total ?? 0}
            colorClass={stat.colorClass}
            bgColorClass={stat.bgColorClass}
            expanded={expanded}
            onClick={() => handleCategoryClick(stat.category)}
            isSelected={selectedCategory === stat.category}
            category={stat.category}
          />
        ))}

        {expanded && data && data.notSelling > 0 && (
          <StatRow
            label="Не продаются / Нет данных"
            count={data.notSelling}
            total={data.total}
            colorClass="text-gray-600 dark:text-gray-400"
            bgColorClass="bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-500 dark:to-gray-600"
            expanded={expanded}
            onClick={() => handleCategoryClick("notSelling")}
            isSelected={selectedCategory === "notSelling"}
            category="notSelling"
          />
        )}

        <div className={cn("pt-4 mt-4 border-t dark:border-gray-800")}>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">
              Всего устройств
            </span>
            <span className="text-lg font-bold tabular-nums dark:text-gray-100">
              {data?.total ?? 0}
            </span>
          </div>
        </div>

        {/* Device List Table */}
        {expanded && selectedCategory && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                Устройства <span className="text-gray-500 dark:text-gray-500">({devicesData?.length ?? 0})</span>
              </h3>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  Скрыть список
                </button>
              )}
            </div>

            {isLoadingDevices ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                Загрузка устройств...
              </div>
            ) : devicesData && devicesData.length > 0 ? (
              <div className="overflow-hidden rounded-lg border dark:border-gray-800 bg-white dark:bg-[hsl(0_0%_9%)] shadow-sm">
                <div className="max-h-[32rem] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[hsl(0_0%_7%)] border-b dark:border-gray-800">
                      <tr>
                        <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 w-12">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                          Название
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                          Статус
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                          Цены
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800">
                      {devicesData.map((device, index) => {
                        const isUpdating = updatingDeviceId === device.id;
                        
                        return (
                          <ContextMenu key={device.id}>
                            <ContextMenuTrigger asChild>
                              <tr
                                onClick={() => handleOpenDevice(device.id)}
                                className={cn(
                                  "group cursor-pointer transition-colors",
                                  isUpdating 
                                    ? "bg-blue-50 dark:bg-blue-900/10" 
                                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                )}
                              >
                                <td className="px-2 py-3.5 text-center">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-500 tabular-nums">
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex w-4 items-center justify-center flex-shrink-0">
                                      {device.hasProfile ? (
                                        <div className="h-2 w-2 rounded-full bg-emerald-500" title="Профиль заполнен" />
                                      ) : (
                                        <div className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-600" title="Профиль не заполнен" />
                                      )}
                                    </div>
                                    <span className="text-sm font-medium dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                      {device.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <AvailabilityStatusBadge status={device.availabilityStatus} />
                                    {isUpdating && (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <PriceRangeChip links={device.links ?? []} />
                                </td>
                              </tr>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  handleUpdateStatus(device.id, "selling");
                                }}
                                disabled={device.availabilityStatus === "selling" || isUpdating}
                              >
                                Продается
                              </ContextMenuItem>
                              <ContextMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  handleUpdateStatus(device.id, "not_in_sale");
                                }}
                                disabled={device.availabilityStatus === "not_in_sale" || isUpdating}
                              >
                                Нет в продаже
                              </ContextMenuItem>
                              <ContextMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  handleUpdateStatus(device.id, "not_yet_in_sale");
                                }}
                                disabled={device.availabilityStatus === "not_yet_in_sale" || isUpdating}
                              >
                                Еще нет в продаже
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Нет устройств в этой категории
              </div>
            )}
          </div>
        )}
      </div>
    </Widget>
  );
}
