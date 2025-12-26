import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/src/server/db";
import { device, link } from "@/src/server/db/schema";
import { sql, eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { getClientIp, makeMemoryRateLimiter } from "@/src/server/http/rateLimit";

const AutocompleteQuery = z.object({
  query: z.string().min(2, "Query parameter is required (minimum 2 characters)"),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be between 1 and 50")
    .max(50, "Limit must be between 1 and 50")
    .default(10),
});

interface AutocompleteDevice {
  deviceId: string;
  name: string;
  imageUrl: string;
  price: number;
  marketUrl: string;
}

interface SuccessResponse {
  success: true;
  devices: AutocompleteDevice[];
}

interface ErrorResponse {
  success: false;
  error: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

const autocompleteCache = new Map<
  string,
  { data: AutocompleteDevice[]; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000;

const rateLimiter = makeMemoryRateLimiter({ max: 100, windowMs: 60_000 });

async function searchDevices(
  searchQuery: string,
  limit: number
): Promise<AutocompleteDevice[]> {
  const searchPattern = `%${searchQuery.toLowerCase()}%`;

  const results = await db
    .select({
      deviceId: device.id,
      name: device.name,
      imageUrl: device.imageUrl,
      price: link.price,
      marketUrl: link.url,
    })
    .from(device)
    .leftJoin(link, eq(device.id, link.deviceId))
    .where(sql`lower(${device.name}) LIKE ${searchPattern}`)
    .orderBy(sql`lower(${device.name}) ASC`, sql`${link.price} ASC`)
    .limit(limit * 3);

  const deviceMap = new Map<string, AutocompleteDevice>();

  for (const row of results) {
    if (
      !deviceMap.has(row.deviceId) &&
      row.name &&
      row.imageUrl &&
      row.price !== null &&
      row.marketUrl
    ) {
      deviceMap.set(row.deviceId, {
        deviceId: row.deviceId,
        name: row.name,
        imageUrl: row.imageUrl,
        price: row.price,
        marketUrl: row.marketUrl,
      });

      if (deviceMap.size >= limit) {
        break;
      }
    }
  }

  return Array.from(deviceMap.values());
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

  res.setHeader("Cache-Control", "public, max-age=300");

  try {
    const { query, limit } = AutocompleteQuery.parse(req.query);

    const cacheKey = `${query.toLowerCase()}-${limit}`;
    const cached = autocompleteCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json({
        success: true,
        devices: cached.data,
      });
    }

    const devices = await searchDevices(query, limit);

    autocompleteCache.set(cacheKey, {
      data: devices,
      timestamp: Date.now(),
    });

    return res.status(200).json({
      success: true,
      devices,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues[0]?.message ?? "Invalid query",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
