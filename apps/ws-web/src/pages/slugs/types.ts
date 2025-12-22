// Import shared types from domain package (type-only, no runtime dependency on @effect/schema)
import type {
  RawPhoneData,
  PhoneData,
  SkuData,
  BenchmarkData,
  CameraData,
} from "@repo/scraper-domain";

// Re-export domain types with frontend-friendly names
export type PhoneDataRaw = RawPhoneData;
export type PhoneDataAi = PhoneData;
export type Sku = SkuData;
export type Benchmark = BenchmarkData;
export type SingleCameraData = CameraData;

export interface Device {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  isRumor: boolean;
  firstSeen: number;
  lastSeen: number;
}

export interface SlugsResponse {
  total: number;
  filtered: number;
  devices: Device[];
  stats: ScrapeStats;
}

export interface Stats {
  devices: number;
  pendingPrefixes: number;
}

export interface QueueItem {
  id: number;
  slug: string;
  mode: "fast" | "complex";
  status: "pending" | "running" | "done" | "error";
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
}

export interface ScrapeStatus {
  hasHtml: boolean;
  hasRawData: boolean;
  hasAiData: boolean;
  queueStatus: string | null;
  isCorrupted: boolean | null;
  corruptionReason: string | null;
}

// API response wrapper for phone data
export interface PhoneDataResponse<T> {
  slug: string;
  data: T | null;
}

export type JobType = "scrape" | "process_raw" | "process_ai";
export type AiMode = "realtime" | "batch";

export interface BulkJobInfo {
  id: string;
  jobType?: JobType;
  mode: "fast" | "complex" | null;
  aiMode?: AiMode | null;
  status: "pending" | "running" | "pausing" | "paused" | "done" | "error";
  filter: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  totalCount: number | null;
  queuedCount: number | null;
  workerCount?: number;
  batchRequestId?: string | null;
  batchStatus?: string | null;
}

export interface BulkJobStats {
  total: number;
  pending: number;
  running: number;
  done: number;
  error: number;
  timeout?: {
    count: number;
    nextRetryAt: number | null;
    nextRetrySlug: string | null;
  };
}

export interface BulkLastCompleted {
  slug: string;
  success: boolean;
  error?: string;
}

export type FilterType =
  | "all"
  | "corrupted"
  | "valid"
  | "scraped"
  | "unscraped"
  | "has_raw"
  | "has_ai"
  | "needs_raw"
  | "needs_ai";

export interface ScrapeStats {
  corrupted: number;
  valid: number;
  scraped: number;
  rawData?: number;
  aiData?: number;
}

// Price offer from a seller
export interface PriceOffer {
  seller: string;
  price: number;
  variantKey?: string;
  variantLabel?: string;
  url?: string;
  isAvailable?: boolean;
}

// Price summary for a device
export interface PriceSummary {
  minPrice: number;
  maxPrice: number;
  currency: string;
  updatedAt: number;
  quotes: PriceOffer[];
}

// Single point in price history
export interface PriceHistoryEntry {
  date: string;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  count: number;
}

// Price history response
export interface PriceHistory {
  deviceId: string;
  days: number;
  entries: PriceHistoryEntry[];
}

// Yandex link status for a device
export interface YandexLinkInfo {
  isLinked: boolean;
  externalId: string | null;
  url: string | null;
}
