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
  queueStatus: string | null;
  isCorrupted: boolean | null;
  corruptionReason: string | null;
}

export interface BulkJobInfo {
  id: string;
  mode: "fast" | "complex";
  status: "pending" | "running" | "paused" | "done" | "error";
  filter: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  totalCount: number | null;
  queuedCount: number | null;
  workerCount?: number;
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

export type FilterType = "all" | "corrupted" | "valid" | "scraped" | "unscraped";

export interface ScrapeStats {
  corrupted: number;
  valid: number;
  scraped: number;
}
