import { Widget } from "../Widget";
import { api } from "@/src/utils/api";
import { cn } from "@/src/lib/utils";
import type { ManagedWidgetProps } from "../types";

interface ProgressBarProps {
  label: string;
  value: number;
  total: number;
  colorClass: string;
  bgGradient: string;
  showPercentage?: boolean;
  compact?: boolean;
}

function ProgressBar({
  label,
  value,
  total,
  colorClass: _colorClass,
  bgGradient,
  showPercentage = true,
  compact = false,
}: ProgressBarProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const barWidth = Math.round(percentage);

  if (compact) {
    return (
      <div className="group space-y-1.5 py-1">
        <div className="flex items-center justify-between">
          <span className="text-sm dark:text-gray-300">{label}</span>
          <span className="text-sm font-semibold tabular-nums dark:text-gray-200">
            {value}/{total}
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800/50">
          <div
            className={cn("h-full rounded-full transition-all duration-500", bgGradient)}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group space-y-2 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium dark:text-gray-200">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tabular-nums dark:text-gray-200">
            {value}/{total}
          </span>
          {showPercentage && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-14 text-right tabular-nums">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800/50">
        <div
          className={cn("h-full rounded-full transition-all duration-500", bgGradient)}
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
  poor: "text-red-600 dark:text-red-400",
  fair: "text-orange-600 dark:text-orange-400",
  good: "text-emerald-600 dark:text-emerald-400",
  excellent: "text-blue-600 dark:text-blue-400",
};

export function CharacteristicsWidget({ className, expanded, onToggleExpand }: ManagedWidgetProps) {
  const { data, isLoading, error } =
    api.dashboardWidgets.getCharacteristicsCoverage.useQuery();

  return (
    <Widget
      title="Характеристики"
      loading={isLoading}
      error={error?.message}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      className={cn(expanded && "md:col-span-2", className)}
    >
      {data && (
        <div className={cn(expanded ? "space-y-4" : "space-y-1")}>
          {!expanded ? (
            <>
              <ProgressBar
                label="Покрытие"
                value={data.withCharacteristics}
                total={data.totalDevices}
                colorClass="text-blue-600 dark:text-blue-400"
                bgGradient="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500"
                showPercentage={false}
                compact
              />

              <ProgressBar
                label="Опубликовано"
                value={data.published}
                total={data.withCharacteristics}
                colorClass="text-emerald-600 dark:text-emerald-400"
                bgGradient="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500"
                showPercentage={false}
                compact
              />

              <ProgressBar
                label="Черновик"
                value={data.draft}
                total={data.withCharacteristics}
                colorClass="text-yellow-600 dark:text-yellow-400"
                bgGradient="bg-gradient-to-r from-yellow-500 to-yellow-600 dark:from-yellow-400 dark:to-yellow-500"
                showPercentage={false}
                compact
              />
            </>
          ) : (
            <>
              <div>
                <h3 className="mb-3 text-sm font-semibold dark:text-gray-200">
                  Обзор покрытия
                </h3>
                <div className="space-y-1">
                  <ProgressBar
                    label="С характеристиками"
                    value={data.withCharacteristics}
                    total={data.totalDevices}
                    colorClass="text-blue-600 dark:text-blue-400"
                    bgGradient="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500"
                  />
                  <ProgressBar
                    label="Отсутствуют данные"
                    value={data.withoutCharacteristics}
                    total={data.totalDevices}
                    colorClass="text-gray-600 dark:text-gray-400"
                    bgGradient="bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-500 dark:to-gray-600"
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold dark:text-gray-200">
                  Распределение по статусу
                </h3>
                <div className="space-y-1">
                  <ProgressBar
                    label="Опубликовано"
                    value={data.published}
                    total={data.withCharacteristics}
                    colorClass="text-emerald-600 dark:text-emerald-400"
                    bgGradient="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500"
                  />
                  <ProgressBar
                    label="Черновик"
                    value={data.draft}
                    total={data.withCharacteristics}
                    colorClass="text-yellow-600 dark:text-yellow-400"
                    bgGradient="bg-gradient-to-r from-yellow-500 to-yellow-600 dark:from-yellow-400 dark:to-yellow-500"
                  />
                </div>
              </div>
            </>
          )}

          <div className={cn("pt-3 border-t dark:border-gray-800", expanded ? "mt-4" : "mt-3")}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {expanded ? "Общая оценка:" : "Статус:"}
              </span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  completionColors[data.completionRating]
                )}
              >
                {completionLabels[data.completionRating]}
              </span>
            </div>
          </div>
        </div>
      )}
    </Widget>
  );
}
