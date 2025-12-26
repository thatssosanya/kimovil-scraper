import { Widget } from "../Widget";
import { api } from "@/src/utils/api";
import { cn } from "@/src/lib/utils";
import { formatRelativeTime } from "@/src/utils/utils";
import type { ManagedWidgetProps } from "../types";
import Link from "next/link";

export function RatingsOverviewWidget({ className, expanded, onToggleExpand }: ManagedWidgetProps) {
  const { data, isLoading, error } =
    api.dashboardWidgets.getRatingsPagesOverview.useQuery();

  if (!data && !isLoading) {
    return null;
  }

  return (
    <Widget
      title="Страницы рейтингов"
      loading={isLoading}
      error={error?.message}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      className={cn(expanded && "md:col-span-2", className)}
    >
      <div className="space-y-3">
        {data?.pages.map((page) => (
          <div key={page.id} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium dark:text-gray-200">{page.name}</h3>
              {expanded && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Обновлено {formatRelativeTime(page.updatedAt)}
                </span>
              )}
            </div>

            {expanded ? (
              <div className="ml-3 space-y-0.5 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                {page.groups.map((group, index) => {
                  const isLast = index === page.groups.length - 1;
                  return (
                    <div
                      key={group.id}
                      className="flex items-baseline justify-between text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {isLast ? "└─" : "├─"} {group.name} ({group.ratingCount}{" "}
                        {group.ratingCount === 1 ? "рейтинг" : "рейтинга"})
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(group.lastUpdate)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {page.groups.length} {page.groups.length === 1 ? "группа" : "групп"} •{" "}
                {formatRelativeTime(page.updatedAt)}
              </p>
            )}
          </div>
        ))}

        <div className="mt-3 pt-3 border-t dark:border-gray-800">
          <Link
            href="/dashboard/ratings"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
          >
            <span>Всего {data?.totalPages ?? 0} страниц • Смотреть все →</span>
          </Link>
        </div>
      </div>
    </Widget>
  );
}
