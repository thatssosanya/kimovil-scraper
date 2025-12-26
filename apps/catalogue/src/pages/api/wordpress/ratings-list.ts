import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/src/server/db";

interface RatingItem {
  id: string;
  name: string;
  deviceCount: number;
  updatedAt: string;
}

interface RatingsListResponse {
  success: boolean;
  ratings: RatingItem[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RatingsListResponse>
) {
  // Set CORS headers for external usage
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "hx-current-url, hx-request, Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow GET requests after handling OPTIONS
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      ratings: [],
      error: "Method not allowed. Use GET request.",
    });
  }

  try {
    // Fetch ratings with device count
    const ratings = await db.query.rating.findMany({
      columns: {
        id: true,
        name: true,
        updatedAt: true,
      },
      with: {
        devices: {
          columns: {
            A: true, // deviceId
          },
        },
      },
      orderBy: (rating, { desc }) => [desc(rating.updatedAt)],
      limit: 100, // Limit to 100 most recent ratings
    });

    // Transform data for response
    const ratingsData: RatingItem[] = ratings.map((ratingItem) => ({
      id: ratingItem.id,
      name: ratingItem.name,
      deviceCount: ratingItem.devices.length,
      updatedAt: ratingItem.updatedAt.toISOString(),
    }));

    // Set cache headers
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600"); // 5min cache, 10min stale

    res.status(200).json({
      success: true,
      ratings: ratingsData,
    });
  } catch (error) {
    console.error("Ratings list API error:", error);
    
    res.status(500).json({
      success: false,
      ratings: [],
      error: "Failed to fetch ratings list",
    });
  }
}