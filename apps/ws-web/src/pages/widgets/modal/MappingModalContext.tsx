import { createContext, useContext, type Accessor } from "solid-js";
import type {
  WidgetMapping,
  SuggestedMatch,
  PostInfo,
  DevicePreview,
  NewDeviceDefaults,
  DeviceSearchResult,
  PreviewTab,
  PriceInfo,
  DetailedQuote,
  CatalogueLink,
} from "../WidgetDebug.types";

export interface MappingModalContextValue {
  // Mapping info
  mapping: Accessor<WidgetMapping | null>;
  suggestions: Accessor<SuggestedMatch[]>;
  posts: Accessor<PostInfo[]>;

  // Device selection
  selectedDeviceId: Accessor<string | null>;
  setSelectedDeviceId: (id: string | null) => void;
  devicePreview: Accessor<DevicePreview | null>;
  setDevicePreview: (device: DevicePreview | null) => void;

  // Device search
  deviceSearch: Accessor<string>;
  setDeviceSearch: (query: string) => void;
  searchResults: Accessor<DeviceSearchResult[]>;
  searchLoading: Accessor<boolean>;
  handleDeviceSearch: (query: string) => void;

  // New device form
  newDeviceDefaults: Accessor<NewDeviceDefaults | null>;
  newDeviceBrand: Accessor<string>;
  setNewDeviceBrand: (value: string) => void;
  newDeviceName: Accessor<string>;
  setNewDeviceName: (value: string) => void;
  newDeviceSlug: Accessor<string>;
  setNewDeviceSlug: (value: string) => void;
  createError: Accessor<string | null>;
  handleCreateDevice: () => Promise<void>;

  // Preview tabs
  previewTab: Accessor<PreviewTab>;
  setPreviewTab: (tab: PreviewTab) => void;
  widgetHtml: Accessor<string | null>;
  widgetLoading: Accessor<boolean>;
  mobilePreview: Accessor<boolean>;
  setMobilePreview: (value: boolean) => void;
  fetchWidgetPreview: (slug: string, bustCache?: boolean) => Promise<void>;

  // Prices
  priceInfo: Accessor<PriceInfo | null>;
  priceLoading: Accessor<boolean>;
  detailedQuotes: Accessor<DetailedQuote[]>;
  catalogueLinks: Accessor<CatalogueLink[] | null>;
  yandexUrl: Accessor<string>;
  setYandexUrl: (url: string) => void;
  scrapeError: Accessor<string | null>;
  scrapeSuccess: Accessor<string | null>;
  priceRuScraping: Accessor<boolean>;
  yandexScraping: Accessor<boolean>;
  handleScrapePriceRu: () => Promise<void>;
  handleScrapeYandex: () => Promise<void>;
  clearScrapeMessages: () => void;
  handleExcludeQuote: (source: string, externalId: string) => Promise<void>;
  excludingQuote: Accessor<string | null>;

  // Actions
  actionLoading: Accessor<boolean>;
  modalLoading: Accessor<boolean>;
  handleConfirm: () => Promise<void>;
  handleIgnore: () => Promise<void>;
  closeModal: () => void;
  selectSuggestion: (suggestion: SuggestedMatch) => void;
  selectSearchResult: (result: DeviceSearchResult) => void;
  clearSelection: () => void;

  // Helpers
  formatDate: (ts: number | null) => string;
  formatPrice: (price?: number) => string;
}

const MappingModalContext = createContext<MappingModalContextValue>();

export function useMappingModal() {
  const ctx = useContext(MappingModalContext);
  if (!ctx) throw new Error("useMappingModal must be used within MappingModalProvider");
  return ctx;
}

export { MappingModalContext };
