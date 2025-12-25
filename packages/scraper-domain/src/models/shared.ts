import { Schema } from "@effect/schema";

// CPU core types
export const CpuCoreRoleSchema = Schema.Literal(
  "performance",
  "efficiency",
  "balanced",
  "unknown",
);
export type CpuCoreRole = typeof CpuCoreRoleSchema.Type;

export class CpuCoreCluster extends Schema.Class<CpuCoreCluster>(
  "CpuCoreCluster",
)({
  count: Schema.Number,
  maxFreqMhz: Schema.NullOr(Schema.Number),
  label: Schema.NullOr(Schema.String),
  role: CpuCoreRoleSchema,
  rawGroup: Schema.String,
  index: Schema.Number,
}) {}

// SKU type
export class Sku extends Schema.Class<Sku>("Sku")({
  marketIds: Schema.Array(Schema.String),
  ram_gb: Schema.Number,
  storage_gb: Schema.Number,
}) {}

// Benchmark type
export class Benchmark extends Schema.Class<Benchmark>("Benchmark")({
  name: Schema.String,
  score: Schema.Number,
}) {}

// USB type enum
export const UsbTypeSchema = Schema.Literal("USB-A", "USB-C", "Lightning");
export type UsbType = typeof UsbTypeSchema.Type;

// Fingerprint position enum
export const FingerprintPositionSchema = Schema.Literal(
  "screen",
  "side",
  "back",
);
export type FingerprintPosition = typeof FingerprintPositionSchema.Type;

// Re-export data types for consumers
export type CpuCoreClusterData = typeof CpuCoreCluster.Type;
export type SkuData = typeof Sku.Type;
export type BenchmarkData = typeof Benchmark.Type;
