export * from "./services/search";
export * from "./services/scrape";
export * from "./models";

// Re-export plain TypeScript types for frontend use (no @effect/schema runtime dependency)
export type {
  // Enum types
  CameraType,
  UsbType,
  FingerprintPosition,

  // Data types (plain TS interfaces derived from Schema.Class)
  CameraData,
  NormalizedCameraData,
  SkuData,
  BenchmarkData,
  RawPhoneData,
  PhoneData,

  // Device types
  DataKind,
  SourceStatus,
  ScrapeStatus,
} from "./models";
