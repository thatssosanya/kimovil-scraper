import { z } from "zod";
import { env } from "@/src/env.mjs";
import { db } from "@/src/server/db";
import {
  deviceCharacteristics,
  screen,
  sku,
  camera,
  benchmark,
} from "@/src/server/db/schema";
import { type NextApiRequest, type NextApiResponse } from "next";
import { safeJsonParse } from "@/src/utils/utils";

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

const deviceSpecsSchema = z.object({
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

const deviceSpecsInputSchema = z
  .union([z.string(), z.object({})])
  .transform((input) => {
    if (typeof input === "string") {
      const parsed = safeJsonParse(input);
      return {
        ...deviceSpecsSchema.parse(parsed),
      };
    }
    return {
      ...deviceSpecsSchema.parse(input),
    };
  });

const saveDeviceSpecs = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Expected POST" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const authPart = authHeader.split(" ");
  if (authPart.length !== 2 || authPart[0] !== "Basic") {
    return res.status(401).json({ message: "Invalid Authorization format" });
  }

  try {
    const authDecoded = Buffer.from(authPart[1]!, "base64").toString();
    const [_, secretDecoded] = authDecoded.split(":");
    if (secretDecoded !== env.SCRAPER_API_SECRET) {
      return res.status(401).json({ message: "Failed to authenticate" });
    }
  } catch {
    return res
      .status(401)
      .json({ message: "Invalid base64 encoding in Authorization header" });
  }

  const parsedBody = deviceSpecsInputSchema.parse(req.body);

  const validationResult = deviceSpecsSchema.safeParse(parsedBody);

  if (!validationResult.success) {
    console.error("Validation error:", validationResult.error);
    return res.status(400).json({ errors: validationResult.error.issues });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const insertedCharacteristicsResult = await tx
        .insert(deviceCharacteristics)
        .values({
          deviceId: validationResult.data.deviceId,
          name: validationResult.data.name,
          slug: validationResult.data.slug,
          brand: validationResult.data.brand,
          aliases: validationResult.data.aliases,
          releaseDate: validationResult.data.releaseDate,
          height_mm: validationResult.data.height_mm,
          width_mm: validationResult.data.width_mm,
          thickness_mm: validationResult.data.thickness_mm,
          weight_g: validationResult.data.weight_g,
          materials: validationResult.data.materials,
          ipRating: validationResult.data.ipRating,
          colors: validationResult.data.colors,
          cpu: validationResult.data.cpu,
          cpuManufacturer: validationResult.data.cpuManufacturer,
          cpuCores: validationResult.data.cpuCores,
          gpu: validationResult.data.gpu,
          sdSlot: validationResult.data.sdSlot,
          fingerprintPosition: validationResult.data.fingerprintPosition,
          nfc: validationResult.data.nfc,
          bluetooth: validationResult.data.bluetooth,
          sim: validationResult.data.sim,
          simCount: validationResult.data.simCount,
          usb: validationResult.data.usb,
          headphoneJack: validationResult.data.headphoneJack,
          batteryCapacity_mah: validationResult.data.batteryCapacity_mah,
          batteryFastCharging: validationResult.data.batteryFastCharging,
          batteryWattage: validationResult.data.batteryWattage,
          cameraFeatures: validationResult.data.cameraFeatures,
          os: validationResult.data.os,
          osSkin: validationResult.data.osSkin,
          raw: validationResult.data.raw,
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
        size_in: validationResult.data.size_in,
        displayType: validationResult.data.displayType,
        resolution: validationResult.data.resolution,
        aspectRatio: validationResult.data.aspectRatio,
        ppi: validationResult.data.ppi,
        displayFeatures: validationResult.data.displayFeatures,
      });

      if (validationResult.data.skus.length > 0) {
        await tx.insert(sku).values(
          validationResult.data.skus.map((skuItem) => ({
            characteristicsId: insertedCharacteristics.id,
            marketId: skuItem.marketId,
            ram_gb: skuItem.ram_gb,
            storage_gb: skuItem.storage_gb,
          }))
        );
      }

      if (validationResult.data.cameras.length > 0) {
        await tx.insert(camera).values(
          validationResult.data.cameras.map((cameraItem) => ({
            characteristicsId: insertedCharacteristics.id,
            resolution_mp: cameraItem.resolution_mp,
            aperture_fstop: cameraItem.aperture_fstop,
            sensor: cameraItem.sensor,
            type: cameraItem.type,
            features: cameraItem.features,
          }))
        );
      }

      if (validationResult.data.benchmarks.length > 0) {
        await tx.insert(benchmark).values(
          validationResult.data.benchmarks.map((benchmarkItem) => ({
            characteristicsId: insertedCharacteristics.id,
            name: benchmarkItem.name,
            score: benchmarkItem.score,
          }))
        );
      }

      return insertedCharacteristics;
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error saving device characteristics:", error);
    res.status(500).json({ message: "Error saving device characteristics" });
  }
};

export default saveDeviceSpecs;
