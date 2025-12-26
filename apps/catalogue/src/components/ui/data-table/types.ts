import type { ReactNode, RefObject } from "react";
import type {
  ColumnDef,
  Table,
  RowSelectionState,
  VisibilityState,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";

export type BaseTableData = {
  id: string;
  [key: string]: unknown;
};

export interface TableState {
  rowSelection: RowSelectionState;
  columnVisibility: VisibilityState;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  globalFilter: string;
}

export interface QuickFilter {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export interface DataTableProps<TData extends BaseTableData> {
  // Required props
  data: TData[];
  columns: ColumnDef<TData, unknown>[];

  // Optional features
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  selectable?: boolean;

  // Customization
  searchPlaceholder?: string;
  toolbarContent?: ReactNode;
  quickFilters?: QuickFilter[];

  // State
  selectedId?: string;
  isLoading?: boolean;

  // Callbacks
  onRowClick?: (row: TData) => void;
  onSearch?: (search: string) => void;
  onSelectionChange?: (selectedRows: TData[]) => void;
  children?: React.ReactNode;
  onClearSelection?: () => void;
  clearSelectionRef?: React.MutableRefObject<(() => void) | undefined>;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  contextMenuRender?: (item: TData) => ReactNode;
}

export interface DataTableHeaderProps<TData> {
  table: Table<TData>;
  searchPlaceholder?: string;
  toolbarContent?: ReactNode;
  onSearch?: (value: string) => void;
}

export interface DataTableContentProps<TData> {
  table: Table<TData>;
  isLoading: boolean;
  selectedId?: string;
  onRowClick?: (row: TData) => void;
  children?: ReactNode;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  contextMenuRender?: (item: TData) => ReactNode;
}

export interface DataTableFiltersProps {
  filters: QuickFilter[];
}
