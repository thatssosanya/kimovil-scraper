import type { InferSelectModel } from "drizzle-orm";
import type { 
  camera as cameraTable, 
  screen as screenTable,
  sku as skuTable,
  benchmark as benchmarkTable
} from "@/src/server/db/schema";

type Camera = InferSelectModel<typeof cameraTable>;
type Screen = InferSelectModel<typeof screenTable>;
type Sku = InferSelectModel<typeof skuTable>;
type Benchmark = InferSelectModel<typeof benchmarkTable>;
import {
  type DeviceSpecsFormValues,
  type ExtendedDeviceCharacteristics,
  type SKUConfig,
  type BenchmarkConfig,
  type CameraConfig,
  type ScreenConfig,
} from "../../../types";

export type RelatedKey = "cameras" | "skus" | "benchmarks" | "screens";
type RelatedValue = CameraConfig | SKUConfig | BenchmarkConfig | ScreenConfig;

export type RelatedChanges = {
  [K in RelatedKey]: {
    added: string[];
    removed: string[];
    modified: Array<{
      id: string;
      fields: string[];
    }>;
  };
};

type ValueType = string | number | boolean | Date | string[] | null;

type SimpleFieldKey = keyof Omit<
  DeviceSpecsFormValues,
  "skus" | "benchmarks" | "cameras" | "screens"
>;

const isSimpleFieldKey = (key: string): key is SimpleFieldKey => {
  return !["skus", "benchmarks", "cameras", "screens"].includes(key);
};

export const convertValue = (key: string, value: unknown): ValueType => {
  // date fields
  if (key === "releaseDate") {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string") return new Date(value);
    return null;
  }

  // pipe delimited fields
  const pipeDelimitedFields = [
    "aliases",
    "materials",
    "colors",
    "displayFeatures",
    "cpuCores",
    "sim",
    "cameraFeatures",
  ];
  if (pipeDelimitedFields.includes(key)) {
    if (!value) return "";
    if (Array.isArray(value)) return value.join("|");
    if (typeof value === "string") return value;
    return "";
  }

  // number fields
  const numberFields = [
    "height_mm",
    "width_mm",
    "thickness_mm",
    "weight_g",
    "batteryCapacity_mah",
    "batteryWattage",
  ];
  if (numberFields.includes(key)) {
    return value ? Number(value) : null;
  }

  // booleans
  const booleanFields = [
    "sdSlot",
    "nfc",
    "headphoneJack",
    "batteryFastCharging",
  ];
  if (booleanFields.includes(key)) {
    return Boolean(value);
  }

  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join("|");
  return "";
};

export const convertInitialData = (
  data: ExtendedDeviceCharacteristics | null | undefined
): DeviceSpecsFormValues | undefined => {
  if (!data) return undefined;

  return Object.entries(data).reduce((acc, [key, value]) => {
    if (
      ["id", "createdAt", "updatedAt", "deviceId", "raw", "slug", "characteristicsId"].includes(key)
    ) {
      return acc;
    }

    if (key === "cameras") {
      const cameras = (value || []) as Camera[];
      acc.cameras = cameras.map((camera) => ({
        id: camera.id,
        type: camera.type,
        resolution_mp: camera.resolution_mp,
        aperture_fstop: camera.aperture_fstop,
        sensor: camera.sensor,
        features: camera.features || "",
      }));
    } else if (key === "screens") {
      const screens = (value || []) as Screen[];
      acc.screens = screens.map((screen) => ({
        id: screen.id,
        position: screen.position,
        size_in: screen.size_in,
        displayType: screen.displayType,
        resolution: screen.resolution,
        aspectRatio: screen.aspectRatio,
        ppi: screen.ppi,
        displayFeatures: screen.displayFeatures || "",
        refreshRate: screen.refreshRate,
        brightnessNits: screen.brightnessNits,
        isMain: screen.isMain,
      }));
    } else if (key === "skus") {
      const skus = (value || []) as Sku[];
      acc.skus = skus.map((sku) => ({
        id: sku.id,
        marketId: sku.marketId,
        ram_gb: sku.ram_gb,
        storage_gb: sku.storage_gb,
      }));
    } else if (key === "benchmarks") {
      const benchmarks = (value || []) as Benchmark[];
      acc.benchmarks = benchmarks.map((benchmark) => ({
        id: benchmark.id,
        name: benchmark.name,
        score: benchmark.score,
      }));
    } else if (isSimpleFieldKey(key)) {
      // Handle simple fields
      acc[key] = convertValue(key, value);
    }
    return acc;
  }, {} as DeviceSpecsFormValues);
};

export const getRelatedChanges = (
  currentValues: DeviceSpecsFormValues,
  initialValues?: DeviceSpecsFormValues
): RelatedChanges => {
  const result: RelatedChanges = {
    cameras: { added: [], removed: [], modified: [] },
    skus: { added: [], removed: [], modified: [] },
    benchmarks: { added: [], removed: [], modified: [] },
    screens: { added: [], removed: [], modified: [] },
  };

  const relatedFields: RelatedKey[] = [
    "cameras",
    "skus",
    "benchmarks",
    "screens",
  ];

  relatedFields.forEach((field) => {
    const currentArray = (currentValues[field] || []) as RelatedValue[];
    const initialArray = (initialValues?.[field] || []) as RelatedValue[];

    const currentIds = currentArray.map((item) => item.id);
    const initialIds = initialArray.map((item) => item.id);

    // Handle added items
    const addedIds = currentIds.filter((id) => !initialIds.includes(id));
    result[field].added = addedIds;

    // Handle removed items
    const removedIds = initialIds.filter((id) => !currentIds.includes(id));
    result[field].removed = removedIds;

    // Handle modified items
    const commonIds = currentIds.filter((id) => initialIds.includes(id));

    commonIds.forEach((id) => {
      const currentItem = currentArray.find((item) => item.id === id);
      const initialItem = initialArray.find((item) => item.id === id);

      if (!currentItem || !initialItem) {
        return;
      }

      const modifiedFields: string[] = [];
      const keys = Object.keys(currentItem) as (keyof typeof currentItem)[];

      keys.forEach((key) => {
        if (key !== "id" && currentItem[key] !== initialItem[key]) {
          modifiedFields.push(key as string);
        }
      });

      if (modifiedFields.length > 0) {
        result[field].modified.push({ id, fields: modifiedFields });
      }
    });
  });

  return result;
};

export const getItemSummary = (
  item: CameraConfig | SKUConfig | BenchmarkConfig | ScreenConfig,
  type: RelatedKey
): string => {
  switch (type) {
    case "cameras": {
      const camera = item as CameraConfig;
      const position = camera.type || "Unknown";
      const resolution = camera.resolution_mp || 0;
      return `${position} - ${resolution}MP`;
    }
    case "skus": {
      const sku = item as SKUConfig;
      return `${sku.ram_gb}GB RAM, ${sku.storage_gb}GB Storage`;
    }
    case "benchmarks": {
      const benchmark = item as BenchmarkConfig;
      return `${benchmark.name || "Unknown"}: ${benchmark.score}`;
    }
    case "screens": {
      const screen = item as ScreenConfig;
      const position =
        screen.position || (screen.isMain ? "Main" : "Secondary");
      const size = screen.size_in ? `${screen.size_in}"` : "";
      const type = screen.displayType || "";
      return `${position} ${size} ${type}`.trim();
    }
    default:
      return "Unknown item";
  }
};
