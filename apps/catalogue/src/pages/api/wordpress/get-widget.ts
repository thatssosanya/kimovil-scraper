import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/src/server/db";
import { eq } from "drizzle-orm";
import {
  rating,
  ratingsGroup,
} from "@/src/server/db/schema";
import { generateRatingWidgetTemplate } from "@/src/utils/generateRatingWidgetTemplate";

// Simple in-memory cache
const widgetCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Widget response interface

// Validation function for query parameters
function validateQueryParams(query: NextApiRequest["query"]) {
  const { ratingId, groupId, type = "rating", baseUrl } = query;

  if (!ratingId && !groupId) {
    throw new Error("Either 'ratingId' or 'groupId' parameter is required");
  }

  if (type !== "rating" && type !== "group") {
    throw new Error("Invalid type. Must be 'rating' or 'group'");
  }

  return {
    ratingId: typeof ratingId === "string" ? ratingId : undefined,
    groupId: typeof groupId === "string" ? groupId : undefined,
    type: type === "group" ? "group" : "rating",
    baseUrl: baseUrl ? String(baseUrl) : "https://c.click-or-die.ru",
  };
}

// Fetch rating data for widget
async function fetchRatingData(ratingId: string): Promise<RatingData> {
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
    throw new Error(`Rating with ID '${ratingId}' not found`);
  }

  // Get the first page slug (ratings can be on multiple pages, but we'll use the first one)
  const pageSlug =
    ratingData.ratingsGroupPositions[0]?.group?.pages[0]?.page?.slug || null;

  // Transform data to match component interface
  return {
    ...ratingData,
    pageSlug,
    devices: ratingData.ratingPositions
      .map((ratingPosition) => ({
        ...ratingPosition.device,
        slug: ratingPosition.device.characteristics?.[0]?.slug,
        ratingPosition: ratingPosition.position,
        price: ratingPosition.device.links[0]?.price || null,
        links: ratingPosition.device.links,
      }))
      .sort((a, b) => (a.ratingPosition || 0) - (b.ratingPosition || 0)),
  };
}

// Fetch group data and render first rating
async function fetchGroupData(groupId: string): Promise<RatingData> {
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
    throw new Error(`Rating group with ID '${groupId}' not found`);
  }

  const firstRating = group.ratings[0]?.rating;
  if (!firstRating) {
    throw new Error(`No ratings found in group '${groupId}'`);
  }

  // Get page slug from the group or the first rating
  const pageSlug =
    group.pages[0]?.page?.slug ||
    firstRating.ratingsGroupPositions[0]?.group?.pages[0]?.page?.slug ||
    null;

  // Transform data to match component interface
  return {
    ...firstRating,
    pageSlug,
    devices: firstRating.ratingPositions
      .map((ratingPosition) => ({
        ...ratingPosition.device,
        slug: ratingPosition.device.characteristics?.[0]?.slug,
        ratingPosition: ratingPosition.position,
        price: ratingPosition.device.links[0]?.price || null,
        links: ratingPosition.device.links,
      }))
      .sort((a, b) => (a.ratingPosition || 0) - (b.ratingPosition || 0)),
  };
}

// Define the rating type for better type safety
interface RatingData {
  id: string;
  name: string;
  pageSlug?: string | null;
  devices: Array<{
    id: string;
    name?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    ratingPosition?: number | null;
    price?: number | null;
    slug?: string | null;
    valueRating?: number | null;
    links?: Array<{
      url: string | null;
      name?: string | null;
      marketplace?: {
        name: string | null;
        iconUrl: string | null;
      } | null;
    }>;
  }>;
}

// Render widget to HTML string using template literals
function renderWidget(rating: RatingData, baseUrl: string): string {
  try {
    return generateRatingWidgetTemplate(rating, {
      baseUrl,
      showTitle: true,
      className: "cod-widget cod-ratings-widget",
      showFooter: true,
    });
  } catch (error) {
    throw new Error(
      `Failed to render widget: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<string>
) {
  // Set CORS headers for external usage
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "hx-current-url, hx-request, Content-Type"
  );

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow GET requests after handling OPTIONS
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed. Use GET request.");
  }

  // Set aggressive caching headers (5 minutes cache, 1 hour stale-while-revalidate)
  res.setHeader(
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=3600, s-maxage=300"
  );

  // Set proper encoding headers
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Accept-Charset", "utf-8");

  try {
    // Validate and extract query parameters
    const { ratingId, groupId, type, baseUrl } = validateQueryParams(req.query);

    // Create cache key
    const cacheKey = `${type}-${ratingId || groupId}-${baseUrl}`;

    // Check cache first
    const cached = widgetCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Return cached response
      res.status(200).send(cached.data);
      return;
    }

    // Fetch data based on type
    let rating;
    if (type === "rating" && ratingId) {
      rating = await fetchRatingData(ratingId);
    } else if (type === "group" && groupId) {
      rating = await fetchGroupData(groupId);
    } else {
      throw new Error("Invalid combination of parameters");
    }

    // Validate that we have devices to render
    if (!rating.devices || rating.devices.length === 0) {
      throw new Error("No devices found for this rating");
    }

    // Render widget to HTML
    const widget = renderWidget(rating, baseUrl);

    // Validate rendered HTML
    if (!widget || widget.trim().length === 0) {
      throw new Error("Failed to render widget HTML");
    }

    // Ensure UTF-8 encoding and return successful response
    const utf8Widget = Buffer.from(widget, "utf8").toString("utf8");

    // Cache the successful response
    widgetCache.set(cacheKey, { data: utf8Widget, timestamp: Date.now() });

    // Clean up old cache entries periodically
    if (Math.random() < 0.01) {
      // 1% chance to cleanup
      const now = Date.now();
      for (const [key, value] of widgetCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          widgetCache.delete(key);
        }
      }
    }

    res.status(200).send(utf8Widget);
  } catch (error) {
    console.error("Widget API Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    // Determine appropriate error status code
    let statusCode = 400;
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";

    if (errorMessage.includes("not found")) {
      statusCode = 404;
    } else if (
      errorMessage.includes("Invalid") ||
      errorMessage.includes("required")
    ) {
      statusCode = 400;
    } else if (errorMessage.includes("Failed to render")) {
      statusCode = 500;
    }

    // Return error response
    res.status(statusCode).send(errorMessage);
  }
}
