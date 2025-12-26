import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/src/server/db";
import { eq } from "drizzle-orm";
import { rating, ratingsGroup } from "@/src/server/db/schema";

// Response interfaces
interface DeviceLink {
  id: string;
  url: string | null;
  name?: string | null;
  price: number;
  marketplace?: {
    id: string;
    name: string | null;
    iconUrl: string | null;
    baseUrl: string | null;
  } | null;
}

interface DeviceData {
  id: string;
  name?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  rank: number;  // Position in rating
  price?: number | null;
  slug?: string | null;
  valueRating?: number | null;
  deviceUrl: string | null;
  links: DeviceLink[];
}

interface RatingDataResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    pageSlug?: string | null;
    pageUrl?: string | null;
    ratingType?: {
      id: string;
      name: string;
      displayName?: string | null;
    };
    devices: DeviceData[];
  };
  error?: string;
}

// Cache for rating data (5 minutes TTL)
const ratingDataCache = new Map<string, { data: RatingDataResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// Fetch rating data
async function fetchRatingData(ratingId: string, baseUrl: string) {
  const ratingData = await db.query.rating.findFirst({
    where: eq(rating.id, ratingId),
    with: {
      ratingType: true,
      ratingPositions: {
        with: {
          device: {
            with: {
              links: {
                with: {
                  marketplace: true,
                },
              },
              characteristics: {
                columns: {
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: (ratingPosition, { asc }) => [asc(ratingPosition.position)],
      },
      ratingsGroupPositions: {
        with: {
          group: {
            with: {
              pages: {
                with: {
                  page: {
                    columns: {
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!ratingData) {
    return null;
  }

  // Get page slug
  const pageSlug = ratingData.ratingsGroupPositions[0]?.group?.pages[0]?.page?.slug || null;

  // Generate page URL
  const pageUrl = pageSlug
    ? `${baseUrl}/ratings/${pageSlug}?selectedRating=${ratingData.id}`
    : null;

  // Transform devices
  const devices: DeviceData[] = ratingData.ratingPositions
    .map((ratingPosition) => ({
      id: ratingPosition.device.id,
      name: ratingPosition.device.name,
      imageUrl: ratingPosition.device.imageUrl,
      description: ratingPosition.device.description,
      rank: ratingPosition.position,
      price: ratingPosition.device.links[0]?.price || null,
      slug: ratingPosition.device.characteristics?.[0]?.slug || null,
      valueRating: ratingPosition.device.valueRating,
      deviceUrl: ratingPosition.device.characteristics?.[0]?.slug
        ? `${baseUrl}/devices/${ratingPosition.device.characteristics[0].slug}`
        : null,
      links: ratingPosition.device.links.map(link => ({
        id: link.id,
        url: link.url,
        name: link.name,
        price: link.price,
        marketplace: link.marketplace ? {
          id: link.marketplace.id,
          name: link.marketplace.name,
          iconUrl: link.marketplace.iconUrl,
          baseUrl: link.marketplace.baseUrl,
        } : null,
      })),
    }))
    .sort((a, b) => a.rank - b.rank);

  return {
    id: ratingData.id,
    name: ratingData.name,
    slug: ratingData.slug,
    description: ratingData.description,
    pageSlug,
    pageUrl,
    ratingType: ratingData.ratingType ? {
      id: ratingData.ratingType.id,
      name: ratingData.ratingType.name,
      displayName: ratingData.ratingType.displayName,
    } : undefined,
    devices,
  };
}

// Fetch group data and return first rating
async function fetchGroupData(groupId: string, baseUrl: string) {
  const group = await db.query.ratingsGroup.findFirst({
    where: eq(ratingsGroup.id, groupId),
    with: {
      ratings: {
        with: {
          rating: {
            with: {
              ratingType: true,
              ratingPositions: {
                with: {
                  device: {
                    with: {
                      links: {
                        with: {
                          marketplace: true,
                        },
                      },
                      characteristics: {
                        columns: {
                          slug: true,
                        },
                      },
                    },
                  },
                },
                orderBy: (ratingPosition, { asc }) => [asc(ratingPosition.position)],
              },
            },
          },
        },
        orderBy: (ratingsGroupPosition, { asc }) => [asc(ratingsGroupPosition.position)],
      },
      pages: {
        with: {
          page: {
            columns: {
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!group) {
    return null;
  }

  const firstRating = group.ratings[0]?.rating;
  if (!firstRating) {
    return null;
  }

  // Get page slug
  const pageSlug = group.pages[0]?.page?.slug || null;
  const pageUrl = pageSlug
    ? `${baseUrl}/ratings/${pageSlug}?selectedRating=${firstRating.id}`
    : null;

  // Transform devices
  const devices: DeviceData[] = firstRating.ratingPositions
    .map((ratingPosition) => ({
      id: ratingPosition.device.id,
      name: ratingPosition.device.name,
      imageUrl: ratingPosition.device.imageUrl,
      description: ratingPosition.device.description,
      rank: ratingPosition.position,
      price: ratingPosition.device.links[0]?.price || null,
      slug: ratingPosition.device.characteristics?.[0]?.slug || null,
      valueRating: ratingPosition.device.valueRating,
      deviceUrl: ratingPosition.device.characteristics?.[0]?.slug
        ? `${baseUrl}/devices/${ratingPosition.device.characteristics[0].slug}`
        : null,
      links: ratingPosition.device.links.map(link => ({
        id: link.id,
        url: link.url,
        name: link.name,
        price: link.price,
        marketplace: link.marketplace ? {
          id: link.marketplace.id,
          name: link.marketplace.name,
          iconUrl: link.marketplace.iconUrl,
          baseUrl: link.marketplace.baseUrl,
        } : null,
      })),
    }))
    .sort((a, b) => a.rank - b.rank);

  return {
    id: firstRating.id,
    name: firstRating.name,
    slug: firstRating.slug,
    description: firstRating.description,
    pageSlug,
    pageUrl,
    ratingType: firstRating.ratingType ? {
      id: firstRating.ratingType.id,
      name: firstRating.ratingType.name,
      displayName: firstRating.ratingType.displayName,
    } : undefined,
    devices,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RatingDataResponse>
) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET request.",
    });
  }

  try {
    // Extract and validate parameters
    const { ratingId, groupId, type = "rating", baseUrl = "https://c.click-or-die.ru" } = req.query;

    if (!ratingId && !groupId) {
      return res.status(400).json({
        success: false,
        error: "Either 'ratingId' or 'groupId' parameter is required",
      });
    }

    if (type !== "rating" && type !== "group") {
      return res.status(400).json({
        success: false,
        error: "Invalid type. Must be 'rating' or 'group'",
      });
    }

    const ratingIdStr = typeof ratingId === "string" ? ratingId : undefined;
    const groupIdStr = typeof groupId === "string" ? groupId : undefined;
    const baseUrlStr = typeof baseUrl === "string" ? baseUrl : "https://c.click-or-die.ru";

    // Create cache key
    const cacheKey = `${type}-${ratingIdStr || groupIdStr}-${baseUrlStr}`;

    // Check cache
    const cached = ratingDataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json(cached.data);
    }

    // Fetch data
    let ratingData;
    if (type === "rating" && ratingIdStr) {
      ratingData = await fetchRatingData(ratingIdStr, baseUrlStr);
    } else if (type === "group" && groupIdStr) {
      ratingData = await fetchGroupData(groupIdStr, baseUrlStr);
    }

    if (!ratingData) {
      return res.status(404).json({
        success: false,
        error: `${type === "rating" ? "Rating" : "Group"} not found`,
      });
    }

    if (!ratingData.devices || ratingData.devices.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No devices found for this rating",
      });
    }

    // Prepare response
    const response: RatingDataResponse = {
      success: true,
      data: ratingData,
    };

    // Cache response
    ratingDataCache.set(cacheKey, { data: response, timestamp: Date.now() });

    // Clean up old cache entries periodically (1% chance)
    if (Math.random() < 0.01) {
      const now = Date.now();
      const entries = Array.from(ratingDataCache.entries());
      for (const [key, value] of entries) {
        if (now - value.timestamp > CACHE_TTL) {
          ratingDataCache.delete(key);
        }
      }
    }

    // Set cache headers (5 minutes)
    res.setHeader(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=3600"
    );

    return res.status(200).json(response);
  } catch (error) {
    console.error("Rating data API error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
