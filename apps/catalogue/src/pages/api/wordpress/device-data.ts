import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/src/server/db";
import { device } from "@/src/server/db/schema";
import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { getClientIp, makeMemoryRateLimiter } from "@/src/server/http/rateLimit";
import { generateWordPressLink } from "@/src/server/utils/wordpress-link-generator";
import { env } from "@/src/env.mjs";

const DeviceDataQuery = z.object({
  deviceId: z.string().min(1, "deviceId parameter is required"),
});

interface DeviceData {
  deviceId: string;
  name: string;
  description: string | null;
  imageUrl: string;
  price: number;
  marketUrl: string;
  aliUrl: string | null;
  updatedAt: string;
}

interface SuccessResponse {
  success: true;
  device: DeviceData;
}

interface ErrorResponse {
  success: false;
  error: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

const deviceDataCache = new Map<
  string,
  { data: DeviceData; timestamp: number }
>();
const CACHE_TTL = 60 * 60 * 1000;

const rateLimiter = makeMemoryRateLimiter({ max: 100, windowMs: 60_000 });

async function fetchDeviceData(deviceId: string): Promise<DeviceData> {
  const deviceData = await db.query.device.findFirst({
    where: eq(device.id, deviceId),
    with: {
      links: true,
    },
  });

  if (!deviceData || !deviceData.name || !deviceData.imageUrl) {
    throw new Error("Device not found");
  }

  const validLink = deviceData.links.find(
    (l) => l.url && l.price !== null
  );

  if (!validLink || !validLink.url) {
    throw new Error("Device not found");
  }

  const mostRecentUpdate = deviceData.links.reduce(
    (latest, link) => (link.updatedAt > latest ? link.updatedAt : latest),
    deviceData.updatedAt
  );

  return {
    deviceId: deviceData.id,
    name: deviceData.name,
    description: deviceData.description || null,
    imageUrl: deviceData.imageUrl,
    price: validLink.price,
    marketUrl: validLink.url,
    aliUrl: null,
    updatedAt: mostRecentUpdate.toISOString(),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  res.setHeader("Access-Control-Allow-Origin", "https://click-or-die.ru");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  if (!rateLimiter.check(getClientIp(req))) {
    return res.status(429).json({
      success: false,
      error: "Rate limit exceeded",
    });
  }

  res.setHeader("Cache-Control", "public, max-age=3600");

  try {
    const { deviceId } = DeviceDataQuery.parse(req.query);

    const cached = deviceDataCache.get(deviceId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json({
        success: true,
        device: cached.data,
      });
    }

    const deviceData = await fetchDeviceData(deviceId);

    if (!env.YOURLS_SIGNATURE) {
      throw new Error("YOURLS_SIGNATURE is not configured");
    }

    const wordpressLink = await generateWordPressLink(
      deviceData.marketUrl,
      env.YOURLS_SIGNATURE
    );

    const updatedDeviceData = {
      ...deviceData,
      marketUrl: wordpressLink,
    };

    deviceDataCache.set(deviceId, {
      data: updatedDeviceData,
      timestamp: Date.now(),
    });

    return res.status(200).json({
      success: true,
      device: updatedDeviceData,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues[0]?.message ?? "Invalid query",
      });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    if (errorMessage.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: errorMessage,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
