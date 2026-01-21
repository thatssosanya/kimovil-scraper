import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/src/server/db";
import {
  device,
  deviceCharacteristics,
  screen,
  sku,
  camera,
  benchmark,
} from "@/src/server/db/schema";
import { logger } from "../logger";
import type { PhoneData } from "../scraper-ws/types";
import { SlugConflictError } from "./errors";

const joinArray = (value: unknown, separator = ", "): string => {
  if (Array.isArray(value)) return value.join(separator);
  if (typeof value === "string") return value;
  return "";
};

const cameraSchema = z.object({
  resolution_mp: z.number(),
  aperture_fstop: z.string(),
  sensor: z.string().nullable(),
  type: z.string().nullable(),
  features: z.string().nullable(),
});

const skuSchema = z.object({
  marketId: z.string(),
  ram_gb: z.number().int(),
  storage_gb: z.number().int(),
});

const benchmarkSchema = z.object({
  name: z.string(),
  score: z.number(),
});

export const deviceSpecsSchema = z.object({
  deviceId: z.string(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  aliases: z.string(),
  releaseDate: z
    .union([z.string(), z.date()])
    .nullable()
    .transform((val) => {
      if (!val) return null;
      return val instanceof Date ? val : new Date(val);
    }),
  height_mm: z.number().nullable(),
  width_mm: z.number().nullable(),
  thickness_mm: z.number().nullable(),
  weight_g: z.number().nullable(),
  materials: z.string(),
  ipRating: z.string().nullable(),
  colors: z.string(),
  size_in: z.number().nullable(),
  displayType: z.string().nullable(),
  resolution: z.string().nullable(),
  aspectRatio: z.string().nullable(),
  ppi: z.number().int().nullable(),
  displayFeatures: z.string(),
  cpu: z.string().nullable(),
  cpuManufacturer: z.string().nullable(),
  cpuCores: z.string().nullable(),
  gpu: z.string().nullable(),
  sdSlot: z.boolean().nullable(),
  skus: z.array(skuSchema),
  fingerprintPosition: z.string().nullable(),
  benchmarks: z.array(benchmarkSchema),
  nfc: z.boolean().nullable(),
  bluetooth: z.string().nullable(),
  sim: z.string(),
  simCount: z.number(),
  usb: z.string().nullable(),
  headphoneJack: z.boolean().nullable(),
  batteryCapacity_mah: z.number().nullable(),
  batteryFastCharging: z.boolean().nullable(),
  batteryWattage: z.number().nullable(),
  cameras: z.array(cameraSchema),
  cameraFeatures: z.string(),
  os: z.string().nullable(),
  osSkin: z.string().nullable(),
  raw: z.string(),
});

export type DeviceSpecsInput = z.infer<typeof deviceSpecsSchema>;

export function phoneDataToDeviceSpecs(
  phone: PhoneData,
  ctx: { deviceId: string }
): DeviceSpecsInput {
  return deviceSpecsSchema.parse({
    deviceId: ctx.deviceId,
    slug: phone.slug,
    name: phone.name,
    brand: phone.brand,
    aliases: joinArray(phone.aliases),
    releaseDate: phone.releaseDate ?? null,
    height_mm: phone.height_mm,
    width_mm: phone.width_mm,
    thickness_mm: phone.thickness_mm,
    weight_g: phone.weight_g,
    materials: joinArray(phone.materials),
    ipRating: phone.ipRating,
    colors: joinArray(phone.colors),
    size_in: phone.size_in,
    displayType: phone.displayType,
    resolution: phone.resolution,
    aspectRatio: phone.aspectRatio,
    ppi: phone.ppi,
    displayFeatures: joinArray(phone.displayFeatures),
    cpu: phone.cpu,
    cpuManufacturer: phone.cpuManufacturer,
    cpuCores: joinArray(phone.cpuCores) || null,
    gpu: phone.gpu,
    sdSlot: phone.sdSlot,
    skus: phone.skus,
    fingerprintPosition: phone.fingerprintPosition,
    benchmarks: phone.benchmarks,
    nfc: phone.nfc,
    bluetooth: phone.bluetooth,
    sim: joinArray(phone.sim),
    simCount: phone.simCount,
    usb: phone.usb,
    headphoneJack: phone.headphoneJack,
    batteryCapacity_mah: phone.batteryCapacity_mah,
    batteryFastCharging: phone.batteryFastCharging,
    batteryWattage: phone.batteryWattage,
    cameras: phone.cameras.map((c) => ({
      resolution_mp: c.resolution_mp,
      aperture_fstop: c.aperture_fstop ?? "",
      sensor: c.sensor,
      type: c.type,
      features: joinArray(c.features) || null,
    })),
    cameraFeatures: joinArray(phone.cameraFeatures),
    os: phone.os,
    osSkin: phone.osSkin,
    raw: JSON.stringify(phone),
  });
}

export async function saveDeviceSpecs(data: DeviceSpecsInput) {
  logger.info(`Saving device specs for device ${data.deviceId}`, {
    slug: data.slug,
    name: data.name,
  });

  const existingBySlug = await db.query.deviceCharacteristics.findFirst({
    where: eq(deviceCharacteristics.slug, data.slug),
    columns: {
      id: true,
      deviceId: true,
    },
  });

  if (existingBySlug) {
    const existingDevice = await db.query.device.findFirst({
      where: eq(device.id, existingBySlug.deviceId),
      columns: {
        id: true,
        name: true,
      },
    });

    throw new SlugConflictError(
      `Slug "${data.slug}" already exists for device "${existingDevice?.name ?? "Unknown"}"`,
      {
        slug: data.slug,
        existingCharacteristicsId: existingBySlug.id,
        existingDeviceId: existingBySlug.deviceId,
        existingDeviceName: existingDevice?.name ?? null,
      }
    );
  }

  const result = await db.transaction(async (tx) => {
    const insertedCharacteristicsResult = await tx
      .insert(deviceCharacteristics)
      .values({
        deviceId: data.deviceId,
        name: data.name,
        slug: data.slug,
        brand: data.brand,
        aliases: data.aliases,
        releaseDate: data.releaseDate,
        height_mm: data.height_mm,
        width_mm: data.width_mm,
        thickness_mm: data.thickness_mm,
        weight_g: data.weight_g,
        materials: data.materials,
        ipRating: data.ipRating,
        colors: data.colors,
        cpu: data.cpu,
        cpuManufacturer: data.cpuManufacturer,
        cpuCores: data.cpuCores,
        gpu: data.gpu,
        sdSlot: data.sdSlot,
        fingerprintPosition: data.fingerprintPosition,
        nfc: data.nfc,
        bluetooth: data.bluetooth,
        sim: data.sim,
        simCount: data.simCount,
        usb: data.usb,
        headphoneJack: data.headphoneJack,
        batteryCapacity_mah: data.batteryCapacity_mah,
        batteryFastCharging: data.batteryFastCharging,
        batteryWattage: data.batteryWattage,
        cameraFeatures: data.cameraFeatures,
        os: data.os,
        osSkin: data.osSkin,
        raw: data.raw,
      })
      .returning();

    if (!insertedCharacteristicsResult[0]) {
      throw new Error("Failed to insert device characteristics");
    }

    const insertedCharacteristics = insertedCharacteristicsResult[0];

    await tx.insert(screen).values({
      characteristicsId: insertedCharacteristics.id,
      position: "main",
      isMain: true,
      size_in: data.size_in,
      displayType: data.displayType,
      resolution: data.resolution,
      aspectRatio: data.aspectRatio,
      ppi: data.ppi,
      displayFeatures: data.displayFeatures,
    });

    if (data.skus.length > 0) {
      await tx.insert(sku).values(
        data.skus.map((skuItem) => ({
          characteristicsId: insertedCharacteristics.id,
          marketId: skuItem.marketId,
          ram_gb: skuItem.ram_gb,
          storage_gb: skuItem.storage_gb,
        }))
      );
    }

    if (data.cameras.length > 0) {
      await tx.insert(camera).values(
        data.cameras.map((cameraItem) => ({
          characteristicsId: insertedCharacteristics.id,
          resolution_mp: cameraItem.resolution_mp,
          aperture_fstop: cameraItem.aperture_fstop,
          sensor: cameraItem.sensor,
          type: cameraItem.type,
          features: cameraItem.features,
        }))
      );
    }

    if (data.benchmarks.length > 0) {
      await tx.insert(benchmark).values(
        data.benchmarks.map((benchmarkItem) => ({
          characteristicsId: insertedCharacteristics.id,
          name: benchmarkItem.name,
          score: benchmarkItem.score,
        }))
      );
    }

    return insertedCharacteristics;
  });

  logger.info(`Device specs saved successfully for device ${data.deviceId}`, {
    characteristicsId: result.id,
  });

  return result;
}
