import { Widget } from "../Widget";
import { api } from "@/src/utils/api";
import { cn } from "@/src/lib/utils";
import type { ManagedWidgetProps } from "../types";
import { FileText } from "lucide-react";

interface ProgressBarProps {
  label: string;
  value: number;
  total: number;
  bgColor: string;
  showPercentage?: boolean;
  compact?: boolean;
}

function ProgressBar({
  label,
  value,
  total,
  bgColor,
  showPercentage = true,
  compact = false,
}: ProgressBarProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const barWidth = Math.round(percentage);

  if (compact) {
    return (
      <div className="space-y-1 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-gray-700 dark:text-gray-300">{label}</span>
          <span className="text-[13px] font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {value}<span className="font-normal text-gray-400 dark:text-gray-600">/{total}</span>
          </span>
        </div>
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-800/70">
          <div
            className={cn("h-full rounded-full", bgColor)}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-gray-700 dark:text-gray-300">{label}</span>
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {value}<span className="font-normal text-gray-400 dark:text-gray-600">/{total}</span>
          </span>
          {showPercentage && (
            <span className="w-12 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-500">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-800/70">
        <div
          className={cn("h-full rounded-full", bgColor)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

const completionLabels = {
  poor: "Плохо",
  fair: "Удовлетворительно",
  good: "Хорошо",
  excellent: "Отлично",
};

const completionColors = {
  poor: "text-red-500 dark:text-red-400",
  fair: "text-orange-500 dark:text-orange-400",
  good: "text-emerald-500 dark:text-emerald-400",
  excellent: "text-blue-500 dark:text-blue-400",
};

export function CharacteristicsWidget({ className, expanded, onToggleExpand }: ManagedWidgetProps) {
  const { data, isLoading, error } =
    api.dashboardWidgets.getCharacteristicsCoverage.useQuery();

  const coveragePercent = data && data.totalDevices > 0
    ? Math.round((data.withCharacteristics / data.totalDevices) * 100)
    : 0;

  return (
    <Widget
      title="Характеристики"
      subtitle={data ? `${coveragePercent}% покрытие` : undefined}
      loading={isLoading}
      error={error?.message}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      className={className}
      headerAction={
        <FileText className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
      }
    >
      {data && (
        <div className={cn(expanded ? "space-y-4" : "space-y-0.5")}>
          {!expanded ? (
            <>
              <ProgressBar
                label="Покрытие"
                value={data.withCharacteristics}
                total={data.totalDevices}
                bgColor="bg-blue-500"
                showPercentage={false}
                compact
              />
              <ProgressBar
                label="Опубликовано"
                value={data.published}
                total={data.withCharacteristics}
                bgColor="bg-emerald-500"
                showPercentage={false}
                compact
              />
              <ProgressBar
                label="Черновик"
                value={data.draft}
                total={data.withCharacteristics}
                bgColor="bg-amber-500"
                showPercentage={false}
                compact
              />
            </>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
                  Покрытие
                </h3>
                <div className="space-y-0.5">
                  <ProgressBar
                    label="С характеристиками"
                    value={data.withCharacteristics}
                    total={data.totalDevices}
                    bgColor="bg-blue-500"
                  />
                  <ProgressBar
                    label="Без данных"
                    value={data.withoutCharacteristics}
                    total={data.totalDevices}
                    bgColor="bg-gray-400 dark:bg-gray-600"
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
                  По статусу
                </h3>
                <div className="space-y-0.5">
                  <ProgressBar
                    label="Опубликовано"
                    value={data.published}
                    total={data.withCharacteristics}
                    bgColor="bg-emerald-500"
                  />
                  <ProgressBar
                    label="Черновик"
                    value={data.draft}
                    total={data.withCharacteristics}
                    bgColor="bg-amber-500"
                  />
                </div>
              </div>
            </>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600">
              {expanded ? "Оценка" : "Статус"}
            </span>
            <span
              className={cn(
                "text-[13px] font-semibold",
                completionColors[data.completionRating]
              )}
            >
              {completionLabels[data.completionRating]}
            </span>
          </div>
        </div>
      )}
    </Widget>
  );
}
