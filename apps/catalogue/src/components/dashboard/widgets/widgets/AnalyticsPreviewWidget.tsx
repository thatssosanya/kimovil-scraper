import { Widget } from "../Widget";
import { api } from "@/src/utils/api";
import { cn } from "@/src/lib/utils";
import type { ManagedWidgetProps } from "../types";

interface PlaceholderLineProps {
  label: string;
}

function PlaceholderLine({ label }: PlaceholderLineProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex-1 ml-4 h-1 bg-gray-200 dark:bg-gray-700 rounded-full opacity-30" />
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
      loading={isLoading}
      error={error?.message}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      className={cn(expanded && "md:col-span-2", className)}
    >
      <div className="space-y-2">
        {metrics.map((metric) => (
          <PlaceholderLine key={metric} label={metric} />
        ))}

        <div className="pt-3 mt-3 border-t dark:border-gray-800">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {expanded ? (
                <>
                  <span className="font-medium">Аналитика скоро будет доступна</span>
                  <br />
                  <span className="text-xs">
                    Планируется интеграция с WordPress API
                  </span>
                </>
              ) : (
                "Скоро"
              )}
            </p>
          </div>
        </div>
      </div>
    </Widget>
  );
}
