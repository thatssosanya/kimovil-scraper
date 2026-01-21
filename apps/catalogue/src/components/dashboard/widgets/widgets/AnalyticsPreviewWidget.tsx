import { Widget } from "../Widget";
import { api } from "@/src/utils/api";
import { cn } from "@/src/lib/utils";
import type { ManagedWidgetProps } from "../types";
import { Activity, TrendingUp } from "lucide-react";

interface PlaceholderLineProps {
  label: string;
}

function PlaceholderLine({ label }: PlaceholderLineProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-gray-500 dark:text-gray-500">{label}</span>
      <div className="ml-4 h-0.5 flex-1 rounded-full bg-gray-200/60 dark:bg-gray-800/60" />
    </div>
  );
}

export function AnalyticsPreviewWidget({ className, expanded, onToggleExpand }: ManagedWidgetProps) {
  const { isLoading, error } =
    api.dashboardWidgets.getAnalyticsPreview.useQuery();

  const basicMetrics = [
    "Просмотры страниц",
    "Клики по виджетам",
    "Популярные устройства",
    "Поисковые запросы",
  ];

  const expandedMetrics = [
    "Просмотры страниц",
    "Показы виджетов",
    "Кликабельность",
    "Лучшие устройства",
    "Поисковые запросы",
  ];

  const metrics = expanded ? expandedMetrics : basicMetrics;

  return (
    <Widget
      title="Аналитика"
      subtitle="WIP"
      loading={isLoading}
      error={error?.message}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      className={className}
      headerAction={
        <Activity className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
      }
    >
      <div className="space-y-0.5">
        {metrics.map((metric) => (
          <PlaceholderLine key={metric} label={metric} />
        ))}

        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className={cn(
            "flex items-start gap-2.5 rounded-md px-3 py-2.5",
            "bg-blue-50/70 dark:bg-blue-950/30"
          )}>
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500 dark:text-blue-400" />
            <div>
              <p className="text-[13px] font-medium text-blue-700 dark:text-blue-300">
                {expanded ? "Аналитика скоро" : "Скоро"}
              </p>
              {expanded && (
                <p className="mt-0.5 text-[11px] text-blue-600/70 dark:text-blue-400/60">
                  Интеграция с WordPress API
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Widget>
  );
}
