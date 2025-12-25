export {
  // Schemas
  CameraTypeSchema,
  CameraFeaturesArraySchema,
  UsbTypeSchema,
  FingerprintPositionSchema,

  // Classes (Schema.Class)
  Camera,
  NormalizedCamera,
  Sku,
  Benchmark,
  RawPhone,
  Phone,
} from "./phone";

export type {
  // Enum types
  CameraType,
  CameraFeaturesArray,
  UsbType,
  FingerprintPosition,

  // Plain TS types for frontend
  CameraData,
  NormalizedCameraData,
  SkuData,
  BenchmarkData,
  RawPhoneData,
  PhoneData,
} from "./phone";

export type { DataKind, SourceStatus, ScrapeStatus } from "./device";
