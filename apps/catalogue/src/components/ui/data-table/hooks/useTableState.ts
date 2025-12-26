import { useState, useCallback } from "react";
import type { TableState } from "../types";
import type {
  RowSelectionState,
  VisibilityState,
  SortingState,
  ColumnFiltersState,
  OnChangeFn,
} from "@tanstack/react-table";

export function useTableState() {
  const [state, setState] = useState<TableState>({
    rowSelection: {},
    columnVisibility: {},
    columnFilters: [],
    sorting: [],
    globalFilter: "",
  });

  const setRowSelection: OnChangeFn<RowSelectionState> = useCallback(
    (updater) => {
      setState((prev) => ({
        ...prev,
        rowSelection:
          typeof updater === "function" ? updater(prev.rowSelection) : updater,
      }));
    },
    []
  );

  const setColumnVisibility: OnChangeFn<VisibilityState> = useCallback(
    (updater) => {
      setState((prev) => ({
        ...prev,
        columnVisibility:
          typeof updater === "function"
            ? updater(prev.columnVisibility)
            : updater,
      }));
    },
    []
  );

  const setColumnFilters: OnChangeFn<ColumnFiltersState> = useCallback(
    (updater) => {
      setState((prev) => ({
        ...prev,
        columnFilters:
          typeof updater === "function" ? updater(prev.columnFilters) : updater,
      }));
    },
    []
  );

  const setSorting: OnChangeFn<SortingState> = useCallback((updater) => {
    setState((prev) => ({
      ...prev,
      sorting: typeof updater === "function" ? updater(prev.sorting) : updater,
    }));
  }, []);

  const setGlobalFilter = useCallback((value: string) => {
    setState((prev) => ({ ...prev, globalFilter: value }));
  }, []);

  return {
    state,
    setRowSelection,
    setColumnVisibility,
    setColumnFilters,
    setSorting,
    setGlobalFilter,
  };
}
