import type { InferSelectModel } from "drizzle-orm";
import type {
  device,
  link,
  config,
  sku,
  marketplace,
  deviceCharacteristics,
  screen as screenTable,
  camera as cameraTable,
  benchmark as benchmarkTable,
} from "@/src/server/db/schema";

type Device = InferSelectModel<typeof device>;
type Link = InferSelectModel<typeof link>;
type Config = InferSelectModel<typeof config>;
type Sku = InferSelectModel<typeof sku>;
type Marketplace = InferSelectModel<typeof marketplace>;
type DeviceCharacteristics = InferSelectModel<typeof deviceCharacteristics>;
type Screen = InferSelectModel<typeof screenTable>;
type Camera = InferSelectModel<typeof cameraTable>;
type Benchmark = InferSelectModel<typeof benchmarkTable>;
import {
  type UseFormRegister,
  type UseFormWatch,
  type UseFormSetValue,
  type Control,
  type FieldArrayWithId,
  type FieldValues,
} from "react-hook-form";

export type LinkWithRelations = Link & {
  marketplace?: Marketplace | null;
  config?: Config | null;
  sku?: Sku | null;
};

export type DeviceWithConfigs = Device & {
  configs: Config[];
  links: LinkWithRelations[];
  ratingPositions: {
    position: number;
  }[];
  slug?: string;
  hasCharacteristics?: boolean;
};

export type DeviceViewProps = {
  device: DeviceWithConfigs;
};

export type BenchmarkField = FieldArrayWithId<
  DeviceSpecsFormValues,
  "benchmarks",
  "id"
>;

export type CameraField = FieldArrayWithId<
  DeviceSpecsFormValues,
  "cameras",
  "id"
>;

export type SKUField = FieldArrayWithId<DeviceSpecsFormValues, "skus", "id">;

export type ScreenField = FieldArrayWithId<
  DeviceSpecsFormValues,
  "screens",
  "id"
>;

export type DeviceSpecsSectionProps = {
  isEditing: boolean;
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  control?: Control<DeviceSpecsFormValues>;
};

export type SKUConfig = {
  id: string;
  marketId: string;
  ram_gb: number;
  storage_gb: number;
};

export type SKUGroup = {
  storage: Set<number>;
  count: number;
  configs: SKUConfig[];
};

export type BenchmarkConfig = {
  id: string;
  name: string;
  score: number;
};

export type CameraConfig = {
  id: string;
  type: string | null;
  resolution_mp: number | null;
  aperture_fstop: string | null;
  sensor: string | null;
  features: string | null;
};

export type ScreenConfig = {
  id: string;
  position: string;
  size_in: number | null;
  displayType: string | null;
  resolution: string | null;
  aspectRatio: string | null;
  ppi: number | null;
  displayFeatures: string | null;
  refreshRate: number | null;
  brightnessNits: number | null;
  isMain: boolean;
};

export type ExtendedDeviceCharacteristics = DeviceCharacteristics & {
  skus: Sku[];
  benchmarks: Benchmark[];
  cameras: Camera[];
  screens: Screen[];
};

export type DeviceSpecsFormValues = Omit<
  DeviceCharacteristics,
  "id" | "createdAt" | "updatedAt" | "deviceId" | "raw" | "slug"
> & {
  benchmarks: { id: string; name: string; score: number }[];
  skus?: { id: string; marketId: string; ram_gb: number; storage_gb: number }[];
  cameras?: {
    id: string;
    type: string | null;
    resolution_mp: number | null;
    aperture_fstop: string | null;
    sensor: string | null;
    features: string | null;
  }[];
  screens?: {
    id: string;
    position: string;
    size_in: number | null;
    displayType: string | null;
    resolution: string | null;
    aspectRatio: string | null;
    ppi: number | null;
    displayFeatures: string | null;
    refreshRate: number | null;
    brightnessNits: number | null;
    isMain: boolean;
  }[];
} & FieldValues;

export type BenchmarkDirtyFields = {
  [key: number]: {
    name?: boolean;
    score?: boolean;
  };
};

export type SKUDirtyFields = {
  [key: number]: {
    marketId?: boolean;
    ram_gb?: boolean;
    storage_gb?: boolean;
  };
};

export type CameraDirtyFields = {
  [key: number]: {
    type?: boolean;
    resolution_mp?: boolean;
    aperture_fstop?: boolean;
    sensor?: boolean;
    features?: boolean;
  };
};

export type ScreenDirtyFields = {
  [key: number]: {
    position?: boolean;
    size_in?: boolean;
    displayType?: boolean;
    resolution?: boolean;
    aspectRatio?: boolean;
    ppi?: boolean;
    displayFeatures?: boolean;
    refreshRate?: boolean;
    brightnessNits?: boolean;
    isMain?: boolean;
  };
};

export type DirtyFields = {
  [K in keyof DeviceSpecsFormValues]?: K extends "benchmarks"
    ? BenchmarkDirtyFields
    : K extends "skus"
    ? SKUDirtyFields
    : K extends "cameras"
    ? CameraDirtyFields
    : K extends "screens"
    ? ScreenDirtyFields
    : boolean | { [key: string]: boolean };
};
