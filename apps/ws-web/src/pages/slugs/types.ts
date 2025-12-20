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
  stats: {
    corrupted: number;
    valid: number;
    scraped: number;
  };
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

// Phone data sub-types
export interface Sku {
  marketId: string;
  ram_gb: number;
  storage_gb: number;
}

export interface SingleCameraData {
  resolution_mp: number;
  aperture_fstop: string | null;
  sensor: string | null;
  type: string;
  features: string;
}

export interface Benchmark {
  name: string;
  score: number;
}

// Raw phone data (extracted from HTML, before AI processing)
export interface PhoneDataRaw {
  slug: string;
  name: string;
  brand: string;
  aliases: string;
  releaseDate: string | null;
  images: string | null;
  height_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  weight_g: number | null;
  materials: string;
  ipRating: string | null;
  colors: string;
  size_in: number | null;
  displayType: string | null;
  resolution: string | null;
  aspectRatio: string | null;
  ppi: number | null;
  displayFeatures: string;
  cpu: string | null;
  cpuManufacturer: string | null;
  cpuCores: string | null;
  gpu: string | null;
  sdSlot: boolean | null;
  skus: Sku[];
  fingerprintPosition: "screen" | "side" | "back" | null;
  benchmarks: Benchmark[];
  nfc: boolean | null;
  bluetooth: string | null;
  sim: string;
  simCount: number;
  usb: "USB-A" | "USB-C" | "Lightning" | null;
  headphoneJack: boolean | null;
  batteryCapacity_mah: number | null;
  batteryFastCharging: boolean | null;
  batteryWattage: number | null;
  cameras: SingleCameraData[];
  cameraFeatures: string;
  os: string | null;
  osSkin: string | null;
  scores: string | null;
  others: string | null;
}

// AI-processed phone data (normalized/translated)
export type PhoneDataAi = PhoneDataRaw;

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
  status: "pending" | "running" | "paused" | "done" | "error";
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
  rawData: number;
  aiData: number;
}
