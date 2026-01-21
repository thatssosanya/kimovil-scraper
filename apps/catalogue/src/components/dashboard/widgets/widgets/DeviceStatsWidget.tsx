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
import { Loader2, Clock } from "lucide-react";

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
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  not_in_sale: {
    text: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800/60",
  },
  not_yet_in_sale: {
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
};

function AvailabilityStatusBadge({ status }: { status: AvailabilityStatus }) {
  const styles = AVAILABILITY_STATUS_STYLES[status];
  const label = AVAILABILITY_STATUS_LABELS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
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
          "group w-full space-y-1 py-1.5 text-left",
          onClick && count > 0 && "cursor-pointer rounded-md px-2 -mx-2 hover:bg-gray-100/80 dark:hover:bg-gray-800/40",
          count === 0 && "cursor-not-allowed opacity-40"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-gray-700 dark:text-gray-300">{label}</span>
          <span className={cn("text-[13px] font-semibold tabular-nums", colorClass)}>{count}</span>
        </div>
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-800/70">
          <div
            className={cn("h-full rounded-full", bgColorClass)}
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
        "group w-full space-y-1.5 py-2 text-left rounded-md px-2.5 -mx-2.5",
        onClick && count > 0 && "cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/40",
        isSelected && "bg-gray-100 ring-1 ring-gray-300 dark:bg-gray-800/60 dark:ring-gray-700",
        count === 0 && "cursor-not-allowed opacity-40"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-[13px]",
          isSelected ? "font-medium text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
        )}>{label}</span>
        <div className="flex items-center gap-2.5">
          <span className={cn(
            "text-[13px] font-semibold tabular-nums",
            colorClass
          )}>{count}</span>
          <span className="w-12 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-500">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-800/70">
        <div
          className={cn("h-full rounded-full", bgColorClass)}
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
          label: "Критично (>6 мес)",
          count: data.veryOld,
          colorClass: "text-red-600 dark:text-red-400",
          bgColorClass: "bg-red-500 dark:bg-red-500",
        },
        {
          category: "old" as const,
          label: "Устарело (1-6 мес)",
          count: data.old,
          colorClass: "text-orange-600 dark:text-orange-400",
          bgColorClass: "bg-orange-500 dark:bg-orange-500",
        },
        {
          category: "aging" as const,
          label: "Устаревает (2-4 нед)",
          count: data.aging,
          colorClass: "text-amber-600 dark:text-amber-400",
          bgColorClass: "bg-amber-500 dark:bg-amber-500",
        },
        {
          category: "fresh" as const,
          label: "Свежие (до 14 дн)",
          count: data.fresh,
          colorClass: "text-emerald-600 dark:text-emerald-400",
          bgColorClass: "bg-emerald-500 dark:bg-emerald-500",
        },
      ]
    : [];

  const handleOpenDevice = (deviceId: string) => {
    window.open(`/dashboard/devices/${deviceId}`, "_blank");
  };

  return (
    <Widget
      title="Обновление цен"
      subtitle={data ? `${data.total} устр.` : undefined}
      loading={isLoading}
      error={error?.message}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      className={className}
      headerAction={
        <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
      }
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
            colorClass="text-gray-500 dark:text-gray-500"
            bgColorClass="bg-gray-400 dark:bg-gray-600"
            expanded={expanded}
            onClick={() => handleCategoryClick("notSelling")}
            isSelected={selectedCategory === "notSelling"}
            category="notSelling"
          />
        )}

        {!expanded && (
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600">
              Всего
            </span>
            <span className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {data?.total ?? 0}
            </span>
          </div>
        )}

        {/* Device List Table */}
        {expanded && selectedCategory && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
                Устройства ({devicesData?.length ?? 0})
              </h3>
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
              >
                Скрыть
              </button>
            </div>

            {isLoadingDevices ? (
              <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-500">
                Загрузка...
              </div>
            ) : devicesData && devicesData.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
                <div className="scrollbar max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-[hsl(0_0%_7%)]">
                      <tr>
                        <th className="w-10 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                          #
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                          Устройство
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                          Статус
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                          Цены
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                      {devicesData.map((device, index) => {
                        const isUpdating = updatingDeviceId === device.id;

                        return (
                          <ContextMenu key={device.id}>
                            <ContextMenuTrigger asChild>
                              <tr
                                onClick={() => handleOpenDevice(device.id)}
                                className={cn(
                                  "group cursor-pointer",
                                  isUpdating
                                    ? "bg-blue-50/50 dark:bg-blue-950/20"
                                    : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                                )}
                              >
                                <td className="px-2 py-2 text-center">
                                  <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-600">
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                                      {device.hasProfile ? (
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Профиль заполнен" />
                                      ) : (
                                        <div className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-700" title="Профиль не заполнен" />
                                      )}
                                    </div>
                                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                      {device.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <AvailabilityStatusBadge status={device.availabilityStatus} />
                                    {isUpdating && (
                                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
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
                {/* Gradient fade for scroll indication */}
                <div className="pointer-events-none relative h-0">
                  <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent dark:from-[hsl(0_0%_9%)]" />
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-gray-500 dark:text-gray-500">
                Нет устройств
              </div>
            )}
          </div>
        )}
      </div>
    </Widget>
  );
}
