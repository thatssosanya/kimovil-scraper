import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { toast } from "sonner";
import { yandexDistributionService } from "@/src/services/yandex-distribution/yandex-distribution.service";
import { eq, desc, asc, and, or, like, inArray, lt, gt } from "drizzle-orm";
import {
  link,
  device,
  marketplace,
  config,
  sku,
  ratingPosition,
  deviceToRating,
  deviceCharacteristics,
} from "@/src/server/db/schema";

// Import directly from the factory file to work around package import issues
import { createAdmitadClient } from "admitad-api-client/dist/src/client/factory.js";

interface RedirectResult {
  statusCode: number;
  location: string;
  title?: string;
}

async function getRedirectLocation(
  url: string,
  depth = 0
): Promise<RedirectResult> {
  // Maximum number of redirects to follow
  const MAX_REDIRECTS = 5;

  if (depth >= MAX_REDIRECTS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Превышено максимальное количество редиректов",
    });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
    }).catch(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Не удалось подключиться к сайту. Проверьте правильность ссылки.",
      });
    });

    // If we got a redirect status code (301, 302, 303, 307, 308)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Сервер вернул некорректный редирект",
        });
      }

      // Check if the location is a Yandex Market URL
      try {
        const locationUrl = new URL(location);
        if (locationUrl.hostname === "market.yandex.ru") {
          // If it's a Yandex Market URL, try to get the title
          const finalResult = await getRedirectLocation(location, depth + 1);
          return {
            statusCode: response.status,
            location: location,
            title: finalResult.title,
          };
        }
      } catch {
        // If URL parsing fails, continue with the redirect
      }

      // Follow the redirect
      return getRedirectLocation(location, depth + 1);
    }

    // If we got a 200, try to get the title
    if (response.status === 200) {
      try {
        const text = await response.text();
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        return {
          statusCode: response.status,
          location: url,
          title: titleMatch?.[1] ?? undefined,
        };
      } catch {
        // If we can't parse the response, just return without title
        return {
          statusCode: response.status,
          location: url,
        };
      }
    }

    // If we got an error status
    if (response.status >= 400) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Сервер вернул ошибку ${response.status}`,
      });
    }

    // If we got any other status
    return {
      statusCode: response.status,
      location: url,
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Не удалось обработать ссылку",
    });
  }
}

export const linkRouter = createTRPCRouter({
  /**
   * Retrieves all links with pagination and search
   * @param limit Maximum number of items to return (default: 20)
   * @param cursor Pagination cursor
   * @param search Optional search string to filter links
   * @returns Paginated list of links with nextCursor
   */
  getAllLinks: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, search } = input;

      // Build the base query
      const whereConditions = [];

      if (search) {
        whereConditions.push(
          or(
            like(link.name, `%${search}%`),
            like(marketplace.name, `%${search}%`)
          )
        );
      }

      // Add cursor condition for pagination
      if (cursor) {
        const cursorItem = await ctx.db
          .select({ createdAt: link.createdAt })
          .from(link)
          .where(eq(link.id, cursor))
          .limit(1);

        if (cursorItem.length > 0 && cursorItem[0]) {
          const cursorDate = cursorItem[0].createdAt;
          whereConditions.push(
            or(
              lt(link.createdAt, cursorDate),
              and(eq(link.createdAt, cursorDate), gt(link.id, cursor))
            )
          );
        }
      }

      const items = await ctx.db
        .select({
          id: link.id,
          name: link.name,
          url: link.url,
          price: link.price,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
          deviceId: link.deviceId,
          marketplaceId: link.marketplaceId,
          configId: link.configId,
          skuId: link.skuId,
          marketplace: {
            id: marketplace.id,
            name: marketplace.name,
            iconUrl: marketplace.iconUrl,
            baseUrl: marketplace.baseUrl,
            createdAt: marketplace.createdAt,
            updatedAt: marketplace.updatedAt,
          },
          config: {
            id: config.id,
            name: config.name,
            capacity: config.capacity,
            ram: config.ram,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
          },
        })
        .from(link)
        .leftJoin(marketplace, eq(link.marketplaceId, marketplace.id))
        .leftJoin(config, eq(link.configId, config.id))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(link.createdAt), asc(link.id)) // Add id tie-breaker for consistent pagination
        .limit(limit + 1);

      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Gets all links for a specific marketplace
   * @param id Marketplace ID
   * @param onlyInRatings Filter to only show devices that are in ratings
   * @param onlyPublished Filter to only show published devices
   * @returns List of links for the marketplace with related data
   */
  getMarketplaceLinks: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        onlyInRatings: z.boolean().optional(),
        onlyPublished: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      let query = ctx.db
        .select({
          id: link.id,
          name: link.name,
          url: link.url,
          price: link.price,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
          deviceId: link.deviceId,
          marketplaceId: link.marketplaceId,
          configId: link.configId,
          skuId: link.skuId,
          device: {
            id: device.id,
            name: device.name,
            type: device.type,
            imageUrl: device.imageUrl,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
            yandexId: device.yandexId,
            widgetId: device.widgetId,
            description: device.description,
            valueRating: device.valueRating,
          },
          marketplace: {
            id: marketplace.id,
            name: marketplace.name,
            iconUrl: marketplace.iconUrl,
            baseUrl: marketplace.baseUrl,
            createdAt: marketplace.createdAt,
            updatedAt: marketplace.updatedAt,
          },
          config: {
            id: config.id,
            name: config.name,
          },
        })
        .from(link)
        .leftJoin(device, eq(link.deviceId, device.id))
        .leftJoin(marketplace, eq(link.marketplaceId, marketplace.id))
        .leftJoin(config, eq(link.configId, config.id))
        .where(eq(link.marketplaceId, input.id));

      // Add rating filter if needed
      if (input.onlyInRatings) {
        const baseQuery = ctx.db
          .select({
            id: link.id,
            name: link.name,
            url: link.url,
            price: link.price,
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
            deviceId: link.deviceId,
            marketplaceId: link.marketplaceId,
            configId: link.configId,
            skuId: link.skuId,
            device: {
              id: device.id,
              name: device.name,
              type: device.type,
              imageUrl: device.imageUrl,
              createdAt: device.createdAt,
              updatedAt: device.updatedAt,
              yandexId: device.yandexId,
              widgetId: device.widgetId,
              description: device.description,
              valueRating: device.valueRating,
            },
            marketplace: {
              id: marketplace.id,
              name: marketplace.name,
              iconUrl: marketplace.iconUrl,
              baseUrl: marketplace.baseUrl,
              createdAt: marketplace.createdAt,
              updatedAt: marketplace.updatedAt,
            },
            config: {
              id: config.id,
              name: config.name,
            },
          })
          .from(link)
          .leftJoin(device, eq(link.deviceId, device.id))
          .leftJoin(marketplace, eq(link.marketplaceId, marketplace.id))
          .leftJoin(config, eq(link.configId, config.id))
          .leftJoin(ratingPosition, eq(link.deviceId, ratingPosition.deviceId))
          .leftJoin(deviceToRating, eq(link.deviceId, deviceToRating.A))
          .where(
            and(
              eq(link.marketplaceId, input.id),
              or(
                eq(ratingPosition.deviceId, link.deviceId),
                eq(deviceToRating.A, link.deviceId)
              )
            )
          );
        query = baseQuery;
      }

      // Add published filter if needed
      if (input.onlyPublished) {
        const baseQuery = ctx.db
          .select({
            id: link.id,
            name: link.name,
            url: link.url,
            price: link.price,
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
            deviceId: link.deviceId,
            marketplaceId: link.marketplaceId,
            configId: link.configId,
            skuId: link.skuId,
            device: {
              id: device.id,
              name: device.name,
              type: device.type,
              imageUrl: device.imageUrl,
              createdAt: device.createdAt,
              updatedAt: device.updatedAt,
              yandexId: device.yandexId,
              widgetId: device.widgetId,
              description: device.description,
              valueRating: device.valueRating,
            },
            marketplace: {
              id: marketplace.id,
              name: marketplace.name,
              iconUrl: marketplace.iconUrl,
              baseUrl: marketplace.baseUrl,
              createdAt: marketplace.createdAt,
              updatedAt: marketplace.updatedAt,
            },
            config: {
              id: config.id,
              name: config.name,
            },
          })
          .from(link)
          .leftJoin(device, eq(link.deviceId, device.id))
          .leftJoin(marketplace, eq(link.marketplaceId, marketplace.id))
          .leftJoin(config, eq(link.configId, config.id))
          .leftJoin(
            deviceCharacteristics,
            eq(link.deviceId, deviceCharacteristics.deviceId)
          )
          .where(
            and(
              eq(link.marketplaceId, input.id),
              eq(deviceCharacteristics.status, "PUBLISHED"),
              input.onlyInRatings
                ? or(
                    eq(ratingPosition.deviceId, link.deviceId),
                    eq(deviceToRating.A, link.deviceId)
                  )
                : undefined
            )
          );

        if (input.onlyInRatings) {
          query = baseQuery
            .leftJoin(
              ratingPosition,
              eq(link.deviceId, ratingPosition.deviceId)
            )
            .leftJoin(deviceToRating, eq(link.deviceId, deviceToRating.A));
        } else {
          query = baseQuery;
        }
      }

      const results = await query;

      // Get additional device data separately for each result
      const enrichedResults = await Promise.all(
        results.map(async (result) => {
          if (!result.device?.id) return result;

          // Get rating positions
          const ratingPositions = await ctx.db
            .select()
            .from(ratingPosition)
            .where(eq(ratingPosition.deviceId, result.device.id));

          // Get ratings through junction table
          const ratings = await ctx.db
            .select()
            .from(deviceToRating)
            .where(eq(deviceToRating.A, result.device.id));

          // Get characteristics
          const characteristics = await ctx.db
            .select({
              status: deviceCharacteristics.status,
              publishedAt: deviceCharacteristics.publishedAt,
            })
            .from(deviceCharacteristics)
            .where(eq(deviceCharacteristics.deviceId, result.device.id));

          return {
            ...result,
            device: {
              ...result.device,
              RatingPosition: ratingPositions,
              ratings,
              characteristics,
            },
          };
        })
      );

      return enrichedResults;
    }),

  /**
   * Associates a link with a device
   * @param deviceId Device ID
   * @param linkId Link ID
   * @returns Updated device
   */
  attachLinkToDevice: publicProcedure
    .input(
      z.object({
        deviceId: z.string(),
        linkId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const deviceExists = await ctx.db
        .select({ id: device.id })
        .from(device)
        .where(eq(device.id, input.deviceId))
        .limit(1);

      if (deviceExists.length === 0) {
        throw new Error("Device not found");
      }

      const linkExists = await ctx.db
        .select({ id: link.id })
        .from(link)
        .where(eq(link.id, input.linkId))
        .limit(1);

      if (linkExists.length === 0) {
        throw new Error("Link not found");
      }

      // Update the link to attach it to the device
      await ctx.db
        .update(link)
        .set({ deviceId: input.deviceId })
        .where(eq(link.id, input.linkId));

      // Return the updated device
      return ctx.db
        .select()
        .from(device)
        .where(eq(device.id, input.deviceId))
        .limit(1)
        .then((devices) => devices[0]);
    }),

  /**
   * Creates a single link
   * @param name Optional link name
   * @param config Optional config ID
   * @param device Device ID
   * @param price Price
   * @param marketplace Marketplace ID
   * @param url URL
   * @returns Created link
   */
  createLink: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        config: z.string().optional(),
        device: z.string(),
        price: z.number(),
        marketplace: z.string(),
        url: z.string(),
        sku: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const deviceData = await ctx.db
        .select({ name: device.name })
        .from(device)
        .where(eq(device.id, input.device))
        .limit(1);

      const result = await ctx.db
        .insert(link)
        .values({
          name: input.name || deviceData[0]?.name || "Название не указано",
          deviceId: input.device,
          configId: input.config || null,
          skuId: input.sku || null,
          price: input.price,
          url: input.url,
          marketplaceId: input.marketplace,
        })
        .returning();

      toast.success("Link created successfully");
      return result[0];
    }),

  /**
   * Creates multiple links at once
   * @param device Device ID
   * @param marketplace Marketplace ID
   * @param links Array of link data
   * @returns Result of the operation
   */
  createLinks: protectedProcedure
    .input(
      z.object({
        device: z.string(),
        marketplace: z.string(),
        links: z.array(
          z.object({
            name: z.string().optional(),
            config: z.string(),
            price: z.number(),
            url: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const linkData = input.links.map((linkItem) => ({
        name: linkItem?.name || "Название не указано",
        deviceId: input.device,
        configId: linkItem.config,
        price: linkItem.price,
        url: linkItem.url,
        marketplaceId: input.marketplace,
      }));

      return ctx.db.insert(link).values(linkData);
    }),

  /**
   * Gets all links for a specific device
   * @param id Device ID
   * @returns Links for the device with related data
   */
  getDeviceLinks: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db
        .select({
          id: link.id,
          name: link.name,
          url: link.url,
          price: link.price,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
          deviceId: link.deviceId,
          marketplaceId: link.marketplaceId,
          configId: link.configId,
          skuId: link.skuId,
          marketplace: {
            id: marketplace.id,
            name: marketplace.name,
            iconUrl: marketplace.iconUrl,
            baseUrl: marketplace.baseUrl,
            createdAt: marketplace.createdAt,
            updatedAt: marketplace.updatedAt,
          },
          config: {
            id: config.id,
            name: config.name,
            capacity: config.capacity,
            ram: config.ram,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
          },
          sku: {
            id: sku.id,
            marketId: sku.marketId,
            ram_gb: sku.ram_gb,
            storage_gb: sku.storage_gb,
            characteristicsId: sku.characteristicsId,
          },
        })
        .from(link)
        .leftJoin(marketplace, eq(link.marketplaceId, marketplace.id))
        .leftJoin(config, eq(link.configId, config.id))
        .leftJoin(sku, eq(link.skuId, sku.id))
        .where(eq(link.deviceId, input.id));
    }),

  /**
   * Deletes a link
   * @param id Link ID
   * @returns Deleted link
   */
  deleteLink: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .delete(link)
        .where(eq(link.id, input.id))
        .returning();

      toast.success("Link deleted successfully");
      return result[0];
    }),

  /**
   * Updates a link
   * @param id Link ID
   * @param configId Optional config ID
   * @param skuId Optional SKU ID
   * @param price Optional price
   * @param url Optional URL
   * @returns Updated link
   */
  updateLink: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        configId: z.string().nullable(),
        skuId: z.string().nullable(),
        price: z.number().optional(),
        url: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const updateData: {
        configId?: string | null;
        skuId?: string | null;
        price?: number;
        url?: string;
      } = {};

      if (input.configId !== undefined) {
        updateData.configId = input.configId;
      }
      if (input.skuId !== undefined) {
        updateData.skuId = input.skuId;
      }
      if (input.price !== undefined) {
        updateData.price = input.price;
      }
      if (input.url !== undefined) {
        updateData.url = input.url;
      }

      await ctx.db
        .update(link)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(link.id, input.id))
        .returning();

      // Get the updated link with related data
      const updatedLink = await ctx.db
        .select({
          id: link.id,
          name: link.name,
          url: link.url,
          price: link.price,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
          deviceId: link.deviceId,
          marketplaceId: link.marketplaceId,
          configId: link.configId,
          skuId: link.skuId,
          config: {
            id: config.id,
            name: config.name,
            capacity: config.capacity,
            ram: config.ram,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
          },
          sku: {
            id: sku.id,
            marketId: sku.marketId,
            ram_gb: sku.ram_gb,
            storage_gb: sku.storage_gb,
            characteristicsId: sku.characteristicsId,
          },
        })
        .from(link)
        .leftJoin(config, eq(link.configId, config.id))
        .leftJoin(sku, eq(link.skuId, sku.id))
        .where(eq(link.id, input.id))
        .limit(1);

      return updatedLink[0];
    }),

  /**
   * Resolves shortened URLs to their final destinations
   * @param url URL to unshorten
   * @returns Original URL, resolved URL, status code, and title
   */
  unshorten: publicProcedure
    .input(
      z.object({
        url: z
          .string()
          .url("Некорректный формат ссылки")
          .transform((url) => {
            try {
              // Ensure the URL has a protocol
              if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "https://" + url;
              }
              const parsedUrl = new URL(url);
              // If it's already a Yandex Market URL, return as is
              if (parsedUrl.hostname === "market.yandex.ru") {
                return url;
              }
              return url;
            } catch {
              throw new Error("Некорректный формат ссылки");
            }
          }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Check if it's a Yandex Market URL
        const url = new URL(input.url);
        if (url.hostname === "market.yandex.ru") {
          // For Yandex Market URLs, just get the title without checking redirects
          const result = await getRedirectLocation(input.url);
          return {
            originalUrl: input.url,
            resolvedUrl: input.url,
            statusCode: 200,
            title: result.title,
          };
        }

        // For other URLs, proceed with redirect checking
        const result = await getRedirectLocation(input.url);

        // If we got a redirect, try to get the title from the final location
        if (result.statusCode >= 300 && result.statusCode < 400) {
          try {
            const finalResult = await getRedirectLocation(result.location);
            return {
              originalUrl: input.url,
              resolvedUrl: result.location,
              statusCode: result.statusCode,
              title: finalResult.title,
            };
          } catch {
            // If we can't fetch the final URL, return just the redirect info
            return {
              originalUrl: input.url,
              resolvedUrl: result.location,
              statusCode: result.statusCode,
            };
          }
        }

        return {
          originalUrl: input.url,
          resolvedUrl: result.location,
          statusCode: result.statusCode,
          title: result.title,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось обработать ссылку",
        });
      }
    }),

  /**
   * Creates links and attaches them to a device
   * @param device Device ID
   * @param links Array of link IDs
   * @returns Updated device
   */
  createLinksAndAttachToDevice: protectedProcedure
    .input(
      z.object({
        device: z.string(),
        links: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const deviceExists = await ctx.db
        .select({ id: device.id })
        .from(device)
        .where(eq(device.id, input.device))
        .limit(1);

      if (deviceExists.length === 0) {
        throw new Error("Device not found");
      }

      const links = await ctx.db
        .select({ id: link.id })
        .from(link)
        .where(inArray(link.id, input.links));

      if (links.length === 0) {
        throw new Error("Links not found");
      }

      // Update all links to attach them to the device
      await ctx.db
        .update(link)
        .set({ deviceId: input.device })
        .where(inArray(link.id, input.links));

      // Return the updated device
      return ctx.db
        .select()
        .from(device)
        .where(eq(device.id, input.device))
        .limit(1)
        .then((devices) => devices[0]);
    }),

  /**
   * Creates a partner link for Yandex distribution
   * @param url Original URL
   * @param clid Client ID
   * @param vid Optional vendor ID
   * @param format Optional response format
   * @param erid Optional extra ID
   * @returns Partner link
   */
  createPartnerLink: publicProcedure
    .input(
      z.object({
        url: z
          .string()
          .url()
          .transform((val) => val.trim()),
        clid: z.number(),
        vid: z
          .string()
          .transform((val) => val.trim())
          .optional(),
        format: z.enum(["json", "xml"]).optional(),
        erid: z
          .string()
          .transform((val) => val.trim())
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      return yandexDistributionService.createPartnerLink(input);
    }),

  /**
   * Checks AliExpress commission rates using Admitad API
   * @param urls Array of AliExpress URLs to check
   * @returns Commission rates data
   */
  checkAliExpressCommission: publicProcedure
    .input(
      z.object({
        urls: z.array(z.string().url()).min(1).max(10), // Limit to 10 URLs per request
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Create Admitad client
        const client = createAdmitadClient();

        // Authenticate with AliExpress commission scope
        await client.authenticate(["aliexpress_commission"]);

        // Get commission rates
        const commissionData = await client.getAliExpressCommissionRates(
          input.urls
        );

        return {
          success: true,
          data: commissionData,
        };
      } catch (error) {
        console.error("AliExpress commission check error:", error);

        // Handle specific error cases
        if (error instanceof Error) {
          if (error.message.includes("Authentication failed")) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message:
                "Ошибка аутентификации с Admitad API. Проверьте настройки API ключей.",
            });
          }

          if (error.message.includes("Invalid URL")) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Некорректный формат ссылки AliExpress",
            });
          }
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось получить данные о комиссии AliExpress",
        });
      }
    }),
});
