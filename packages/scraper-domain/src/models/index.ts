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
  RawPhoneRow,
  PhoneRow,

  // Transformers for SQLite
  JsonFromString,
  BooleanFromNumber,
  NullableBooleanFromNumber,
  DateFromTimestamp,
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
  RawPhoneRowData,
  PhoneRowData,
} from "./phone";

export { Device, DeviceSourceLink, Scrape } from "./device";

export type {
  DataKind,
  SourceStatus,
  ScrapeStatus,
  DeviceData,
  DeviceSourceLinkData,
  ScrapeData,
} from "./device";
