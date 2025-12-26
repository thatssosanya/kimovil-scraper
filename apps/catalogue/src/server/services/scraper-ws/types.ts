export interface Request {
  id: string;
  method: string;
  params: unknown;
}

export interface Response {
  id: string;
  result: unknown;
}

export interface ErrorResponse {
  id: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type LogEvent = {
  type: "log";
  level: "info" | "warn" | "error";
  message: string;
};

export type ProgressEvent = {
  type: "progress";
  stage: string;
  percent?: number;
  durationMs?: number;
};

export type RetryEvent = {
  type: "retry";
  attempt: number;
  maxAttempts: number;
  delay: number;
  reason: string;
};

export type ScraperEvent = LogEvent | ProgressEvent | RetryEvent;

export interface StreamEvent {
  id: string;
  event: ScraperEvent;
}

export interface SearchOption {
  name: string;
  slug: string;
  url: string;
}

export interface SearchResult {
  options: SearchOption[];
}

export interface SingleCameraData {
  resolution_mp: number;
  aperture_fstop: string | null;
  sensor: string | null;
  type: string;
  features: string;
}

export interface Sku {
  marketId: string;
  ram_gb: number;
  storage_gb: number;
}

export interface Benchmark {
  name: string;
  score: number;
}

export interface PhoneData {
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

export interface ScrapeResult {
  data: PhoneData;
}

export interface HealthCheckResult {
  ok: boolean;
  version: string;
}

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
}

export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  onEvent?: (event: ScraperEvent) => void;
  timeoutHandle: NodeJS.Timeout;
}

export const SCRAPER_TIMEOUTS = {
  search: 60 * 1000, // 60 seconds
  scrape: 5 * 60 * 1000, // 5 minutes
  healthCheck: 10 * 1000, // 10 seconds
} as const;

export const RECONNECT_CONFIG = {
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
} as const;
