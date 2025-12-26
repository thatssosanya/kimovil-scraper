import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/src/components/ui/data-table";
import { useMemo, useRef, useCallback, useEffect } from "react";
import { cn } from "@/src/lib/utils";
import { Smartphone, AlertCircle, Check } from "lucide-react";
import type { ScraperDevice } from "@/src/server/api/routers/scraper-service";

interface ScraperDeviceTableProps {
  devices: ScraperDevice[];
  totalCount?: number;
  filteredCount?: number;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => Promise<void>;
  error?: string;
  stats?: {
    corrupted: number;
    valid: number;
    scraped: number;
    rawData: number;
    aiData: number;
  };
}

export function ScraperDeviceTable({
  devices,
  totalCount,
  filteredCount,
  isLoading,
  isFetchingNextPage,
  hasMore,
  onLoadMore,
  error,
  stats,
}: ScraperDeviceTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleRowClick = useCallback((device: ScraperDevice) => {
    console.log("Clicked device:", device.slug);
  }, []);

  const columns = useMemo<ColumnDef<ScraperDevice>[]>(
    () => [
      {
        id: "icon",
        header: () => null,
        cell: () => (
          <div className="flex h-full w-full items-center justify-center p-0">
            <Smartphone className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
          </div>
        ),
        size: 40,
      },
      {
        accessorKey: "name",
        header: "Название",
        size: 300,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold dark:text-gray-100">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "brand",
        header: "Бренд",
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {row.original.brand || "—"}
          </span>
        ),
      },
      {
        accessorKey: "slug",
        header: "Slug",
        cell: ({ row }) => {
          const { slug, inCatalogue } = row.original;
          return (
            <div className="flex items-center gap-1.5">
              {inCatalogue && (
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400" />
              )}
              <span
                className={cn(
                  "font-mono text-xs",
                  inCatalogue
                    ? "font-medium text-green-600 dark:text-green-400"
                    : "text-gray-500 dark:text-gray-500"
                )}
              >
                {slug}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "releaseDate",
        header: "Дата выхода",
        cell: ({ row }) => {
          const date = row.original.releaseDate;
          if (!date) return <span className="text-gray-400">—</span>;
          return (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {new Date(date).toLocaleDateString("ru-RU", {
                year: "numeric",
                month: "short",
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Добавлен",
        cell: ({ row }) => (
          <span className="text-sm text-gray-500 dark:text-gray-500">
            {new Date(row.original.createdAt * 1000).toLocaleDateString("ru-RU")}
          </span>
        ),
      },
    ],
    []
  );

  // Scroll-based loading effect
  useEffect(() => {
    if (!hasMore || isLoading || !onLoadMore) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      console.warn("Scroll container ref not available");
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

      if (
        scrollHeight - scrollTop - clientHeight < 200 &&
        !isFetchingNextPage
      ) {
        void onLoadMore();
      }
    };

    let timeoutId: NodeJS.Timeout;
    const debouncedScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };

    scrollContainer.addEventListener("scroll", debouncedScroll, {
      passive: true,
    });

    return () => {
      scrollContainer.removeEventListener("scroll", debouncedScroll);
      clearTimeout(timeoutId);
    };
  }, [hasMore, isLoading, isFetchingNextPage, onLoadMore]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-red-500">
          <AlertCircle className="h-8 w-8" />
          <span>Ошибка загрузки: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <DataTable<ScraperDevice>
          data={devices}
          columns={columns}
          onRowClick={handleRowClick}
          isLoading={isLoading}
          searchable={false}
          scrollContainerRef={scrollContainerRef}
        >
          <>
            {hasMore && !isLoading && <div className="h-12" aria-hidden="true" />}

            <div className="sticky bottom-0 z-20">
              <div className="pointer-events-none absolute inset-x-0 -top-4 h-4 bg-gradient-to-t from-gray-50 to-transparent dark:from-[hsl(0_0%_9%)]" />
              <div className="border-t border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 dark:border-gray-800 dark:bg-[hsl(0_0%_9%)] dark:text-gray-300">
                <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                  {/* Counts */}
                  <div className="flex items-center gap-4 text-xs">
                    {typeof filteredCount !== "undefined" &&
                    typeof totalCount !== "undefined" ? (
                      filteredCount === totalCount ? (
                        <span className="text-muted-foreground dark:text-gray-500">
                          Всего:{" "}
                          <span className="font-semibold text-foreground dark:text-gray-300">
                            {totalCount}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground dark:text-gray-500">
                          Показано:{" "}
                          <span className="font-semibold text-foreground dark:text-gray-300">
                            {filteredCount}
                          </span>{" "}
                          / {totalCount}
                        </span>
                      )
                    ) : null}

                    {/* Stats */}
                    {stats && (
                      <div className="flex items-center gap-3 border-l border-gray-300 pl-3 dark:border-gray-700">
                        <span>
                          AI:{" "}
                          <span className="font-medium text-violet-600 dark:text-violet-400">
                            {stats.aiData}
                          </span>
                        </span>
                        <span>
                          Raw:{" "}
                          <span className="font-medium text-cyan-600 dark:text-cyan-400">
                            {stats.rawData}
                          </span>
                        </span>
                        <span>
                          HTML:{" "}
                          <span className="font-medium text-slate-600 dark:text-slate-400">
                            {stats.scraped}
                          </span>
                        </span>
                        {stats.corrupted > 0 && (
                          <span>
                            Поврежд.:{" "}
                            <span className="font-medium text-red-600 dark:text-red-400">
                              {stats.corrupted}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side: load more state */}
                  <div className="ml-auto flex h-6 items-center">
                    {isFetchingNextPage ? (
                      <div className="flex h-6 items-center justify-center gap-2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Загружаем еще…</span>
                      </div>
                    ) : hasMore ? (
                      <button
                        className="inline-flex h-6 items-center rounded-md border px-2 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800/60"
                        onClick={() => void onLoadMore?.()}
                      >
                        Загрузить еще
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </>
        </DataTable>
      </div>
    </div>
  );
}
