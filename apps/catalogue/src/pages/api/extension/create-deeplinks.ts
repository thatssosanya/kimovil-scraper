import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/src/env.mjs";
import { db } from "@/src/server/db";
import { eq } from "drizzle-orm";
import { aliExpressItem } from "@/src/server/db/schema";

// Import directly from the factory file to work around package import issues
import { createAdmitadClient } from "admitad-api-client/dist/src/client/factory.js";

interface CreateDeeplinksRequest {
  secret: string;
  url: string; // Changed to single URL
}

interface CreateDeeplinksResponse {
  success: boolean;
  data?: {
    url: string;
    deeplink: string;
    status: string;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateDeeplinksResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const { secret, url } = req.body as CreateDeeplinksRequest;

    // Validate input
    if (!secret || !url) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: secret, url",
      });
    }

    // Verify extension secret
    if (secret !== env.EXTENSION_SECRET) {
      return res.status(401).json({
        success: false,
        error: "Invalid extension secret",
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: `Invalid URL format: ${url}`,
      });
    }

    // Create Admitad client
    const client = createAdmitadClient();

    // Authenticate with AliExpress commission scope
    await client.authenticate(["aliexpress_commission", "deeplink_generator"]);

    let deeplink = url; // Default fallback

    try {
      // Generate deeplink for single URL
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const deeplinkResult = await client.generateDeeplinks("790462", "25179", {
        ulp: [url],
      });

      // Extract the deeplink from the result with proper type checking
      if (Array.isArray(deeplinkResult) && deeplinkResult.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const firstResult = deeplinkResult[0];
        if (
          firstResult &&
          typeof firstResult === "object" &&
          "link" in firstResult
        ) {
          deeplink = (firstResult as { link: string }).link || url;
        }
      }
    } catch (deeplinkError) {
      console.warn(
        "Failed to generate deeplink, using original URL:",
        deeplinkError
      );
      // deeplink remains as the original url
    }

    // Save/update URL in database
    try {
      const existingItem = await db.query.aliExpressItem.findFirst({
        where: eq(aliExpressItem.url, url),
      });

      if (!existingItem) {
        // Create new item with basic info
        await db.insert(aliExpressItem).values({
          url,
          name: null, // Will be populated when commission is checked
          commissionRate: null,
        });
      }
      // If item exists, we don't need to update it here since we don't have new commission data
    } catch (dbError) {
      console.error(`Failed to save AliExpress item ${url}:`, dbError);
      // Continue even if database operation fails
    }

    return res.status(200).json({
      success: true,
      data: {
        url,
        deeplink,
        status: "success",
      },
    });
  } catch (error) {
    console.error("Extension AliExpress deeplink creation error:", error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes("Authentication failed")) {
        return res.status(401).json({
          success: false,
          error:
            "Ошибка аутентификации с Admitad API. Проверьте настройки API ключей.",
        });
      }

      if (error.message.includes("Invalid URL")) {
        return res.status(400).json({
          success: false,
          error: "Некорректный формат ссылки AliExpress",
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: "Не удалось создать deeplink для AliExpress",
    });
  }
}
