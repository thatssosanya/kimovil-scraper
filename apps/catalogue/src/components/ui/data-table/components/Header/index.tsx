import { memo } from "react";
import type { DataTableHeaderProps } from "../../types";
import { DataTableSearch } from "./Search";
import { DataTableViewOptions } from "./ViewOptions";

export const DataTableHeader = memo(function DataTableHeader<TData>({
  table,
  searchPlaceholder,
  toolbarContent,
  onSearch,
}: DataTableHeaderProps<TData>) {
  const globalFilter = table.getState().globalFilter as string | undefined;

  return (
    <div className="flex items-center justify-between px-6 pb-4">
      <div className="flex flex-1 items-center space-x-4">
        {onSearch && (
          <DataTableSearch
            value={globalFilter ?? ""}
            onChange={onSearch}
            placeholder={searchPlaceholder}
          />
        )}
        {toolbarContent}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}) as <TData>(props: DataTableHeaderProps<TData>) => JSX.Element;
