import { useCallback } from "react";
import { flexRender } from "@tanstack/react-table";
import { Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../Table";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "../../../ContextMenu";
import type { DataTableContentProps } from "../../types";

function booleanToString(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "true" : undefined;
}

function hasId(obj: unknown): obj is { id: string } {
  return typeof obj === "object" && obj !== null && "id" in obj;
}

function LoadingRow({
  colSpan,
  showProgress = false,
}: {
  colSpan: number;
  showProgress?: boolean;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin dark:text-gray-500" />
          <span className="dark:text-gray-500">
            {showProgress ? "Загрузка дополнительных данных..." : "Загрузка..."}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center dark:text-gray-500"
      >
        Нет результатов
      </TableCell>
    </TableRow>
  );
}

export function DataTableContent<TData>({
  table,
  isLoading,
  selectedId,
  onRowClick,
  children,
  scrollContainerRef,
  contextMenuRender,
}: DataTableContentProps<TData>) {
  const rowModel = table.getRowModel();
  const headerGroups = table.getHeaderGroups();
  const columns = table.getAllColumns();

  const handleRowClick = useCallback(
    (row: TData) => {
      onRowClick?.(row);
    },
    [onRowClick]
  );

  return (
    <div className="relative flex flex-1 min-h-0 flex-shrink-0 flex-col overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="scrollbar flex-1 min-h-0 flex-shrink-0 overflow-auto"
      >
        <Table className="w-full dark:bg-[hsl(0_0%_8%)]">
          <TableHeader className="sticky top-0 z-20 border-b border-gray-200 bg-gray-100/95 backdrop-blur supports-[backdrop-filter]:bg-gray-100/80 dark:border-gray-800 dark:bg-[hsl(0_0%_11%)]/90">
            {headerGroups.map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap",
                      header.id === "select" && "w-[48px] p-0",
                      header.id === "type-icon" &&
                        "w-[40px] min-w-[40px] max-w-[40px] px-0",
                      header.column.id === "name" && "w-[35%]",
                      header.column.id === "type" && "w-[120px]",
                      header.column.id === "links" && "w-[140px]",
                      header.column.id === "valueRating" && "w-[60px]",
                      header.column.id === "prosConsCount" && "w-[100px]",
                      header.column.id === "createdAt" && "w-[120px]"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && !rowModel.rows?.length ? (
              <LoadingRow colSpan={columns.length} />
            ) : rowModel.rows?.length ? (
              rowModel.rows.map((row) => {
                const rowContent = (
                  <TableRow
                    key={row.id}
                    data-state={booleanToString(row.getIsSelected())}
                    className={cn(
                      "group/row cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/20",
                      {
                        "bg-muted/50 dark:bg-gray-700/40":
                          hasId(row.original) && row.original.id === selectedId,
                        "bg-blue-50 hover:bg-blue-100/70 dark:bg-gray-700/40 dark:hover:bg-gray-700/30":
                          row.getIsSelected(),
                      }
                    )}
                    onClick={() => handleRowClick(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "align-middle",
                          cell.column.id === "select" && "relative w-[48px] p-0",
                          cell.column.id === "type-icon" &&
                            "w-[40px] min-w-[40px] max-w-[40px] px-0"
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );

                // If contextMenuRender is provided, wrap the row with context menu
                if (contextMenuRender) {
                  return (
                    <ContextMenu key={row.id}>
                      <ContextMenuTrigger asChild>
                        {rowContent}
                      </ContextMenuTrigger>
                      {contextMenuRender(row.original)}
                    </ContextMenu>
                  );
                }

                return rowContent;
              })
            ) : (
              <EmptyRow colSpan={columns.length} />
            )}
            {/* Bottom loading feedback is rendered as a sticky status bar by the parent via children */}
          </TableBody>
        </Table>
        {children}
      </div>
    </div>
  );
}
