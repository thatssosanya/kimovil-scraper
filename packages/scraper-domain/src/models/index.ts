export * from "./shared";

export {
  // Schemas
  CameraTypeSchema,
  CameraFeaturesArraySchema,

  // Classes (Schema.Class)
  Camera,
  NormalizedCamera,
  RawPhone,
  Phone,
} from "./phone";

export type {
  // Enum types
  CameraType,
  CameraFeaturesArray,

  // Plain TS types for frontend
  CameraData,
  NormalizedCameraData,
  RawPhoneData,
  PhoneData,
} from "./phone";

export type { DataKind, SourceStatus, ScrapeStatus } from "./device";
