import { memo } from "react";
import type { Table } from "@tanstack/react-table";

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

export const DataTableViewOptions = memo(function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  const hiddenColumns = table
    .getAllColumns()
    .filter((column) => !column.getIsVisible() && column.getCanHide());

  if (!hiddenColumns.length) return null;

  return (
    <div className="flex items-center gap-2">
      {hiddenColumns.map((column) => (
        <button
          key={column.id}
          onClick={() => column.toggleVisibility()}
          className="inline-flex h-7 items-center rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-[hsl(0_0%_9%)] dark:text-gray-200 dark:hover:bg-[hsl(0_0%_12%)] dark:border dark:border-gray-800"
        >
          {column.id}
        </button>
      ))}
    </div>
  );
}) as <TData>(props: DataTableViewOptionsProps<TData>) => JSX.Element | null;
