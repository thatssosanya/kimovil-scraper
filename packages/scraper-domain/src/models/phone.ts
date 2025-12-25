import { Schema } from "@effect/schema";

import {
  CpuCoreRoleSchema,
  CpuCoreCluster,
  Sku,
  Benchmark,
  UsbTypeSchema,
  FingerprintPositionSchema,
} from "./shared";

// Re-export shared types for backwards compatibility
export {
  CpuCoreRoleSchema,
  CpuCoreCluster,
  Sku,
  Benchmark,
  UsbTypeSchema,
  FingerprintPositionSchema,
} from "./shared";
export type {
  CpuCoreRole,
  UsbType,
  FingerprintPosition,
  CpuCoreClusterData,
  SkuData,
  BenchmarkData,
} from "./shared";

// Camera types for AI normalization
export const CameraTypeSchema = Schema.Literal(
  "ширик",
  "зум",
  "основная",
  "фронтальная",
  "lidar",
  "макро",
  "инфракрасная",
);
export type CameraType = typeof CameraTypeSchema.Type;

// Camera features for AI normalization
export const CameraFeaturesArraySchema = Schema.Array(
  Schema.Literal("macro", "monochrome"),
);
export type CameraFeaturesArray = typeof CameraFeaturesArraySchema.Type;

// Embedded types (not stored as separate tables)

export class Camera extends Schema.Class<Camera>("Camera")({
  resolution_mp: Schema.Number,
  aperture_fstop: Schema.NullOr(Schema.String),
  sensor: Schema.NullOr(Schema.String),
  type: Schema.String,
  features: Schema.Array(Schema.String),
}) {}

export class NormalizedCamera extends Schema.Class<NormalizedCamera>(
  "NormalizedCamera",
)({
  resolution_mp: Schema.Number,
  aperture_fstop: Schema.NullOr(Schema.String),
  sensor: Schema.NullOr(Schema.String),
  type: CameraTypeSchema,
  features: Schema.NullOr(CameraFeaturesArraySchema),
}) {}

// Raw phone data before AI normalization (extracted from HTML)
export class RawPhone extends Schema.Class<RawPhone>("RawPhone")({
  // Primary key
  slug: Schema.String,

  // Essentials
  name: Schema.String,
  brand: Schema.String,
  aliases: Schema.Array(Schema.String),
  releaseDate: Schema.NullOr(Schema.String), // ISO date string
  images: Schema.NullOr(Schema.Array(Schema.String)),

  // Design
  height_mm: Schema.NullOr(Schema.Number),
  width_mm: Schema.NullOr(Schema.Number),
  thickness_mm: Schema.NullOr(Schema.Number),
  weight_g: Schema.NullOr(Schema.Number),
  materials: Schema.Array(Schema.String),
  ipRating: Schema.NullOr(Schema.String),
  colors: Schema.Array(Schema.String),

  // Display
  size_in: Schema.NullOr(Schema.Number),
  displayType: Schema.NullOr(Schema.String),
  resolution: Schema.NullOr(Schema.String),
  aspectRatio: Schema.NullOr(Schema.String),
  ppi: Schema.NullOr(Schema.Number),
  displayFeatures: Schema.Array(Schema.String),

  // Hardware
  cpu: Schema.NullOr(Schema.String),
  cpuManufacturer: Schema.NullOr(Schema.String),
  cpuCores: Schema.NullOr(Schema.Array(Schema.String)),
  cpuCoreClusters: Schema.NullOr(Schema.Array(CpuCoreCluster)),
  gpu: Schema.NullOr(Schema.String),
  sdSlot: Schema.NullOr(Schema.Boolean),
  skus: Schema.Array(Sku),
  fingerprintPosition: Schema.NullOr(FingerprintPositionSchema),
  benchmarks: Schema.Array(Benchmark),

  // Connectivity
  nfc: Schema.NullOr(Schema.Boolean),
  bluetooth: Schema.NullOr(Schema.String),
  sim: Schema.Array(Schema.String),
  simCount: Schema.Number,
  usb: Schema.NullOr(UsbTypeSchema),
  headphoneJack: Schema.NullOr(Schema.Boolean),

  // Battery
  batteryCapacity_mah: Schema.NullOr(Schema.Number),
  batteryFastCharging: Schema.NullOr(Schema.Boolean),
  batteryWattage: Schema.NullOr(Schema.Number),

  // Cameras
  cameras: Schema.Array(Camera),
  cameraFeatures: Schema.Array(Schema.String),

  // Software
  os: Schema.NullOr(Schema.String),
  osSkin: Schema.NullOr(Schema.String),

  // Extras
  scores: Schema.NullOr(Schema.String), // pipe-delimited key=value (kept as string)
  others: Schema.NullOr(Schema.Array(Schema.String)),
}) {}

// AI-normalized phone data
export class Phone extends Schema.Class<Phone>("Phone")({
  // Primary key
  slug: Schema.String,

  // Essentials
  name: Schema.String,
  brand: Schema.String,
  aliases: Schema.Array(Schema.String),
  releaseDate: Schema.NullOr(Schema.String), // ISO date string

  // Design
  height_mm: Schema.NullOr(Schema.Number),
  width_mm: Schema.NullOr(Schema.Number),
  thickness_mm: Schema.NullOr(Schema.Number),
  weight_g: Schema.NullOr(Schema.Number),
  materials: Schema.Array(Schema.String),
  ipRating: Schema.NullOr(Schema.String),
  colors: Schema.Array(Schema.String),

  // Display
  size_in: Schema.NullOr(Schema.Number),
  displayType: Schema.NullOr(Schema.String),
  resolution: Schema.NullOr(Schema.String),
  aspectRatio: Schema.NullOr(Schema.String),
  ppi: Schema.NullOr(Schema.Number),
  displayFeatures: Schema.Array(Schema.String),

  // Hardware
  cpu: Schema.NullOr(Schema.String), // cleaned
  cpuManufacturer: Schema.NullOr(Schema.String),
  cpuCores: Schema.NullOr(Schema.Array(Schema.String)),
  cpuCoreClusters: Schema.NullOr(Schema.Array(CpuCoreCluster)),
  gpu: Schema.NullOr(Schema.String),
  sdSlot: Schema.NullOr(Schema.Boolean),
  skus: Schema.Array(Sku),
  fingerprintPosition: Schema.NullOr(FingerprintPositionSchema),
  benchmarks: Schema.Array(Benchmark),

  // Connectivity
  nfc: Schema.NullOr(Schema.Boolean),
  bluetooth: Schema.NullOr(Schema.String),
  sim: Schema.Array(Schema.String),
  simCount: Schema.Number,
  usb: Schema.NullOr(UsbTypeSchema),
  headphoneJack: Schema.NullOr(Schema.Boolean),

  // Battery
  batteryCapacity_mah: Schema.NullOr(Schema.Number),
  batteryFastCharging: Schema.NullOr(Schema.Boolean),
  batteryWattage: Schema.NullOr(Schema.Number),

  // Cameras (with AI-normalized types)
  cameras: Schema.Array(NormalizedCamera),
  cameraFeatures: Schema.Array(Schema.String),

  // Software
  os: Schema.NullOr(Schema.String),
  osSkin: Schema.NullOr(Schema.String),
}) {}

// Plain TypeScript types for frontend (no Schema runtime dependency)
export type CameraData = typeof Camera.Type;
export type NormalizedCameraData = typeof NormalizedCamera.Type;
export type RawPhoneData = typeof RawPhone.Type;
export type PhoneData = typeof Phone.Type;
