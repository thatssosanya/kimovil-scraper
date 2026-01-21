import { Widget } from "../Widget";
import { api } from "@/src/utils/api";
import { cn } from "@/src/lib/utils";
import { formatRelativeTime } from "@/src/utils/utils";
import type { ManagedWidgetProps } from "../types";
import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";

export function RatingsOverviewWidget({ className, expanded, onToggleExpand }: ManagedWidgetProps) {
  const { data, isLoading, error } =
    api.dashboardWidgets.getRatingsPagesOverview.useQuery();

  if (!data && !isLoading) {
    return null;
  }

  return (
    <Widget
      title="Рейтинги"
      subtitle={data ? `${data.totalPages} стр.` : undefined}
      loading={isLoading}
      error={error?.message}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      className={className}
      headerAction={
        <BarChart3 className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
      }
    >
      <div className="space-y-2">
        {data?.pages.map((page) => (
          <div key={page.id} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{page.name}</h3>
              {expanded && (
                <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-500">
                  {formatRelativeTime(page.updatedAt)}
                </span>
              )}
            </div>

            {expanded ? (
              <div className="ml-2 space-y-0.5 border-l border-gray-200 pl-3 dark:border-gray-800">
                {page.groups.map((group, index) => {
                  const isLast = index === page.groups.length - 1;
                  return (
                    <div
                      key={group.id}
                      className="flex items-baseline justify-between py-0.5"
                    >
                      <span className="text-[13px] text-gray-600 dark:text-gray-400">
                        <span className="mr-1 text-gray-300 dark:text-gray-700">{isLast ? "└" : "├"}</span>
                        {group.name}
                        <span className="ml-1 text-gray-400 dark:text-gray-600">({group.ratingCount})</span>
                      </span>
                      <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-600">
                        {formatRelativeTime(group.lastUpdate)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-gray-500 dark:text-gray-500">
                {page.groups.length} {page.groups.length === 1 ? "группа" : "групп"} · {formatRelativeTime(page.updatedAt)}
              </p>
            )}
          </div>
        ))}

        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <Link
            href="/dashboard/ratings"
            className={cn(
              "flex items-center justify-between rounded-md px-2 py-1.5 -mx-2",
              "text-[13px] text-gray-600 dark:text-gray-400",
              "hover:bg-gray-100/80 hover:text-gray-900 dark:hover:bg-gray-800/40 dark:hover:text-gray-200"
            )}
          >
            <span>Все страницы</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Widget>
  );
}
