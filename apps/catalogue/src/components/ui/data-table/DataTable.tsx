import { useCallback, useEffect } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { BaseTableData, DataTableProps } from "./types";
import { useTableState } from "./hooks/useTableState";
import { DataTableQuickFilters } from "./components/Filters/QuickFilter";
import { DataTableContent } from "./components/Content";

export function DataTable<TData extends BaseTableData>({
  // Required props
  data,
  columns,
  children,

  // Optional features
  filterable = true,
  sortable = true,
  selectable = false,

  // Customization
  quickFilters,

  // State
  selectedId,
  isLoading = false,

  // Callbacks
  onRowClick,
  onSelectionChange,
  onClearSelection: _onClearSelection,
  clearSelectionRef,
  scrollContainerRef,
  contextMenuRender,
}: DataTableProps<TData>) {
  // Table state management
  const {
    state,
    setRowSelection,
    setColumnVisibility,
    setColumnFilters,
    setSorting,
    setGlobalFilter,
  } = useTableState();

  // Create table instance
  const table = useReactTable<TData>({
    data,
    columns,
    state,
    // Features
    enableRowSelection: selectable,
    enableMultiRowSelection: selectable,
    enableSorting: sortable,
    enableFilters: filterable,
    // State handlers
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    // Models
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Row identification
    getRowId: (row: TData) => row.id,
  });

  // Expose clear selection function via ref
  useEffect(() => {
    if (clearSelectionRef) {
      clearSelectionRef.current = () => setRowSelection({});
    }
  }, [clearSelectionRef, setRowSelection]);

  // Handle row selection changes
  useEffect(() => {
    if (!onSelectionChange) return;
    const selectedRows = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original);
    onSelectionChange(selectedRows);
  }, [table, onSelectionChange, state.rowSelection]);

  // Handle row click with type safety
  const handleRowClick = useCallback(
    (row: unknown) => {
      if (onRowClick && row && typeof row === "object" && "id" in row) {
        onRowClick(row as TData);
      }
    },
    [onRowClick]
  );

  return (
    <div className="flex h-full flex-col">
      {quickFilters && <DataTableQuickFilters filters={quickFilters} />}
      <DataTableContent
        table={table}
        isLoading={isLoading}
        selectedId={selectedId}
        onRowClick={handleRowClick}
        scrollContainerRef={scrollContainerRef}
        contextMenuRender={contextMenuRender}
      >
        {children}
      </DataTableContent>
    </div>
  );
}
