import {
  createContext,
  useContext,
  type ParentComponent,
  createMemo,
  type Accessor,
} from "solid-js";
import type {
  Device,
  ScrapeStatus,
  QueueItem,
  FilterType,
  Stats,
  ScrapeStats,
  PhoneDataRaw,
  PhoneDataAi,
  PriceOffer,
  DeviceSource,
} from "../types";
import type { useSlugsApi } from "../hooks/useSlugsApi";
import { createSelectionService } from "../services/selection.service";

type LimitOption = 10 | 100 | 500 | 1000 | 10000;

// ============================================================================
// DevicesContext - device list, filtering, pagination
// ============================================================================

interface DevicesContextValue {
  devices: Accessor<Device[]>;
  filtered: Accessor<number>;
  total: Accessor<number>;
  limit: Accessor<LimitOption>;
  setLimit: (limit: LimitOption) => void;
  loading: Accessor<boolean>;
  stats: Accessor<Stats | null>;
  scrapeStats: Accessor<ScrapeStats | null>;
}

const DevicesContext = createContext<DevicesContextValue>();

export function useDevices() {
  const ctx = useContext(DevicesContext);
  if (!ctx) throw new Error("useDevices must be used within DevicesTableProvider");
  return ctx;
}

// ============================================================================
// SelectionContext - row selection with modifier key support
// ============================================================================

interface SelectionContextValue {
  isSelected: (slug: string) => boolean;
  selectedCount: Accessor<number>;
  handleRowClick: (slug: string, index: number, event: MouseEvent) => void;
  toggleSingle: (slug: string) => void;
  toggleAll: () => void;
  clearSelection: () => void;
  selectedSlugs: Accessor<string[]>;
  allSelected: Accessor<boolean>;
}

const SelectionContext = createContext<SelectionContextValue>();

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within DevicesTableProvider");
  return ctx;
}

// ============================================================================
// RowDataContext - per-row status data with granular reactivity
// ============================================================================

interface RowDataContextValue {
  getStatus: (slug: string) => ScrapeStatus | undefined;
  getQueue: (slug: string) => QueueItem | undefined;
  getQueueLoading: (slug: string) => boolean;
  scrapeStatus: Accessor<Record<string, ScrapeStatus>>;
  queueStatus: Accessor<Record<string, QueueItem>>;
  queueLoading: Accessor<Record<string, boolean>>;
}

const RowDataContext = createContext<RowDataContextValue>();

export function useRowData() {
  const ctx = useContext(RowDataContext);
  if (!ctx) throw new Error("useRowData must be used within DevicesTableProvider");
  return ctx;
}

// ============================================================================
// ActionsContext - row and bulk actions
// ============================================================================

type TabId = "html" | "raw" | "ai" | "compare" | "prices";

interface ActionsContextValue {
  queueScrape: (slug: string, mode: "fast" | "complex") => Promise<void>;
  clearAllData: (slug: string) => Promise<void>;
  clearRawData: (slug: string) => Promise<boolean>;
  clearAiData: (slug: string) => Promise<boolean>;
  openModal: (slug: string, initialTab?: TabId) => void;
  fetchHtml: (slug: string) => Promise<{ html: string | null; error?: string }>;
  fetchRawData: (slug: string) => Promise<PhoneDataRaw | null>;
  fetchAiData: (slug: string) => Promise<PhoneDataAi | null>;
  fetchAllQuotes: (slug: string, source?: string, externalId?: string) => Promise<PriceOffer[]>;
  fetchDeviceSources: (slug: string, source?: string) => Promise<DeviceSource[]>;
  processRaw: (slug: string) => Promise<{ success: boolean; error?: string }>;
  processAi: (slug: string) => Promise<{ success: boolean; error?: string }>;
  fetchScrapeStatus: (slugs: string[]) => Promise<void>;
  verifyBulk: (slugs: string[]) => Promise<void>;
  clearBulk: (slugs: string[]) => Promise<boolean>;
  clearRawBulk: (slugs: string[]) => Promise<number>;
  clearAiBulk: (slugs: string[]) => Promise<number>;
  verifyLoading: Accessor<boolean>;
  clearLoading: Accessor<boolean>;
  clearRawLoading: Accessor<boolean>;
  clearAiLoading: Accessor<boolean>;
  setScrapeStatus: (
    fn: (prev: Record<string, ScrapeStatus>) => Record<string, ScrapeStatus>,
  ) => void;
}

const ActionsContext = createContext<ActionsContextValue>();

export function useActions() {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useActions must be used within DevicesTableProvider");
  return ctx;
}

// ============================================================================
// Provider Props
// ============================================================================

interface DevicesTableProviderProps {
  api: ReturnType<typeof useSlugsApi>;
  search: Accessor<string>;
  filter: Accessor<FilterType>;
  limit: Accessor<LimitOption>;
  setLimit: (limit: LimitOption) => void;
  onModalOpen: (slug: string, initialTab?: TabId) => void;
  onSelectionChange?: (slugs: string[]) => void;
}

// ============================================================================
// Combined Provider
// ============================================================================

export const DevicesTableProvider: ParentComponent<DevicesTableProviderProps> = (
  props,
) => {
  const api = props.api;
  const selection = createSelectionService();

  const fetchDevices = async (
    searchQuery: string,
    filterType: FilterType,
    limitValue: LimitOption,
  ) => {
    const devices = await api.fetchDevices(searchQuery, filterType, limitValue);
    selection.clearSelection();
    return devices;
  };

  const setLimit = (newLimit: LimitOption) => {
    props.setLimit(newLimit);
    fetchDevices(props.search(), props.filter(), newLimit);
  };

  const devicesContextValue: DevicesContextValue = {
    devices: api.devices,
    filtered: api.filtered,
    total: api.total,
    limit: props.limit,
    setLimit,
    loading: api.loading,
    stats: api.stats,
    scrapeStats: api.scrapeStats,
  };

  const allSlugs = createMemo(() => api.devices().map((d) => d.slug));

  const allSelected = createMemo(() => {
    const devs = api.devices();
    const count = selection.selectedCount();
    return devs.length > 0 && count === devs.length;
  });

  const selectionContextValue: SelectionContextValue = {
    isSelected: selection.isSelected,
    selectedCount: () => selection.selectedCount(),
    handleRowClick: (slug: string, index: number, event: MouseEvent) => {
      selection.handleRowClick(slug, index, event, allSlugs());
      props.onSelectionChange?.(selection.selectedSlugs());
    },
    toggleSingle: (slug: string) => {
      selection.toggleSingle(slug);
      props.onSelectionChange?.(selection.selectedSlugs());
    },
    toggleAll: () => {
      selection.toggleAll(allSlugs());
      props.onSelectionChange?.(selection.selectedSlugs());
    },
    clearSelection: () => {
      selection.clearSelection();
      props.onSelectionChange?.([]);
    },
    selectedSlugs: () => selection.selectedSlugs(),
    allSelected,
  };

  const rowDataContextValue: RowDataContextValue = {
    getStatus: (slug: string) => api.scrapeStatus()[slug],
    getQueue: (slug: string) => api.queueStatus()[slug],
    getQueueLoading: (slug: string) => api.queueLoading()[slug] ?? false,
    scrapeStatus: api.scrapeStatus,
    queueStatus: api.queueStatus,
    queueLoading: api.queueLoading,
  };

  const actionsContextValue: ActionsContextValue = {
    queueScrape: api.queueScrape,
    clearAllData: api.clearScrapeData,
    clearRawData: api.clearRawData,
    clearAiData: api.clearAiData,
    openModal: props.onModalOpen,
    fetchHtml: api.openPreview,
    fetchRawData: api.fetchPhoneDataRaw,
    fetchAiData: api.fetchPhoneDataAi,
    fetchAllQuotes: api.fetchAllQuotes,
    fetchDeviceSources: api.fetchDeviceSources,
    processRaw: api.processRaw,
    processAi: api.processAi,
    fetchScrapeStatus: api.fetchScrapeStatus,
    verifyBulk: api.verifyBulk,
    clearBulk: api.clearBulk,
    clearRawBulk: api.clearRawBulk,
    clearAiBulk: api.clearAiBulk,
    verifyLoading: api.verifyLoading,
    clearLoading: api.clearLoading,
    clearRawLoading: api.clearRawLoading,
    clearAiLoading: api.clearAiLoading,
    setScrapeStatus: api.setScrapeStatus,
  };

  return (
    <DevicesContext.Provider value={devicesContextValue}>
      <SelectionContext.Provider value={selectionContextValue}>
        <RowDataContext.Provider value={rowDataContextValue}>
          <ActionsContext.Provider value={actionsContextValue}>
            {props.children}
          </ActionsContext.Provider>
        </RowDataContext.Provider>
      </SelectionContext.Provider>
    </DevicesContext.Provider>
  );
};

// Re-export for convenience
export { useSlugsApi } from "../hooks/useSlugsApi";
export type { LimitOption };
