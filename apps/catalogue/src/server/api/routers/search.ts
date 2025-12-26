import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/src/server/api/trpc";
import { and, eq, ne, gt, gte, lte, like, exists, desc, asc } from "drizzle-orm";
import { differenceInMonths } from "date-fns";
import {
  device,
  deviceCharacteristics,
  screen,
  camera,
  link,
  sku,
  marketplace,
  config,
  configToDevice,
  deviceToRating,
} from "@/src/server/db/schema";

type DeviceWithRelations = {
  id: string;
  brand: string;
  name: string;
  slug: string;
  releaseDate: Date | null;
  cpuManufacturer: string | null;
  screens: Array<{
    size_in: number | null;
    displayType: string | null;
    resolution: string | null;
    refreshRate: number | null;
  }>;
  device: {
    id: string;
    imageUrl: string | null;
    links: Array<{
      price: number;
      sku: {
        ram_gb: number;
        storage_gb: number;
      } | null;
    }>;
  };
  cameras: Array<{
    id: string;
    type: string | null;
    resolution_mp: number;
    aperture_fstop: string;
    characteristicsId: string;
    sensor: string | null;
    features: string | null;
  }>;
};

function calculateRelevanceScore(
  currentDevice: DeviceWithRelations,
  otherDevice: DeviceWithRelations
): number {
  let score = 0;

  // Brand similarity (same brand = higher score)
  if (currentDevice.brand === otherDevice.brand) {
    score += 0.2;
  }

  // Screen size similarity
  const currentScreen = currentDevice.screens[0];
  const otherScreen = otherDevice.screens[0];
  if (currentScreen?.size_in && otherScreen?.size_in) {
    const sizeDiff = Math.abs(currentScreen.size_in - otherScreen.size_in);
    score += Math.max(0, 0.3 * (1 - sizeDiff / 2)); // Up to 0.3 points for similar size
  }

  // Release date proximity
  if (currentDevice.releaseDate && otherDevice.releaseDate) {
    const monthsDiff = Math.abs(
      differenceInMonths(
        new Date(currentDevice.releaseDate),
        new Date(otherDevice.releaseDate)
      )
    );
    score += Math.max(0, 0.2 * (1 - monthsDiff / 12)); // Up to 0.2 points for release date proximity
  }

  // Processor similarity
  if (currentDevice.cpuManufacturer === otherDevice.cpuManufacturer) {
    score += 0.15;
  }

  // Camera similarity
  const currentMainCamera = currentDevice.cameras.find(
    (c) => c.type === "main"
  );
  const otherMainCamera = otherDevice.cameras.find((c) => c.type === "main");
  if (currentMainCamera && otherMainCamera) {
    const mpDiff = Math.abs(
      currentMainCamera.resolution_mp - otherMainCamera.resolution_mp
    );
    score += Math.max(0, 0.15 * (1 - mpDiff / 20)); // Up to 0.15 points for similar camera
  }

  return score;
}

export const searchRouter = createTRPCRouter({
  /**
   * Gets devices for dropdown selection
   * @param search Optional search string to filter devices
   * @param id Optional device ID to get a specific device
   * @returns Array of matching devices with basic info
   */
  getDevicesForSelect: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        id: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [];

      if (input.id) {
        conditions.push(eq(device.id, input.id));
      } else if (input.search) {
        conditions.push(like(device.name, `%${input.search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const devices = await ctx.db
        .select({
          id: device.id,
          name: device.name,
          imageUrl: device.imageUrl,
        })
        .from(device)
        .where(whereClause)
        .orderBy(asc(device.name))
        .limit(20);

      // Get configs for each device
      const devicesWithConfigs = await Promise.all(
        devices.map(async (dev) => {
          const configs = await ctx.db
            .select({
              id: config.id,
              name: config.name,
            })
            .from(config)
            .innerJoin(configToDevice, eq(configToDevice.A, config.id))
            .where(eq(configToDevice.B, dev.id));

          return {
            ...dev,
            configs,
          };
        })
      );

      return devicesWithConfigs;
    }),

  /**
   * Finds relevant devices similar to a given device
   * @param deviceId ID of the device to find similar devices for
   * @returns Array of relevant devices with similarity scores
   */
  getRelevantDevices: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Get the current device's characteristics
      const currentDeviceResult = await ctx.db
        .select({
          id: deviceCharacteristics.id,
          cpuManufacturer: deviceCharacteristics.cpuManufacturer,
          brand: deviceCharacteristics.brand,
          name: deviceCharacteristics.name,
          slug: deviceCharacteristics.slug,
          releaseDate: deviceCharacteristics.releaseDate,
          deviceId: deviceCharacteristics.deviceId,
          deviceValueRating: device.valueRating,
          deviceDescription: device.description,
          deviceImageUrl: device.imageUrl,
        })
        .from(deviceCharacteristics)
        .innerJoin(device, eq(deviceCharacteristics.deviceId, device.id))
        .where(eq(deviceCharacteristics.deviceId, input.deviceId))
        .limit(1);

      if (currentDeviceResult.length === 0) return [];

      const currentDevice = currentDeviceResult[0]!;

      // Get current device's screens
      const currentScreens = await ctx.db
        .select({
          size_in: screen.size_in,
          displayType: screen.displayType,
          resolution: screen.resolution,
          refreshRate: screen.refreshRate,
        })
        .from(screen)
        .where(
          and(
            eq(screen.characteristicsId, currentDevice.id),
            eq(screen.isMain, true)
          )
        );

      // Get current device's cameras
      const currentCameras = await ctx.db
        .select({
          id: camera.id,
          type: camera.type,
          resolution_mp: camera.resolution_mp,
          aperture_fstop: camera.aperture_fstop,
          characteristicsId: camera.characteristicsId,
          sensor: camera.sensor,
          features: camera.features,
        })
        .from(camera)
        .where(eq(camera.characteristicsId, currentDevice.id));

      // Get current device's links
      const currentLinks = await ctx.db
        .select({
          price: link.price,
          skuRamGb: sku.ram_gb,
          skuStorageGb: sku.storage_gb,
        })
        .from(link)
        .leftJoin(sku, eq(link.skuId, sku.id))
        .where(eq(link.deviceId, currentDevice.deviceId));

      // Get current device's configs
      const currentConfigs = await ctx.db
        .select({
          name: config.name,
          capacity: config.capacity,
        })
        .from(config)
        .innerJoin(configToDevice, eq(configToDevice.A, config.id))
        .where(eq(configToDevice.B, currentDevice.deviceId));

      // Build the current device object with all relations
      const currentDeviceWithRelations = {
        id: currentDevice.id,
        cpuManufacturer: currentDevice.cpuManufacturer,
        brand: currentDevice.brand,
        name: currentDevice.name,
        slug: currentDevice.slug,
        releaseDate: currentDevice.releaseDate,
        screens: currentScreens,
        cameras: currentCameras,
        device: {
          id: currentDevice.deviceId,
          valueRating: currentDevice.deviceValueRating,
          description: currentDevice.deviceDescription,
          imageUrl: currentDevice.deviceImageUrl,
          configs: currentConfigs,
          links: currentLinks.map((l) => ({
            price: l.price,
            sku: l.skuRamGb && l.skuStorageGb ? {
              ram_gb: l.skuRamGb,
              storage_gb: l.skuStorageGb,
            } : null,
          })),
        },
      };

      // Get all other devices that are in ratings and have prices
      const allDevicesQuery = await ctx.db
        .select({
          id: deviceCharacteristics.id,
          cpuManufacturer: deviceCharacteristics.cpuManufacturer,
          brand: deviceCharacteristics.brand,
          name: deviceCharacteristics.name,
          slug: deviceCharacteristics.slug,
          releaseDate: deviceCharacteristics.releaseDate,
          deviceId: deviceCharacteristics.deviceId,
          deviceValueRating: device.valueRating,
          deviceDescription: device.description,
          deviceImageUrl: device.imageUrl,
        })
        .from(deviceCharacteristics)
        .innerJoin(device, eq(deviceCharacteristics.deviceId, device.id))
        .where(
          and(
            ne(deviceCharacteristics.deviceId, input.deviceId),
            exists(
              ctx.db
                .select({ id: deviceToRating.A })
                .from(deviceToRating)
                .where(eq(deviceToRating.A, device.id))
            ),
            exists(
              ctx.db
                .select({ id: link.id })
                .from(link)
                .where(and(eq(link.deviceId, device.id), gt(link.price, 0)))
            )
          )
        )
        .limit(100);

      // Get related data for each device
      const allDevicesWithRelations = await Promise.all(
        allDevicesQuery.map(async (dev) => {
          // Get screens
          const screens = await ctx.db
            .select({
              size_in: screen.size_in,
              displayType: screen.displayType,
              resolution: screen.resolution,
              refreshRate: screen.refreshRate,
            })
            .from(screen)
            .where(
              and(
                eq(screen.characteristicsId, dev.id),
                eq(screen.isMain, true)
              )
            );

          // Get cameras
          const cameras = await ctx.db
            .select({
              id: camera.id,
              type: camera.type,
              resolution_mp: camera.resolution_mp,
              aperture_fstop: camera.aperture_fstop,
              characteristicsId: camera.characteristicsId,
              sensor: camera.sensor,
              features: camera.features,
            })
            .from(camera)
            .where(eq(camera.characteristicsId, dev.id));

          // Get links
          const links = await ctx.db
            .select({
              price: link.price,
              skuRamGb: sku.ram_gb,
              skuStorageGb: sku.storage_gb,
            })
            .from(link)
            .leftJoin(sku, eq(link.skuId, sku.id))
            .where(eq(link.deviceId, dev.deviceId));

          // Get configs
          const configs = await ctx.db
            .select({
              name: config.name,
              capacity: config.capacity,
            })
            .from(config)
            .innerJoin(configToDevice, eq(configToDevice.A, config.id))
            .where(eq(configToDevice.B, dev.deviceId));

          return {
            id: dev.id,
            cpuManufacturer: dev.cpuManufacturer,
            brand: dev.brand,
            name: dev.name,
            slug: dev.slug,
            releaseDate: dev.releaseDate,
            screens,
            cameras,
            device: {
              id: dev.deviceId,
              valueRating: dev.deviceValueRating,
              description: dev.deviceDescription,
              imageUrl: dev.deviceImageUrl,
              configs,
              links: links.map((l) => ({
                price: l.price,
                sku: l.skuRamGb && l.skuStorageGb ? {
                  ram_gb: l.skuRamGb,
                  storage_gb: l.skuStorageGb,
                } : null,
              })),
            },
          };
        })
      );

      // Calculate relevance scores
      const scoredDevices = allDevicesWithRelations
        .filter((device) => {
          // Double-check that the device has price links
          return device.device.links.some((link) => link.price > 0);
        })
        .map((device) => {
          const minPrice = Math.min(
            ...device.device.links.map((link) => link.price)
          );
          return {
            id: device.id,
            slug: device.slug,
            imageUrl: device.device.imageUrl,
            name: device.name,
            configs: device.device.configs,
            description: device.device.description,
            price: minPrice,
            relevanceScore: calculateRelevanceScore(currentDeviceWithRelations, device),
          };
        });

      // Sort by relevance score and return top 5
      return scoredDevices
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5);
    }),

  /**
   * Searches for devices to replace another device in a rating
   * @param query Search query
   * @param ratingId Rating ID
   * @param excludeDeviceId Device ID to exclude from results
   * @param priceRange Optional price range filter
   * @param sortBy Optional sort method
   * @returns Array of matching devices
   */
  searchDevicesForReplacement: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        ratingId: z.string(),
        excludeDeviceId: z.string(),
        priceRange: z
          .object({
            min: z.number().optional(),
            max: z.number().optional(),
          })
          .optional(),
        sortBy: z
          .enum(["recent", "name", "date", "price", "relevance"])
          .optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { query, excludeDeviceId, priceRange, sortBy } = input;

      const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const fullSearchQuery = query.toLowerCase().trim();

      // Build conditions array
      const conditions = [];

      // Search conditions
      if (searchTerms.length > 0) {
        // Each term must be present in the name
        const searchConditions = searchTerms.map((term) =>
          like(device.name, `%${term}%`)
        );
        conditions.push(and(...searchConditions));
      }

      // Exclude current device
      conditions.push(ne(device.id, excludeDeviceId));

      // Build price filter if provided
      if (priceRange) {
        const priceConditions = [];
        if (priceRange.min !== undefined) {
          priceConditions.push(gte(link.price, priceRange.min));
        }
        if (priceRange.max !== undefined) {
          priceConditions.push(lte(link.price, priceRange.max));
        }
        
        if (priceConditions.length > 0) {
          conditions.push(
            exists(
              ctx.db
                .select({ id: link.id })
                .from(link)
                .where(and(eq(link.deviceId, device.id), ...priceConditions))
            )
          );
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Build orderBy based on sortBy
      const orderByClause: Array<ReturnType<typeof desc | typeof asc>> = [];
      switch (sortBy) {
        case "recent":
          orderByClause.push(desc(device.createdAt));
          break;
        case "name":
          orderByClause.push(asc(device.name));
          break;
        case "date":
        case "price":
        case "relevance":
        default:
          break; // No specific order in query, will sort by relevance in post-processing
      }

      const devicesQuery = ctx.db
        .select({
          id: device.id,
          name: device.name,
          imageUrl: device.imageUrl,
          createdAt: device.createdAt,
        })
        .from(device)
        .where(whereClause)
        .limit(12);

      const devices = orderByClause.length > 0 
        ? await devicesQuery.orderBy(...orderByClause)
        : await devicesQuery;

      // Get links for each device
      const devicesWithLinks = await Promise.all(
        devices.map(async (dev) => {
          const links = await ctx.db
            .select({
              id: link.id,
              price: link.price,
              updatedAt: link.updatedAt,
              marketplaceId: link.marketplaceId,
              marketplaceName: marketplace.name,
            })
            .from(link)
            .leftJoin(marketplace, eq(link.marketplaceId, marketplace.id))
            .where(eq(link.deviceId, dev.id));

          return {
            ...dev,
            links: links.map((l) => ({
              id: l.id,
              price: l.price,
              updatedAt: l.updatedAt,
              marketplace: l.marketplaceId ? {
                id: l.marketplaceId,
                name: l.marketplaceName,
              } : null,
            })),
          };
        })
      );

      // Post-process sorting based on sortBy
      if (sortBy === "date") {
        devicesWithLinks.sort((a, b) => {
          const aDate = Math.max(
            ...a.links.map((link) => link.updatedAt ? new Date(link.updatedAt).getTime() : 0)
          );
          const bDate = Math.max(
            ...b.links.map((link) => link.updatedAt ? new Date(link.updatedAt).getTime() : 0)
          );
          return bDate - aDate;
        });
      } else if (sortBy === "price") {
        devicesWithLinks.sort((a, b) => {
          const aPrice = Math.min(
            ...a.links.map((link) => link.price || Infinity)
          );
          const bPrice = Math.min(
            ...b.links.map((link) => link.price || Infinity)
          );
          return aPrice - bPrice;
        });
      } else if (!sortBy || sortBy === "relevance") {
        devicesWithLinks.sort((a, b) => {
          const getRelevanceScore = (device: (typeof devicesWithLinks)[0]) => {
            const deviceName = (device.name || "").toLowerCase();
            let score = 0;

            // Exact full query match (highest priority)
            if (deviceName === fullSearchQuery) {
              score += 100;
            }
            // Starts with full query
            else if (deviceName.startsWith(fullSearchQuery)) {
              score += 80;
            }
            // Contains full query as a substring
            else if (deviceName.includes(fullSearchQuery)) {
              score += 60;
            }

            // Individual terms matching (lower priority)
            const matchedTerms = searchTerms.filter((term) => {
              // Word boundary check using regex
              const wordBoundaryRegex = new RegExp(`\\b${term}\\b`);
              return wordBoundaryRegex.test(deviceName);
            });

            // Add points based on how many terms matched with word boundaries
            score += (matchedTerms.length / searchTerms.length) * 40;

            // Bonus for sequential terms matching
            let sequentialMatches = 0;
            for (let i = 0; i < searchTerms.length - 1; i++) {
              const currentTerm = searchTerms[i];
              const nextTerm = searchTerms[i + 1];
              const pattern = new RegExp(`${currentTerm}\\s+${nextTerm}`);
              if (pattern.test(deviceName)) {
                sequentialMatches++;
              }
            }
            score += sequentialMatches * 20;

            return score;
          };

          return getRelevanceScore(b) - getRelevanceScore(a);
        });
      }

      return devicesWithLinks;
    }),
});
