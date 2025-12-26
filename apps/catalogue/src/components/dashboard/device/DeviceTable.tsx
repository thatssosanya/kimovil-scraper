import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/src/components/ui/data-table";
import {
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useReducer,
  useState,
  type MouseEvent,
} from "react";
import {
  ArrowUp,
  ArrowDown,
  Smartphone,
  Tv,
  Laptop,
  Tablet,
  Gamepad2,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { PriceRangeChip } from "./PriceRangeChip";
import { JobStatusBadge } from "@/src/components/shared/status";
import { cn } from "@/src/lib/utils";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/src/components/ui/ContextMenu";
import { ExternalLink, Trash2, Search, ListChecks, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/src/utils/api";

import { useJobStatus } from "@/src/components/dashboard/scraping/hooks/useJobStatus";
import { useDeviceScraping } from "@/src/components/dashboard/device/hooks/useDeviceScraping";
import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@/src/server/api/root";

type AvailabilityStatus = "selling" | "not_in_sale" | "not_yet_in_sale";

const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  selling: "Продается",
  not_in_sale: "Нет в продаже",
  not_yet_in_sale: "Еще нет в продаже",
};



export type DeviceWithRelations = NonNullable<
  inferRouterOutputs<AppRouter>["device"]["getAllDevices"]
>["items"][number];

interface DeviceTableProps {
  deviceList?: DeviceWithRelations[];
  totalCount?: number;
  filteredCount?: number;
  handleDeviceSelect: (id?: string) => void;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => Promise<void>;
  onSearch?: (search: string) => void;
  activeFilters?: string[];
  onFilterChange?: (filters: string[]) => void;
  onDelete?: (deviceIds: string[]) => Promise<void>;
  isDeleting?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (
    columnId: string,
    sortOrder: "asc" | "desc" | undefined
  ) => void;
}

// Filters are now handled server-side

const deviceTypeIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  Смартфон: Smartphone,
  Телевизор: Tv,
  "Портативная приставка": Gamepad2,
  Ноутбук: Laptop,
  Планшет: Tablet,
};

const DeviceTable = ({
  deviceList = [],
  totalCount,
  filteredCount,
  handleDeviceSelect,
  isLoading: isLoadingProp,
  isFetchingNextPage,
  hasMore,
  onLoadMore,
  activeFilters: _activeFilters = [],
  onDelete,
  isDeleting,
  sortBy,
  sortOrder,
  onSortChange,
}: DeviceTableProps) => {
  // Create ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedIds, dispatch] = useReducer(
    (state: string[], action: { type: string; payload: string[] }) => {
      switch (action.type) {
        case "SET_SELECTED":
          return action.payload;
        case "CLEAR_SELECTION":
          return [];
        default:
          return state;
      }
    },
    []
  );
  const [updatingDeviceId, setUpdatingDeviceId] = useState<string | null>(null);

  const utils = api.useUtils();
  const clearSelectionRef = useRef<(() => void) | undefined>();
  const lastSelectedRowIndex = useRef<number | null>(null);
  const { hasProfileSet, isLoadingStatus, jobsMap } = useJobStatus();

  // Use the scraping hook
  const { handleQueueParsing, isProcessing: isScraping } =
    useDeviceScraping(deviceList);

  // Availability status update mutation
  const updateAvailabilityStatus = api.device.updateDeviceAvailabilityStatus.useMutation({
    onSuccess: (_data, variables) => {
      const statusLabel = AVAILABILITY_STATUS_LABELS[variables.status];
      toast.success("Статус обновлен", {
        description: `Статус устройства изменен на "${statusLabel}"`,
      });
      void utils.device.getAllDevices.invalidate();
      setUpdatingDeviceId(null);
    },
    onError: (error) => {
      toast.error("Ошибка", {
        description: error.message || "Не удалось обновить статус устройства",
      });
      setUpdatingDeviceId(null);
    },
  });

  // Memoize table data to prevent unnecessary re-renders
  const tableData = useMemo(() => deviceList, [deviceList]);

  // Memoize row click handler
  const handleRowClick = useCallback(
    (device: DeviceWithRelations) => {
      handleDeviceSelect(device.id);
    },
    [handleDeviceSelect]
  );

  // Update row selection handler to work with IDs
  const handleRowSelectionChange = useCallback(
    (selected: DeviceWithRelations[]) => {
      dispatch({ type: "SET_SELECTED", payload: selected.map((d) => d.id) });
    },
    []
  );

  // Clear selection handler
  const handleClearSelection = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION", payload: [] });
    // Also clear the table's internal selection state
    if (clearSelectionRef.current) {
      clearSelectionRef.current();
    }
  }, []);

  // Context menu actions
  const handleSingleDeviceParse = useCallback(async (device: DeviceWithRelations) => {
    await handleQueueParsing([device.id]);
  }, [handleQueueParsing]);

  const handleSingleDeviceDelete = useCallback(async (device: DeviceWithRelations) => {
    if (onDelete) {
      await onDelete([device.id]);
    }
  }, [onDelete]);

  const handleOpenInNewTab = useCallback((device: DeviceWithRelations) => {
    window.open(`/dashboard/devices/${device.id}`, "_blank");
  }, []);

  const handleUpdateStatus = useCallback((deviceId: string, status: AvailabilityStatus) => {
    setUpdatingDeviceId(deviceId);
    updateAvailabilityStatus.mutate({ deviceId, status });
  }, [updateAvailabilityStatus]);

  // Context menu render function
  const renderContextMenu = useCallback((device: DeviceWithRelations) => {
    const isUpdating = updatingDeviceId === device.id;
    
    return (
      <ContextMenuContent>
        <ContextMenuItem onClick={() => handleOpenInNewTab(device)}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Открыть в новой вкладке
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={isUpdating}>
            <ListChecks className="mr-2 h-4 w-4" />
            Изменить статус
            {isUpdating && <Loader2 className="ml-2 h-3 w-3 animate-spin" />}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() => handleUpdateStatus(device.id, "selling")}
              disabled={device.availabilityStatus === "selling" || isUpdating}
            >
              Продается
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleUpdateStatus(device.id, "not_in_sale")}
              disabled={device.availabilityStatus === "not_in_sale" || isUpdating}
            >
              Нет в продаже
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleUpdateStatus(device.id, "not_yet_in_sale")}
              disabled={device.availabilityStatus === "not_yet_in_sale" || isUpdating}
            >
              Еще нет в продаже
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => handleSingleDeviceParse(device)}>
          <Search className="mr-2 h-4 w-4" />
          Парсить
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={() => handleSingleDeviceDelete(device)}
          className="text-red-600 focus:text-red-600 dark:text-red-400"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }, [handleOpenInNewTab, handleSingleDeviceParse, handleSingleDeviceDelete, handleUpdateStatus, updatingDeviceId]);

  // Memoize columns with stable reference
  const columns = useMemo<ColumnDef<DeviceWithRelations>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex h-full w-full items-center justify-center">
            <input
              type="checkbox"
              ref={(el) => {
                if (!el) return;
                el.indeterminate = table.getIsSomePageRowsSelected();
              }}
              checked={table.getIsAllPageRowsSelected()}
              onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
              aria-label="Выбрать все"
              className={cn(
                "h-4 w-4 rounded-sm border border-gray-300 accent-[hsl(354_73%_56%)] outline-none ring-0",
                "dark:border-gray-700"
              )}
            />
          </div>
        ),
        cell: ({ row, table }) => {
          const handleCheckboxClick = (event: MouseEvent<HTMLDivElement>) => {
            event.stopPropagation(); // Prevent row navigation

            const sortedRows = table.getSortedRowModel().rows;
            // Find the index of the current row within the *sorted* rows
            const currentSortedIndex = sortedRows.findIndex(
              (sortedRow) => sortedRow.id === row.id
            );

            if (currentSortedIndex === -1) {
              console.error("Could not find row in sorted model");
              return; // Should not happen
            }

            const isShiftPressed = event.shiftKey;

            if (isShiftPressed && lastSelectedRowIndex.current !== null) {
              event.preventDefault(); // Prevent default text selection
              // Use the sorted indices for range calculation
              const start = Math.min(
                lastSelectedRowIndex.current,
                currentSortedIndex
              );
              const end = Math.max(
                lastSelectedRowIndex.current,
                currentSortedIndex
              );

              // Batch update selection in a single state change
              const currentSelection = table.getState().rowSelection;
              const newSelection: Record<string, boolean> = {
                ...currentSelection,
              };
              for (let i = start; i <= end; i++) {
                const rowToSelect = sortedRows[i];
                if (rowToSelect) {
                  newSelection[rowToSelect.id] = true;
                }
              }
              table.setRowSelection(newSelection);
            } else {
              // Regular click: toggle only the clicked row (single, batched)
              const currentSelection = table.getState().rowSelection;
              const nextSelection: Record<string, boolean> = {
                ...currentSelection,
              };
              const currentlySelected = !!currentSelection[row.id];
              if (currentlySelected) {
                // Unselect by deleting the key to keep the map smaller
                delete nextSelection[row.id];
              } else {
                nextSelection[row.id] = true;
              }
              table.setRowSelection(nextSelection);
            }

            // Update the last selected index with the *sorted* index
            lastSelectedRowIndex.current = currentSortedIndex;
          };

          return (
            <div
              className="relative flex h-full min-h-[3rem] w-full select-none items-center justify-center"
              onClick={handleCheckboxClick}
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={row.getIsSelected()}
                readOnly
                className={cn(
                  "h-4 w-4 rounded-sm border border-gray-300 accent-[hsl(354_73%_56%)] outline-none ring-0 transition-opacity",
                  row.getIsSelected() ? "opacity-100" : "opacity-60 hover:opacity-100",
                  "dark:border-gray-700"
                )}
              />
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
        size: 60, // Slightly larger size for checkbox + padding
      },
      {
        id: "type-icon",
        header: () => null,
        cell: ({ row }) => {
          const deviceType = row.original.type;
          const Icon = deviceType ? deviceTypeIcons[deviceType] : null;

          return (
            <div className="flex h-full w-full items-center justify-center p-0">
              {Icon ? (
                <Icon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              ) : (
                <div className="h-4 w-4" />
              )}
            </div>
          );
        },
        size: 10,
      },
      {
        accessorKey: "name",
        size: 300, // Make name column wider
        header: () => {
          const isSorted = sortBy === "name";
          const isAsc = isSorted && sortOrder === "asc";
          return (
            <Button
              variant="ghost"
              onClick={() => {
                if (onSortChange) {
                  if (!isSorted) {
                    onSortChange("name", "asc");
                  } else if (isAsc) {
                    onSortChange("name", "desc");
                  } else {
                    onSortChange("name", undefined);
                  }
                }
              }}
              className={cn(
                "ml-6 cursor-pointer p-0 hover:bg-transparent",
                isSorted && "text-primary dark:text-primary"
              )}
            >
              Название
              {isSorted && sortOrder === "asc" && (
                <ArrowUp className="ml-2 h-4 w-4" />
              )}
              {isSorted && sortOrder === "desc" && (
                <ArrowDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: ({ row }) => {
          const deviceId = row.original.id;
          const hasProfile = hasProfileSet.has(deviceId);
          const currentJob = jobsMap.get(deviceId);
          const duplicateStatus = row.original.duplicateStatus;
          const isPotentialDuplicate = duplicateStatus === "potential";
          const isConfirmedDuplicate = duplicateStatus === "duplicate";

          return (
            <div className="flex items-center gap-2">
              <div className="flex w-4 items-center justify-center">
                <JobStatusBadge
                  deviceId={deviceId}
                  hasProfile={hasProfile}
                  isLoading={isLoadingStatus}
                  currentJob={currentJob}
                />
              </div>
              <span className="text-base font-semibold dark:text-gray-100">
                {row.original.name}
              </span>
              {(isPotentialDuplicate || isConfirmedDuplicate) && (
                <span
                  title={isPotentialDuplicate ? "Потенциальный дубликат" : "Подтверждённый дубликат"}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    isPotentialDuplicate
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  <Copy className="h-2.5 w-2.5" />
                  {isPotentialDuplicate ? "?" : "Дубль"}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "type",
        header: () => {
          const isSorted = sortBy === "type";
          const isAsc = isSorted && sortOrder === "asc";
          return (
            <Button
              variant="ghost"
              onClick={() => {
                if (onSortChange) {
                  if (!isSorted) {
                    onSortChange("type", "asc");
                  } else if (isAsc) {
                    onSortChange("type", "desc");
                  } else {
                    onSortChange("type", undefined);
                  }
                }
              }}
              className={cn(
                "cursor-pointer p-0 hover:bg-transparent",
                isSorted && "text-primary dark:text-primary"
              )}
            >
              Тип
              {isSorted && sortOrder === "asc" && (
                <ArrowUp className="ml-2 h-4 w-4" />
              )}
              {isSorted && sortOrder === "desc" && (
                <ArrowDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: ({ row }) => (
          <div>
            <span className="text-muted-foreground text-xs dark:text-gray-500">
              {row.original.type || "Без типа"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "links",
        header: "Цены",
        cell: ({ row }) => (
          <div>
            <PriceRangeChip links={row.original.links} />
          </div>
        ),
      },
      {
        accessorKey: "valueRating",
        size: 80, // Make rating column narrower
        header: () => {
          const isSorted = sortBy === "valueRating";
          const isAsc = isSorted && sortOrder === "asc";
          return (
            <Button
              variant="ghost"
              onClick={() => {
                if (onSortChange) {
                  if (!isSorted) {
                    onSortChange("valueRating", "asc");
                  } else if (isAsc) {
                    onSortChange("valueRating", "desc");
                  } else {
                    onSortChange("valueRating", undefined);
                  }
                }
              }}
              className={cn(
                "cursor-pointer p-0 hover:bg-transparent",
                isSorted && "text-primary dark:text-primary"
              )}
            >
              Ц/К
              {isSorted && sortOrder === "asc" && (
                <ArrowUp className="ml-2 h-4 w-4" />
              )}
              {isSorted && sortOrder === "desc" && (
                <ArrowDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: ({ row }) => {
          const valueRating = row.original.valueRating;

          const getValueRatingColor = (value: number) => {
            if (value >= 90) return "text-green-600 dark:text-green-400";
            if (value >= 80) return "text-blue-600 dark:text-blue-400";
            if (value >= 70) return "text-blue-600 dark:text-blue-400";
            if (value >= 60) return "text-blue-600 dark:text-blue-400";
            if (value >= 40) return "text-orange-600 dark:text-orange-400";
            return "text-red-600 dark:text-red-400";
          };

          return (
            <div>
              {valueRating != null ? (
                <span
                  className={cn(
                    "text-base font-semibold",
                    getValueRatingColor(valueRating)
                  )}
                >
                  {valueRating}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs dark:text-gray-500">
                  —
                </span>
              )}
            </div>
          );
        },
        sortingFn: "basic",
      },
      {
        id: "prosConsCount",
        accessorFn: (row) => row.prosCons?.length ?? 0,
        header: () => {
          const isSorted = sortBy === "prosConsCount";
          const isAsc = isSorted && sortOrder === "asc";
          return (
            <Button
              variant="ghost"
              onClick={() => {
                if (onSortChange) {
                  if (!isSorted) {
                    onSortChange("prosConsCount", "asc");
                  } else if (isAsc) {
                    onSortChange("prosConsCount", "desc");
                  } else {
                    onSortChange("prosConsCount", undefined);
                  }
                }
              }}
              className={cn(
                "cursor-pointer p-0 hover:bg-transparent",
                isSorted && "text-primary dark:text-primary"
              )}
            >
              Плюсы/Минусы
              {isSorted && sortOrder === "asc" && (
                <ArrowUp className="ml-2 h-4 w-4" />
              )}
              {isSorted && sortOrder === "desc" && (
                <ArrowDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: ({ row }) => {
          const count = row.original.prosCons?.length;

          return (
            <div>
              {count != null && count > 0 ? (
                <span className="text-base font-semibold dark:text-gray-100">
                  {count}
                </span>
              ) : null}
            </div>
          );
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "createdAt",
        header: () => {
          const isSorted = sortBy === "createdAt";
          const isAsc = isSorted && sortOrder === "asc";
          return (
            <Button
              variant="ghost"
              onClick={() => {
                if (onSortChange) {
                  if (!isSorted) {
                    onSortChange("createdAt", "asc");
                  } else if (isAsc) {
                    onSortChange("createdAt", "desc");
                  } else {
                    onSortChange("createdAt", undefined);
                  }
                }
              }}
              className={cn(
                "cursor-pointer p-0 hover:bg-transparent",
                isSorted && "text-primary dark:text-primary"
              )}
            >
              Дата создания
              {isSorted && sortOrder === "asc" && (
                <ArrowUp className="ml-2 h-4 w-4" />
              )}
              {isSorted && sortOrder === "desc" && (
                <ArrowDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: ({ row }) => (
          <div>
            <span className="text-muted-foreground text-sm dark:text-gray-500">
              {new Date(row.original.createdAt).toLocaleDateString()}
            </span>
          </div>
        ),
      },
    ],
    [
      hasProfileSet,
      isLoadingStatus,
      jobsMap,
      sortBy,
      sortOrder,
      onSortChange,
    ]
  );

  // Scroll-based loading effect
  useEffect(() => {
    if (!hasMore || isLoadingProp || !onLoadMore) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      console.warn("Scroll container ref not available");
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

      // Trigger when user is 200px from the bottom
      if (
        scrollHeight - scrollTop - clientHeight < 200 &&
        !isFetchingNextPage
      ) {
        void onLoadMore();
      }
    };

    // Debounce scroll events
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
  }, [hasMore, isLoadingProp, isFetchingNextPage, onLoadMore]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <DataTable<DeviceWithRelations>
          data={tableData}
          columns={columns}
          onRowClick={handleRowClick}
          isLoading={isLoadingProp}
          selectable
          onSelectionChange={handleRowSelectionChange}
          searchable={false}
          clearSelectionRef={clearSelectionRef}
          scrollContainerRef={scrollContainerRef}
          contextMenuRender={renderContextMenu}
        >
          {/* Enhanced bottom status: spacer + sticky bar */}
          <>
            {/* Spacer so the sticky bar doesn't overlap the last rows */}
            {hasMore && !isLoadingProp && (
              <div className="h-12" aria-hidden="true" />
            )}

            {/* Sticky bottom status bar inside the scroll container */}
            <div className="sticky bottom-0 z-20">
              <div className="pointer-events-none absolute inset-x-0 -top-4 h-4 bg-gradient-to-t from-gray-50 to-transparent dark:from-[hsl(0_0%_9%)]" />
              <div className="border-t border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 dark:border-gray-800 dark:bg-[hsl(0_0%_9%)] dark:text-gray-300">
                <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                  {/* Counts: filtered / total */}
                  <div className="flex items-center gap-2 text-xs">
                    {typeof filteredCount !== "undefined" && typeof totalCount !== "undefined" ? (
                      filteredCount === totalCount ? (
                        <span className="text-muted-foreground dark:text-gray-500">Всего: <span className="font-semibold text-foreground dark:text-gray-300">{totalCount}</span></span>
                      ) : (
                        <span className="text-muted-foreground dark:text-gray-500">Показано: <span className="font-semibold text-foreground dark:text-gray-300">{filteredCount}</span> / {totalCount}</span>
                      )
                    ) : null}
                  </div>

                  {/* Selection summary and actions (inline when selected) */}
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground dark:text-gray-200"><span className="font-medium">{selectedIds.length}</span> выбрано</span>
                      <button
                        className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60"
                        onClick={handleClearSelection}
                        title="Снять выделение"
                      >
                        <X className="h-3.5 w-3.5" />
                        Снять выделение
                      </button>
                      <button
                        className="inline-flex h-6 items-center gap-1 rounded-md border px-2 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800/60"
                        onClick={() => void handleQueueParsing(selectedIds)}
                        disabled={isScraping}
                        title="Парсить выделенные"
                      >
                        {isScraping ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <ListChecks className="h-3.5 w-3.5" />
                        )}
                        Парсить
                      </button>
                      {onDelete && (
                        <button
                          className="inline-flex h-6 items-center gap-1 rounded-md border px-2 hover:bg-red-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
                          onClick={() => void onDelete(selectedIds)}
                          disabled={isDeleting}
                          title="Удалить выделенные"
                        >
                          {isDeleting ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Удалить
                        </button>
                      )}
                    </div>
                  )}

                  {/* Right side: load more state */}
                  <div className="ml-auto h-6 flex items-center">
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
};

export default DeviceTable;
