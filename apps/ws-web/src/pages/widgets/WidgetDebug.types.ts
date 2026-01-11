export type MappingStatus = "pending" | "suggested" | "auto_confirmed" | "confirmed" | "ignored";

export interface WidgetMapping {
  id: number;
  source: string;
  rawModel: string;
  normalizedModel: string | null;
  deviceId: string | null;
  deviceSlug: string | null;
  confidence: number | null;
  status: MappingStatus;
  usageCount: number;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
  impressions?: number;
  clicks?: number;
  priceCount?: number;
}

export interface MappingsResponse {
  mappings: WidgetMapping[];
  total: number;
}

export interface SyncStatus {
  lastSyncedAt: string | null;
  lastModifiedGmt: string | null;
  postsCount: number;
  widgetsCount: number;
}

export interface SuggestedMatch {
  deviceId: string;
  slug: string;
  name: string;
  confidence: number;
}

export interface DeviceSearchResult {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
}

export interface PostInfo {
  postId: number;
  title: string;
  url: string;
  dateGmt: string;
  impressions?: number;
  clicks?: number;
}

export interface DevicePreview {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
}

export interface NewDeviceDefaults {
  brand: string | null;
  modelName: string;
  suggestedSlug: string;
}

export interface PriceInfo {
  deviceId: string;
  deviceName: string;
  summary: {
    minPrice: number;
    maxPrice: number;
    currency: string;
    updatedAt: number;
  } | null;
  linkedSources: Array<{
    source: string;
    externalId: string;
    url: string | null;
  }>;
}

export interface ScrapeResult {
  success: boolean;
  error?: string;
  message?: string;
  offerCount?: number;
  savedCount?: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface MappingContext {
  mapping: WidgetMapping | null;
  suggestions: SuggestedMatch[];
  posts: PostInfo[];
  devicePreview: DevicePreview | null;
  newDeviceDefaults: NewDeviceDefaults;
}

export type SortField = "usageCount" | "rawModel" | "status" | "confidence";
export type StatusTab = "all" | "needs_review" | "auto_confirmed" | "confirmed" | "ignored";
export type PeriodOption = "all" | "1d" | "7d" | "30d" | "90d" | "custom";
export type PreviewTab = "widget" | "device" | "prices" | "images";

export interface DeviceImage {
  id: number;
  deviceId: string;
  source: string;
  url: string;
  position: number;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
}

export const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs Review" },
  { id: "auto_confirmed", label: "Auto-confirmed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "ignored", label: "Ignored" },
];

export const PERIOD_OPTIONS: { id: PeriodOption; label: string; days: number | null }[] = [
  { id: "all", label: "All time", days: null },
  { id: "1d", label: "Last day", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
];

export interface DetailedQuote {
  seller: string;
  price: number;
  variantKey?: string;
  variantLabel?: string;
  url?: string;
  isAvailable: boolean;
  externalId?: string;
  source: string;
  scrapedAt: number;
}

export interface CatalogueLink {
  originalUrl: string;
  resolvedUrl: string | null;
  isYandexMarket: boolean;
  externalId: string | null;
  error?: string;
  fromCache?: boolean;
  price?: number;
  updatedAt?: string;
}
