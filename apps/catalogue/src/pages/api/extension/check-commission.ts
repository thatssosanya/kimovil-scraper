import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/src/env.mjs";
import { db } from "@/src/server/db";
import { eq } from "drizzle-orm";
import { aliExpressItem } from "@/src/server/db/schema";

// Import directly from the factory file to work around package import issues
import { createAdmitadClient } from "admitad-api-client/dist/src/client/factory.js";

interface CheckCommissionRequest {
  secret: string;
  urls: string[];
}

interface AliExpressCommissionRate {
  url: string;
  product_name: string | null;
  commission_rate: number | null;
  hot_commission_rate: number | null;
  is_hot: boolean;
}

interface AliExpressCommissionResponse {
  commission_rates: AliExpressCommissionRate[];
}

interface CheckCommissionResponse {
  success: boolean;
  data?: AliExpressCommissionResponse;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CheckCommissionResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const { secret, urls } = req.body as CheckCommissionRequest;

    // Validate input
    if (!secret || !urls || !Array.isArray(urls)) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: secret, urls",
      });
    }

    // Verify extension secret
    if (secret !== env.EXTENSION_SECRET) {
      return res.status(401).json({
        success: false,
        error: "Invalid extension secret",
      });
    }

    // Validate URLs array
    if (urls.length === 0 || urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: "URLs array must contain 1-10 URLs",
      });
    }

    // Validate URL format
    for (const url of urls) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          success: false,
          error: `Invalid URL format: ${url}`,
        });
      }
    }

    // Create Admitad client
    const client = createAdmitadClient();

    // Authenticate with AliExpress commission scope
    await client.authenticate(["aliexpress_commission"]);

    // Get commission rates
    const commissionData = await client.getAliExpressCommissionRates(urls);

    // Save/update commission data in database
    if (commissionData?.commission_rates) {
      await Promise.all(
        commissionData.commission_rates.map(async (item) => {
          try {
            // Check if item already exists
            const existingItem = await db.query.aliExpressItem.findFirst({
              where: eq(aliExpressItem.url, item.url),
            });

            const commissionRateString =
              item.commission_rate?.toString() || null;

            if (existingItem) {
              // Update existing item
              await db
                .update(aliExpressItem)
                .set({
                  name: item.product_name || existingItem.name,
                  commissionRate: commissionRateString,
                })
                .where(eq(aliExpressItem.url, item.url));
            } else {
              // Create new item
              await db.insert(aliExpressItem).values({
                url: item.url,
                name: item.product_name,
                commissionRate: commissionRateString,
              });
            }
          } catch (dbError) {
            console.error(
              `Failed to save/update AliExpress item ${item.url}:`,
              dbError
            );
            // Continue with other items even if one fails
          }
        })
      );
    }

    return res.status(200).json({
      success: true,
      data: commissionData,
    });
  } catch (error) {
    console.error("Extension AliExpress commission check error:", error);

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
      error: "Не удалось получить данные о комиссии AliExpress",
    });
  }
}
