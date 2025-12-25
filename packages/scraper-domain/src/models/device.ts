export type DataKind = "specs" | "prices" | "reviews" | "availability";
export type SourceStatus = "active" | "missing" | "deleted" | "conflict";
export type ScrapeStatus = "pending" | "running" | "done" | "error";

// Job types for bulk operations
export type JobType = "scrape" | "process_raw" | "process_ai" | "clear_html" | "clear_raw" | "clear_processed";

// Job status for bulk job tracking
export type JobStatus = "pending" | "running" | "pausing" | "paused" | "done" | "error";

// AI processing mode
export type AiMode = "realtime" | "batch";

// Scrape mode
export type ScrapeMode = "fast" | "complex";
