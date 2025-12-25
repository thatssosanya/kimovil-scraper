export * from "./messages";

// Re-export shared types from domain for backwards compatibility
export {
  CpuCoreRoleSchema,
  CpuCoreCluster,
  Sku,
  Benchmark,
  UsbTypeSchema,
  FingerprintPositionSchema,
} from "@repo/scraper-domain";
export type {
  CpuCoreRole,
  UsbType,
  FingerprintPosition,
  CpuCoreClusterData,
  SkuData,
  BenchmarkData,
} from "@repo/scraper-domain";
