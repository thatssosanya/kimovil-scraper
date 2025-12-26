import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/src/server/api/trpc";
import { revalidateDevicePage } from "@/src/utils/revalidate";
import { TRPCError } from "@trpc/server";
import { PUBLISH_STATUS } from "@/src/constants/publishStatus";

import {
  eq,
  and,
  or,
  like,
  inArray,
  desc,
  asc,
  isNotNull,
  sql,
  lt,
  gt,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  device,
  deviceCharacteristics,
  link,
  sku,
  configToDevice,
  ratingPosition,
  prosCons,
  benchmark,
  camera,
  screen,
  deviceToRating,
} from "@/src/server/db/schema";
import { normalizeDeviceName } from "@/src/server/services/device-data/normalize";
// Timestamp transformations are now handled by custom Drizzle datetime type

// Helper for handling numeric fields that might come as strings
const numericField = (opts?: {
  min?: number;
  max?: number;
  required?: boolean;
}) => {
  const base = z
    .union([z.number(), z.string()])
    .transform((val) =>
      typeof val === "string"
        ? parseFloat(val) || (opts?.required ? 0 : null)
        : val
    );

  const withRange =
    opts?.min !== undefined || opts?.max !== undefined
      ? base.pipe(
          z
            .number()
            .min(opts.min ?? -Infinity)
            .max(opts.max ?? Infinity)
        )
      : base.pipe(z.number());

  return opts?.required ? withRange : withRange.nullable().optional();
};

type RelatedDataChanges<T> = {
  toCreate: T[];
  toUpdate: T[];
  toDeleteIds: string[];
};

function getRelatedDataChanges<T extends { id: string }>(
  newData: T[] | undefined,
  existingData: T[]
): RelatedDataChanges<Omit<T, "id"> & { id?: string }> {
  if (!newData) {
    return { toCreate: [], toUpdate: [], toDeleteIds: [] };
  }

  const inputMap = new Map(
    newData.filter((item) => item.id).map((item) => [item.id, item])
  );
  const existingMap = new Map(existingData.map((item) => [item.id, item]));

  return {
    toCreate: newData
      .filter((item) => !item.id || !existingMap.has(item.id))
      .map(({ id, ...rest }) => rest),
    toUpdate: newData.filter(
      (item) => item.id && inputMap.has(item.id) && existingMap.has(item.id)
    ),
    toDeleteIds: existingData
      .filter((item) => !inputMap.has(item.id))
      .map((item) => item.id),
  };
}

const OUTDATED_PRICE_THRESHOLD_DAYS = 15;

function buildDeviceFilterConditions({
  search,
  filters,
  deviceType,
}: {
  search?: string | null;
  filters?: string[];
  deviceType?: string | undefined;
}): SQL[] {
  const conditions: SQL[] = [];
  const trimmedSearch = search?.trim();

  if (trimmedSearch) {
    const searchCondition = or(
      like(device.name, `%${trimmedSearch}%`),
      like(device.type, `%${trimmedSearch}%`)
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (deviceType && deviceType.trim().length > 0) {
    conditions.push(eq(device.type, deviceType));
  }

  if (!filters?.length) {
    return conditions;
  }

  const uniqueFilters = Array.from(new Set(filters));

  for (const filter of uniqueFilters) {
    switch (filter) {
      case "hasProfile":
        conditions.push(
          sql`exists (
            select 1
            from "DeviceCharacteristics" dc
            where dc."deviceId" = ${device.id}
          )`
        );
        break;
      case "noProfile":
        conditions.push(
          sql`not exists (
            select 1
            from "DeviceCharacteristics" dc
            where dc."deviceId" = ${device.id}
          )`
        );
        break;
      case "inRatings":
        conditions.push(
          sql`exists (
            select 1
            from "_DeviceToRating" dtr
            where dtr."A" = ${device.id}
          )`
        );
        break;
      case "noRatings":
        conditions.push(
          sql`not exists (
            select 1
            from "_DeviceToRating" dtr
            where dtr."A" = ${device.id}
          )`
        );
        break;
      case "hasOutdatedPrices":
        conditions.push(
          sql`exists (
            select 1
            from "Link" l
            where l."deviceId" = ${device.id}
              and julianday('now') - julianday(l."updatedAt") > ${OUTDATED_PRICE_THRESHOLD_DAYS}
          )`
        );
        break;
      case "isSmartphone":
        conditions.push(eq(device.type, "Смартфон"));
        break;
      case "duplicatesPotential":
        conditions.push(eq(device.duplicateStatus, "potential"));
        break;
      case "duplicatesConfirmed":
        conditions.push(eq(device.duplicateStatus, "duplicate"));
        break;
      default:
        break;
    }
  }

  return conditions;
}

function resolveOrderBy(
  sortBy?: string,
  sortOrder?: "asc" | "desc"
) {
  const direction = sortOrder ?? "desc";

  switch (sortBy) {
    case "name":
      return [
        direction === "asc" ? asc(device.name) : desc(device.name),
        direction === "asc" ? asc(device.createdAt) : desc(device.createdAt),
        direction === "asc" ? asc(device.id) : desc(device.id),
      ];
    case "type":
      return [
        direction === "asc" ? asc(device.type) : desc(device.type),
        direction === "asc" ? asc(device.createdAt) : desc(device.createdAt),
        direction === "asc" ? asc(device.id) : desc(device.id),
      ];
    case "valueRating":
      return [
        direction === "asc" ? asc(device.valueRating) : desc(device.valueRating),
        direction === "asc" ? asc(device.createdAt) : desc(device.createdAt),
        direction === "asc" ? asc(device.id) : desc(device.id),
      ];
    case "createdAt":
      return [
        direction === "asc" ? asc(device.createdAt) : desc(device.createdAt),
        direction === "asc" ? asc(device.id) : desc(device.id),
      ];
    case "prosConsCount":
      return [
        direction === "asc" ? asc(device.createdAt) : desc(device.createdAt),
        direction === "asc" ? asc(device.id) : desc(device.id),
      ];
    default:
      return [
        direction === "asc" ? asc(device.createdAt) : desc(device.createdAt),
        direction === "asc" ? asc(device.id) : desc(device.id),
      ];
  }
}

function buildCursorFilter(
  cursorItem: {
    name: string | null;
    type: string | null;
    valueRating: number | null;
    createdAt: Date;
  },
  cursorId: string,
  sortBy?: string,
  sortOrder?: "asc" | "desc"
): SQL | undefined {
  const direction = sortOrder ?? "desc";
  const createdAtStep =
    direction === "asc"
      ? gt(device.createdAt, cursorItem.createdAt)
      : lt(device.createdAt, cursorItem.createdAt);

  const createdAtTie = and(
    eq(device.createdAt, cursorItem.createdAt),
    direction === "asc" ? gt(device.id, cursorId) : lt(device.id, cursorId)
  );

  const fallbackCreatedAt = or(createdAtStep, createdAtTie);

  switch (sortBy) {
    case "name": {
      const cursorName = cursorItem.name;
      if (!cursorName) {
        return fallbackCreatedAt;
      }

      const primary =
        direction === "asc"
          ? gt(device.name, cursorName)
          : lt(device.name, cursorName);
      const tie = and(eq(device.name, cursorName), fallbackCreatedAt);

      return or(primary, tie);
    }
    case "type": {
      const cursorType = cursorItem.type;
      if (!cursorType) {
        return fallbackCreatedAt;
      }

      const primary =
        direction === "asc"
          ? gt(device.type, cursorType)
          : lt(device.type, cursorType);
      const tie = and(eq(device.type, cursorType), fallbackCreatedAt);

      return or(primary, tie);
    }
    case "valueRating": {
      const cursorRating = cursorItem.valueRating;
      if (cursorRating == null) {
        return fallbackCreatedAt;
      }

      const primary =
        direction === "asc"
          ? gt(device.valueRating, cursorRating)
          : lt(device.valueRating, cursorRating);
      const tie = and(eq(device.valueRating, cursorRating), fallbackCreatedAt);

      return or(primary, tie);
    }
    case "createdAt":
      return fallbackCreatedAt;
    case "prosConsCount":
      return fallbackCreatedAt;
    default:
      return fallbackCreatedAt;
  }
}

export const deviceRouter = createTRPCRouter({
  /**
   * Gets all devices with pagination and search functionality
   * @param limit Maximum number of items to return (default: 40)
   * @param cursor Pagination cursor
   * @param search Optional search string to filter devices
   * @returns Paginated list of devices with nextCursor
   */
  getAllDevices: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(40),
        cursor: z.string().nullish(),
        search: z.string().nullish(),
        filters: z.array(z.string()).optional(),
        deviceType: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, search, filters, deviceType, sortBy, sortOrder } =
        input;

      const filterConditions = buildDeviceFilterConditions({
        search,
        filters,
        deviceType,
      });

      let whereClause =
        filterConditions.length > 0 ? and(...filterConditions) : undefined;

      if (cursor) {
        const cursorItem = await ctx.db.query.device.findFirst({
          where: eq(device.id, cursor),
          columns: {
            createdAt: true,
            name: true,
            type: true,
            valueRating: true,
          },
        });

        if (cursorItem) {
          const cursorFilter = buildCursorFilter(
            cursorItem,
            cursor,
            sortBy,
            sortOrder
          );

          if (cursorFilter) {
            whereClause = whereClause
              ? and(whereClause, cursorFilter)
              : cursorFilter;
          }
        }
      }

      const orderByClause = resolveOrderBy(sortBy, sortOrder);
      const fetchLimit = limit + 1;

      const items = await ctx.db.query.device.findMany({
        where: whereClause,
        limit: fetchLimit,
        orderBy: orderByClause,
        with: {
          links: {
            with: {
              sku: true,
            },
          },
          configs: {
            with: {
              config: true,
            },
          },
          characteristics: {
            columns: { id: true },
            with: {
              skus: {
                columns: {
                  id: true,
                  ram_gb: true,
                  storage_gb: true,
                },
              },
            },
          },
          ratings: {
            with: {
              rating: {
                columns: { id: true },
              },
            },
          },
          prosCons: true,
        },
      });

      let nextCursor: string | undefined;
      let paginatedItems = items;

      if (items.length > limit) {
        const nextItem = items[limit];
        paginatedItems = items.slice(0, limit);
        nextCursor = nextItem?.id;
      }

      return {
        items: paginatedItems,
        nextCursor,
      };
    }),

  /**
   * Gets the total count of devices
   * @returns Total count of all devices
   */
  getDeviceCount: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(device);
    
    return result[0]?.count ?? 0;
  }),

  /**
   * Gets the count of devices with filters applied
   * @param search Optional search string
   * @param filters Optional filters array
   * @returns Count of filtered devices
   */
  getFilteredDeviceCount: publicProcedure
    .input(
      z.object({
        search: z.string().nullish(),
        filters: z.array(z.string()).optional(),
        deviceType: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { search, filters, deviceType } = input;

      const filterConditions = buildDeviceFilterConditions({
        search,
        filters,
        deviceType,
      });

      const whereClause =
        filterConditions.length > 0 ? and(...filterConditions) : undefined;

      const result = await ctx.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(device)
        .where(whereClause);

      return result[0]?.count ?? 0;
    }),

  /**
   * Creates a new device
   * @param name Device name
   * @param type Device type
   * @param description Device description
   * @param yandexId Yandex ID for the device
   * @param configs Array of configuration IDs
   * @param imageUrl URL to the device image
   * @returns The created device
   */
  createDevice: protectedProcedure
    .input(
      z.object({
        name: z.string().transform((val) => val.trim()),
        type: z.string().transform((val) => val.trim()),
        description: z.string().transform((val) => val.trim()),
        yandexId: z.string().transform((val) => val.trim()),
        configs: z.array(z.string()),
        imageUrl: z.string().transform((val) => val.trim()),
        skipDuplicateCheck: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const normalizedName = normalizeDeviceName(input.name);

      if (!input.skipDuplicateCheck) {
        const existingDevices = await ctx.db
          .select({
            id: device.id,
            name: device.name,
            type: device.type,
          })
          .from(device)
          .where(
            and(
              eq(device.normalizedName, normalizedName),
              eq(device.type, input.type)
            )
          )
          .limit(5);

        if (existingDevices.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Similar device already exists",
            cause: {
              code: "DEVICE_DUPLICATE",
              candidates: existingDevices,
            },
          });
        }
      }

      const result = await ctx.db.transaction(async (tx) => {
        const [newDevice] = await tx
          .insert(device)
          .values({
            name: input.name,
            type: input.type,
            description: input.description,
            yandexId: input.yandexId,
            imageUrl: input.imageUrl,
            normalizedName,
            duplicateStatus: "unique",
          })
          .returning();

        if (!newDevice) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create device",
          });
        }

        if (input.configs.length > 0) {
          await tx.insert(configToDevice).values(
            input.configs.map((configId) => ({
              A: configId,
              B: newDevice.id,
            }))
          );
        }

        return newDevice;
      });

      return result;
    }),

  /**
   * Find similar devices by name for duplicate detection
   */
  findSimilarByName: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        type: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const normalizedName = normalizeDeviceName(input.name);
      
      if (!normalizedName) {
        return { matches: [] };
      }

      const exactMatches = await ctx.db
        .select({
          id: device.id,
          name: device.name,
          type: device.type,
          imageUrl: device.imageUrl,
        })
        .from(device)
        .where(
          and(
            eq(device.normalizedName, normalizedName),
            input.type ? eq(device.type, input.type) : undefined
          )
        )
        .limit(5);

      if (exactMatches.length > 0) {
        return { matches: exactMatches, matchType: "exact" as const };
      }

      const trimmedName = input.name.trim();
      const fuzzyMatches = await ctx.db
        .select({
          id: device.id,
          name: device.name,
          type: device.type,
          imageUrl: device.imageUrl,
        })
        .from(device)
        .where(
          or(
            like(device.name, `%${trimmedName}%`),
            like(device.name, `%${trimmedName.split(" ").slice(0, 2).join(" ")}%`)
          )
        )
        .limit(5);

      return { matches: fuzzyMatches, matchType: "fuzzy" as const };
    }),

  /**
   * Get duplicate candidates for a device
   */
  getDuplicateCandidates: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Fetch current device basic info
      const currentDevice = await ctx.db.query.device.findFirst({
        where: eq(device.id, input.deviceId),
        columns: {
          id: true,
          name: true,
          type: true,
          normalizedName: true,
          imageUrl: true,
          createdAt: true,
        },
        with: {
          links: {
            columns: { id: true, price: true, updatedAt: true },
            orderBy: (links, { desc }) => [desc(links.updatedAt)],
            limit: 1,
          },
        },
      });

      if (!currentDevice?.normalizedName) {
        return { current: null, candidates: [] };
      }

      // Fetch candidates with same basic info
      const candidateDevices = await ctx.db.query.device.findMany({
        where: and(
          eq(device.normalizedName, currentDevice.normalizedName),
          eq(device.type, currentDevice.type ?? ""),
          sql`${device.id} != ${input.deviceId}`
        ),
        columns: {
          id: true,
          name: true,
          type: true,
          imageUrl: true,
          createdAt: true,
        },
        with: {
          links: {
            columns: { id: true, price: true, updatedAt: true },
            orderBy: (links, { desc }) => [desc(links.updatedAt)],
            limit: 1,
          },
        },
        limit: 20,
      });

      // Get device IDs that have characteristics (proper check via join)
      const allDeviceIds = [currentDevice.id, ...candidateDevices.map(c => c.id)];
      const devicesWithCharacteristics = await ctx.db
        .select({ deviceId: deviceCharacteristics.deviceId })
        .from(deviceCharacteristics)
        .where(inArray(deviceCharacteristics.deviceId, allDeviceIds));
      
      const hasProfileSet = new Set(devicesWithCharacteristics.map(d => d.deviceId));

      const formatDevice = (d: typeof currentDevice | typeof candidateDevices[number]) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        imageUrl: d.imageUrl,
        createdAt: d.createdAt,
        hasProfile: hasProfileSet.has(d.id),
        latestPrice: d.links?.[0]?.price ?? null,
        priceUpdatedAt: d.links?.[0]?.updatedAt ?? null,
        linksCount: d.links?.length ?? 0,
      });

      return {
        current: formatDevice(currentDevice),
        candidates: candidateDevices.map(formatDevice),
      };
    }),

  /**
   * Mark a device as duplicate of another
   */
  markAsDuplicate: protectedProcedure
    .input(
      z.object({
        canonicalId: z.string(),
        duplicateId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.canonicalId === input.duplicateId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot mark device as duplicate of itself",
        });
      }

      await ctx.db
        .update(device)
        .set({
          duplicateStatus: "duplicate",
          duplicateOfId: input.canonicalId,
        })
        .where(eq(device.id, input.duplicateId));

      return { success: true };
    }),

  /**
   * Resolve a device as not a duplicate
   */
  resolveAsUnique: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(device)
        .set({
          duplicateStatus: "unique",
          duplicateOfId: null,
        })
        .where(eq(device.id, input.deviceId));

      return { success: true };
    }),

  /**
   * Get merge preview - shows what will be transferred when merging duplicate into canonical
   */
  getMergePreview: protectedProcedure
    .input(
      z.object({
        canonicalId: z.string(),
        duplicateId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (input.canonicalId === input.duplicateId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot merge device with itself",
        });
      }

      const [canonicalDevice, duplicateDevice] = await Promise.all([
        ctx.db.query.device.findFirst({
          where: eq(device.id, input.canonicalId),
          columns: { id: true, name: true, duplicateStatus: true },
        }),
        ctx.db.query.device.findFirst({
          where: eq(device.id, input.duplicateId),
          columns: { id: true, name: true, duplicateStatus: true },
        }),
      ]);

      if (!canonicalDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canonical device not found",
        });
      }

      if (!duplicateDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Duplicate device not found",
        });
      }

      if (canonicalDevice.duplicateStatus === "duplicate") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot merge into a device that is itself a duplicate",
        });
      }

      // Count relations on duplicate device
      const [
        linksCount,
        prosConsCount,
        configsCount,
        ratingsCount,
        ratingPositionsOnDuplicate,
        ratingPositionsOnCanonical,
        duplicateCharacteristics,
        canonicalCharacteristics,
      ] = await Promise.all([
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(link)
          .where(eq(link.deviceId, input.duplicateId)),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(prosCons)
          .where(eq(prosCons.deviceId, input.duplicateId)),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(configToDevice)
          .where(eq(configToDevice.B, input.duplicateId)),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(deviceToRating)
          .where(eq(deviceToRating.A, input.duplicateId)),
        ctx.db
          .select({
            ratingId: ratingPosition.ratingId,
            position: ratingPosition.position,
          })
          .from(ratingPosition)
          .where(eq(ratingPosition.deviceId, input.duplicateId)),
        ctx.db
          .select({
            ratingId: ratingPosition.ratingId,
            position: ratingPosition.position,
          })
          .from(ratingPosition)
          .where(eq(ratingPosition.deviceId, input.canonicalId)),
        ctx.db.query.deviceCharacteristics.findFirst({
          where: eq(deviceCharacteristics.deviceId, input.duplicateId),
          columns: { id: true, slug: true, name: true },
        }),
        ctx.db.query.deviceCharacteristics.findFirst({
          where: eq(deviceCharacteristics.deviceId, input.canonicalId),
          columns: { id: true, slug: true, name: true },
        }),
      ]);

      // Find rating conflicts (both devices in same rating)
      const canonicalRatingIds = new Set(
        ratingPositionsOnCanonical.map((r) => r.ratingId)
      );
      const ratingConflicts = ratingPositionsOnDuplicate.filter((r) =>
        canonicalRatingIds.has(r.ratingId)
      );

      const hasCharacteristicsConflict =
        !!duplicateCharacteristics && !!canonicalCharacteristics;

      return {
        canonical: canonicalDevice,
        duplicate: duplicateDevice,
        toTransfer: {
          links: linksCount[0]?.count ?? 0,
          prosCons: prosConsCount[0]?.count ?? 0,
          configs: configsCount[0]?.count ?? 0,
          ratings: ratingsCount[0]?.count ?? 0,
          ratingPositions: ratingPositionsOnDuplicate.length,
        },
        conflicts: {
          ratingConflicts: ratingConflicts.length,
          hasCharacteristicsConflict,
          duplicateCharacteristics: duplicateCharacteristics ?? null,
          canonicalCharacteristics: canonicalCharacteristics ?? null,
        },
      };
    }),

  /**
   * Merge a duplicate device into its canonical version
   * Transfers all relations and marks the duplicate
   */
  mergeDuplicate: protectedProcedure
    .input(
      z.object({
        canonicalId: z.string(),
        duplicateId: z.string(),
        characteristicsAction: z
          .enum(["keep_canonical", "use_duplicate", "keep_both"])
          .optional()
          .default("keep_canonical"),
        deleteAfterMerge: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.canonicalId === input.duplicateId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot merge device with itself",
        });
      }

      // Validate both devices exist and canonical is not itself a duplicate
      const [canonicalDevice, duplicateDevice] = await Promise.all([
        ctx.db.query.device.findFirst({
          where: eq(device.id, input.canonicalId),
          columns: { id: true, name: true, duplicateStatus: true, duplicateOfId: true },
        }),
        ctx.db.query.device.findFirst({
          where: eq(device.id, input.duplicateId),
          columns: { id: true, name: true, duplicateStatus: true },
        }),
      ]);

      if (!canonicalDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Canonical device not found",
        });
      }

      if (!duplicateDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Duplicate device not found",
        });
      }

      // Prevent cycles: follow chain to ensure canonical is truly canonical
      if (canonicalDevice.duplicateStatus === "duplicate") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot merge into a device that is itself a duplicate. Resolve the chain first.",
        });
      }

      const result = await ctx.db.transaction(async (tx) => {
        const transferred = {
          links: 0,
          prosCons: 0,
          configs: 0,
          deviceToRatings: 0,
          ratingPositions: 0,
          characteristics: 0,
        };

        // 1. Move Links
        const linksResult = await tx
          .update(link)
          .set({ deviceId: input.canonicalId })
          .where(eq(link.deviceId, input.duplicateId));
        transferred.links = linksResult.rowsAffected;

        // 2. Move ProsCons
        const prosConsResult = await tx
          .update(prosCons)
          .set({ deviceId: input.canonicalId })
          .where(eq(prosCons.deviceId, input.duplicateId));
        transferred.prosCons = prosConsResult.rowsAffected;

        // 3. Move ConfigToDevice (M2M) - skip if canonical already has that config
        const duplicateConfigs = await tx
          .select({ configId: configToDevice.A })
          .from(configToDevice)
          .where(eq(configToDevice.B, input.duplicateId));

        const canonicalConfigs = await tx
          .select({ configId: configToDevice.A })
          .from(configToDevice)
          .where(eq(configToDevice.B, input.canonicalId));

        const canonicalConfigIds = new Set(canonicalConfigs.map((c) => c.configId));
        const configsToMove = duplicateConfigs.filter(
          (c) => !canonicalConfigIds.has(c.configId)
        );

        if (configsToMove.length > 0) {
          await tx.insert(configToDevice).values(
            configsToMove.map((c) => ({
              A: c.configId,
              B: input.canonicalId,
            }))
          );
          transferred.configs = configsToMove.length;
        }

        // Delete old M2M entries for duplicate
        await tx
          .delete(configToDevice)
          .where(eq(configToDevice.B, input.duplicateId));

        // 4. Move DeviceToRating (M2M) - skip if canonical already in that rating
        const duplicateRatings = await tx
          .select({ ratingId: deviceToRating.B })
          .from(deviceToRating)
          .where(eq(deviceToRating.A, input.duplicateId));

        const canonicalRatings = await tx
          .select({ ratingId: deviceToRating.B })
          .from(deviceToRating)
          .where(eq(deviceToRating.A, input.canonicalId));

        const canonicalRatingIds = new Set(canonicalRatings.map((r) => r.ratingId));
        const ratingsToMove = duplicateRatings.filter(
          (r) => !canonicalRatingIds.has(r.ratingId)
        );

        if (ratingsToMove.length > 0) {
          await tx.insert(deviceToRating).values(
            ratingsToMove.map((r) => ({
              A: input.canonicalId,
              B: r.ratingId,
            }))
          );
          transferred.deviceToRatings = ratingsToMove.length;
        }

        await tx
          .delete(deviceToRating)
          .where(eq(deviceToRating.A, input.duplicateId));

        // 5. Handle RatingPosition - more complex due to position conflicts
        const duplicatePositions = await tx
          .select()
          .from(ratingPosition)
          .where(eq(ratingPosition.deviceId, input.duplicateId));

        const canonicalPositions = await tx
          .select()
          .from(ratingPosition)
          .where(eq(ratingPosition.deviceId, input.canonicalId));

        const canonicalPositionsByRating = new Map(
          canonicalPositions.map((p) => [p.ratingId, p])
        );

        for (const dupPos of duplicatePositions) {
          const existingCanonicalPos = canonicalPositionsByRating.get(dupPos.ratingId);

          if (!existingCanonicalPos) {
            // No conflict: move the position to canonical
            await tx
              .update(ratingPosition)
              .set({ deviceId: input.canonicalId })
              .where(eq(ratingPosition.id, dupPos.id));
            transferred.ratingPositions++;
          } else {
            // Conflict: keep the better (lower) position on canonical, delete duplicate's
            const bestPosition = Math.min(existingCanonicalPos.position, dupPos.position);
            if (bestPosition !== existingCanonicalPos.position) {
              await tx
                .update(ratingPosition)
                .set({ position: bestPosition })
                .where(eq(ratingPosition.id, existingCanonicalPos.id));
            }
            await tx
              .delete(ratingPosition)
              .where(eq(ratingPosition.id, dupPos.id));
          }
        }

        // 6. Handle DeviceCharacteristics
        const [dupChars, canChars] = await Promise.all([
          tx.query.deviceCharacteristics.findFirst({
            where: eq(deviceCharacteristics.deviceId, input.duplicateId),
            columns: { id: true, slug: true },
          }),
          tx.query.deviceCharacteristics.findFirst({
            where: eq(deviceCharacteristics.deviceId, input.canonicalId),
            columns: { id: true, slug: true },
          }),
        ]);

        if (dupChars && !canChars) {
          // Only duplicate has characteristics: move to canonical
          await tx
            .update(deviceCharacteristics)
            .set({ deviceId: input.canonicalId })
            .where(eq(deviceCharacteristics.id, dupChars.id));
          transferred.characteristics = 1;
        } else if (dupChars && canChars) {
          // Both have characteristics: handle based on action
          if (input.characteristicsAction === "use_duplicate") {
            // Delete canonical's characteristics and related data
            await tx.delete(benchmark).where(eq(benchmark.characteristicsId, canChars.id));
            await tx.delete(camera).where(eq(camera.characteristicsId, canChars.id));
            await tx.delete(sku).where(eq(sku.characteristicsId, canChars.id));
            await tx.delete(screen).where(eq(screen.characteristicsId, canChars.id));
            await tx.delete(deviceCharacteristics).where(eq(deviceCharacteristics.id, canChars.id));
            
            // Move duplicate's to canonical
            await tx
              .update(deviceCharacteristics)
              .set({ deviceId: input.canonicalId })
              .where(eq(deviceCharacteristics.id, dupChars.id));
            transferred.characteristics = 1;
          } else if (input.characteristicsAction === "keep_canonical") {
            // Delete duplicate's characteristics and related data
            await tx.delete(benchmark).where(eq(benchmark.characteristicsId, dupChars.id));
            await tx.delete(camera).where(eq(camera.characteristicsId, dupChars.id));
            await tx.delete(sku).where(eq(sku.characteristicsId, dupChars.id));
            await tx.delete(screen).where(eq(screen.characteristicsId, dupChars.id));
            await tx.delete(deviceCharacteristics).where(eq(deviceCharacteristics.id, dupChars.id));
          }
          // "keep_both" - leave duplicate's characteristics orphaned (will be cleaned up or kept for redirect)
        }

        // 7. Update duplicate device status
        await tx
          .update(device)
          .set({
            duplicateStatus: "duplicate",
            duplicateOfId: input.canonicalId,
          })
          .where(eq(device.id, input.duplicateId));

        // 8. Update canonical device to "unique" (it's no longer a potential duplicate)
        await tx
          .update(device)
          .set({
            duplicateStatus: "unique",
            duplicateOfId: null,
          })
          .where(eq(device.id, input.canonicalId));

        // 9. Optionally delete the duplicate device
        if (input.deleteAfterMerge) {
          await tx.delete(device).where(eq(device.id, input.duplicateId));
        }

        return transferred;
      });

      return {
        success: true,
        transferred: result,
        duplicateDeleted: input.deleteAfterMerge,
      };
    }),

  /**
   * Scan all devices for potential duplicates
   * Groups by (normalizedName, type) and marks groups with 2+ devices as "potential"
   */
  scanForDuplicates: protectedProcedure.mutation(async ({ ctx }) => {
    // Step 1: Backfill normalizedName for devices that don't have it
    const devicesWithoutNormalized = await ctx.db
      .select({ id: device.id, name: device.name })
      .from(device)
      .where(
        or(
          sql`${device.normalizedName} IS NULL`,
          sql`${device.normalizedName} = ''`
        )
      );

    let backfilledCount = 0;
    for (const d of devicesWithoutNormalized) {
      if (d.name) {
        const normalized = normalizeDeviceName(d.name);
        await ctx.db
          .update(device)
          .set({ normalizedName: normalized })
          .where(eq(device.id, d.id));
        backfilledCount++;
      }
    }

    // Step 2: Find all (normalizedName, type) groups with 2+ devices
    const duplicateGroups = await ctx.db
      .select({
        normalizedName: device.normalizedName,
        type: device.type,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(device)
      .where(
        and(
          isNotNull(device.normalizedName),
          sql`${device.normalizedName} != ''`
        )
      )
      .groupBy(device.normalizedName, device.type)
      .having(sql`count(*) >= 2`);

    let markedCount = 0;

    for (const group of duplicateGroups) {
      // Mark all devices in this group as "potential" unless already "duplicate"
      const result = await ctx.db
        .update(device)
        .set({ duplicateStatus: "potential" })
        .where(
          and(
            eq(device.normalizedName, group.normalizedName ?? ""),
            eq(device.type, group.type ?? ""),
            sql`${device.duplicateStatus} != 'duplicate'`
          )
        );
      markedCount += result.rowsAffected;
    }

    return {
      success: true,
      backfilledCount,
      groupsFound: duplicateGroups.length,
      devicesMarked: markedCount,
    };
  }),

  /**
   * Get devices filtered by duplicate status
   */
  getDevicesByDuplicateStatus: protectedProcedure
    .input(
      z.object({
        status: z.enum(["potential", "duplicate", "all_non_unique"]),
        limit: z.number().min(1).max(100).optional().default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const statusFilter =
        input.status === "all_non_unique"
          ? or(
              eq(device.duplicateStatus, "potential"),
              eq(device.duplicateStatus, "duplicate")
            )
          : eq(device.duplicateStatus, input.status);

      const devices = await ctx.db.query.device.findMany({
        where: and(
          statusFilter,
          input.cursor ? lt(device.createdAt, new Date(input.cursor)) : undefined
        ),
        orderBy: [desc(device.createdAt)],
        limit: input.limit + 1,
        columns: {
          id: true,
          name: true,
          type: true,
          imageUrl: true,
          normalizedName: true,
          duplicateStatus: true,
          duplicateOfId: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (devices.length > input.limit) {
        const nextItem = devices.pop();
        nextCursor = nextItem?.createdAt.toISOString();
      }

      // For duplicates, fetch the canonical device info
      const duplicateOfIds = devices
        .filter((d) => d.duplicateOfId)
        .map((d) => d.duplicateOfId as string);

      const canonicalDevices =
        duplicateOfIds.length > 0
          ? await ctx.db.query.device.findMany({
              where: inArray(device.id, duplicateOfIds),
              columns: { id: true, name: true },
            })
          : [];

      const canonicalMap = new Map(canonicalDevices.map((d) => [d.id, d.name]));

      const devicesWithCanonical = devices.map((d) => ({
        ...d,
        canonicalDeviceName: d.duplicateOfId
          ? canonicalMap.get(d.duplicateOfId) ?? null
          : null,
      }));

      return {
        devices: devicesWithCanonical,
        nextCursor,
      };
    }),

  /**
   * Get duplicate statistics
   */
  getDuplicateStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await ctx.db
      .select({
        status: device.duplicateStatus,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(device)
      .groupBy(device.duplicateStatus);

    const result = {
      unique: 0,
      potential: 0,
      duplicate: 0,
    };

    for (const stat of stats) {
      if (stat.status === "unique") result.unique = stat.count;
      if (stat.status === "potential") result.potential = stat.count;
      if (stat.status === "duplicate") result.duplicate = stat.count;
    }

    return result;
  }),

  /**
   * Updates an existing device
   * @param id Device ID
   * @param name Updated device name
   * @param type Updated device type
   * @param description Updated device description
   * @param yandexId Updated Yandex ID
   * @param configs Updated array of configuration IDs
   * @param imageUrl Updated device image URL
   * @returns The updated device
   */
  updateDevice: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().transform((val) => val.trim()),
        type: z.string().transform((val) => val.trim()),
        description: z.string().transform((val) => val.trim()),
        yandexId: z.string().transform((val) => val.trim()),
        configs: z.array(z.string()),
        imageUrl: z.string().transform((val) => val.trim()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // First, get the current device with its configs
      const currentDevice = await ctx.db.query.device.findFirst({
        where: eq(device.id, input.id),
        with: {
          configs: {
            with: {
              config: true,
            },
          },
        },
      });

      if (!currentDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found",
        });
      }

      const result = await ctx.db.transaction(async (tx) => {
        // Update the device
        const [updatedDevice] = await tx
          .update(device)
          .set({
            name: input.name,
            type: input.type,
            description: input.description,
            yandexId: input.yandexId,
            imageUrl: input.imageUrl,
          })
          .where(eq(device.id, input.id))
          .returning();

        if (!updatedDevice) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update device",
          });
        }

        // Delete existing config connections
        await tx.delete(configToDevice).where(eq(configToDevice.B, input.id));

        // Insert new config connections
        if (input.configs.length > 0) {
          await tx.insert(configToDevice).values(
            input.configs.map((configId) => ({
              A: configId,
              B: input.id,
            }))
          );
        }

        return updatedDevice;
      });

      return result;
    }),

  /**
   * Deletes one or more devices and their related data
   * @param ids Array of device IDs to delete
   * @returns Success status and count of deleted devices
   */
  deleteDevices: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Delete all devices in a transaction to ensure atomicity
        const result = await ctx.db.transaction(async (tx) => {
          // First, find all device characteristics IDs for the devices
          const characteristics = await tx
            .select({ id: deviceCharacteristics.id })
            .from(deviceCharacteristics)
            .where(inArray(deviceCharacteristics.deviceId, input.ids));

          const characteristicsIds = characteristics.map((c) => c.id);

          if (characteristicsIds.length > 0) {
            // Delete cameras first
            await tx
              .delete(camera)
              .where(inArray(camera.characteristicsId, characteristicsIds));

            // Delete benchmarks
            await tx
              .delete(benchmark)
              .where(inArray(benchmark.characteristicsId, characteristicsIds));

            // Delete SKUs
            await tx
              .delete(sku)
              .where(inArray(sku.characteristicsId, characteristicsIds));

            // Delete screens
            await tx
              .delete(screen)
              .where(inArray(screen.characteristicsId, characteristicsIds));

            // Delete device characteristics
            await tx
              .delete(deviceCharacteristics)
              .where(inArray(deviceCharacteristics.deviceId, input.ids));
          }

          // Delete config connections
          await tx
            .delete(configToDevice)
            .where(inArray(configToDevice.B, input.ids));

          // Delete rating connections
          await tx
            .delete(deviceToRating)
            .where(inArray(deviceToRating.A, input.ids));

          // Delete rating positions
          await tx
            .delete(ratingPosition)
            .where(inArray(ratingPosition.deviceId, input.ids));

          // Delete pros/cons
          await tx
            .delete(prosCons)
            .where(inArray(prosCons.deviceId, input.ids));

          // Delete links
          await tx.delete(link).where(inArray(link.deviceId, input.ids));

          // Finally delete the devices
          const deletedDevices = await tx
            .delete(device)
            .where(inArray(device.id, input.ids))
            .returning();

          return deletedDevices;
        });

        return {
          success: true,
          count: result.length,
        };
      } catch (error) {
        console.error("Error deleting devices:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete devices",
        });
      }
    }),

  /**
   * Gets device characteristics by device ID
   * @param deviceId ID of the device
   * @returns Device characteristics with related data
   */
  getDeviceCharacteristic: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db.query.deviceCharacteristics.findFirst({
        where: eq(deviceCharacteristics.deviceId, input.deviceId),
        orderBy: [desc(deviceCharacteristics.createdAt)],
        with: {
          benchmarks: true,
          cameras: true,
          screens: true,
          skus: true,
        },
      });

      return result || null;
    }),

  /**
   * Deletes device characteristics by device ID
   * @param deviceId ID of the device
   * @returns Success status
   */
  deleteDeviceCharacteristics: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Find the characteristics to delete
      const characteristics =
        await ctx.db.query.deviceCharacteristics.findFirst({
          where: eq(deviceCharacteristics.deviceId, input.deviceId),
          orderBy: [desc(deviceCharacteristics.createdAt)],
          columns: { id: true, slug: true },
        });

      if (!characteristics) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device characteristics not found",
        });
      }

      // Delete the characteristics and all related data in a transaction
      await ctx.db.transaction(async (tx) => {
        // Delete related benchmarks
        await tx
          .delete(benchmark)
          .where(eq(benchmark.characteristicsId, characteristics.id));

        // Delete related cameras
        await tx
          .delete(camera)
          .where(eq(camera.characteristicsId, characteristics.id));

        // Delete related SKUs
        await tx
          .delete(sku)
          .where(eq(sku.characteristicsId, characteristics.id));

        // Delete related screens
        await tx
          .delete(screen)
          .where(eq(screen.characteristicsId, characteristics.id));

        // Delete the characteristics record
        await tx
          .delete(deviceCharacteristics)
          .where(eq(deviceCharacteristics.id, characteristics.id));
      });

      // Revalidate the page if we have a slug
      if (characteristics.slug) {
        await revalidateDevicePage(characteristics.slug);
      }

      return { success: true };
    }),

  /**
   * Gets device characteristics by slug
   * @param slug Device slug
   * @returns Device characteristics with related data
   */
  getDeviceCharacteristicBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const data = await ctx.db.query.deviceCharacteristics.findFirst({
        where: and(
          eq(deviceCharacteristics.slug, input.slug),
          eq(deviceCharacteristics.status, PUBLISH_STATUS.PUBLISHED)
        ),
        columns: {
          id: true,
          name: true,
          brand: true,
          releaseDate: true,
          height_mm: true,
          width_mm: true,
          thickness_mm: true,
          weight_g: true,
          ipRating: true,
          materials: true,
          batteryCapacity_mah: true,
          batteryFastCharging: true,
          batteryWattage: true,
          fingerprintPosition: true,
          cpu: true,
          cpuManufacturer: true,
          cpuCores: true,
          gpu: true,
          nfc: true,
          bluetooth: true,
          sim: true,
          simCount: true,
          usb: true,
          headphoneJack: true,
        },
        with: {
          screens: {
            columns: {
              id: true,
              position: true,
              size_in: true,
              displayType: true,
              resolution: true,
              aspectRatio: true,
              ppi: true,
              displayFeatures: true,
              refreshRate: true,
              brightnessNits: true,
              isMain: true,
            },
            orderBy: [desc(screen.isMain), asc(screen.position)],
          },
          benchmarks: {
            columns: {
              id: true,
              name: true,
              score: true,
            },
          },
          cameras: {
            columns: {
              id: true,
              type: true,
              resolution_mp: true,
              aperture_fstop: true,
              sensor: true,
              features: true,
            },
          },
          device: {
            columns: {
              id: true,
              description: true,
              imageUrl: true,
              valueRating: true,
            },
            with: {
              links: {
                columns: {
                  id: true,
                  url: true,
                  price: true,
                },
                with: {
                  sku: {
                    columns: {
                      id: true,
                      ram_gb: true,
                      storage_gb: true,
                    },
                  },
                },
              },
              ratingPositions: {
                columns: {
                  position: true,
                },
                with: {
                  rating: {
                    columns: {
                      name: true,
                      status: true,
                    },
                  },
                },
                orderBy: [asc(ratingPosition.position)],
                limit: 1,
              },
            },
          },
        },
      });

      if (!data) return null;

      // Check if the device is a confirmed duplicate
      const deviceInfo = await ctx.db.query.device.findFirst({
        where: eq(device.id, data.device.id),
        columns: {
          duplicateStatus: true,
          duplicateOfId: true,
        },
      });

      // If device is a confirmed duplicate, get the canonical device's characteristics slug for redirect
      let redirectSlug: string | null = null;
      if (deviceInfo?.duplicateStatus === "duplicate" && deviceInfo.duplicateOfId) {
        const canonicalCharacteristics = await ctx.db.query.deviceCharacteristics.findFirst({
          where: and(
            eq(deviceCharacteristics.deviceId, deviceInfo.duplicateOfId),
            eq(deviceCharacteristics.status, PUBLISH_STATUS.PUBLISHED)
          ),
          columns: {
            slug: true,
          },
        });

        if (canonicalCharacteristics?.slug) {
          redirectSlug = canonicalCharacteristics.slug;
        }
      }

      // Filter rating positions to only show published ratings
      const filteredRatingPositions = data.device.ratingPositions
        .filter((rp) => rp.rating.status === "PUBLISHED")
        .slice(0, 1); // Take only the first (best) rating
      const result = {
        ...data,
        redirectSlug,
        releaseDate: data.releaseDate ?? null,
        device: {
          ...data.device,
          ratingPositions: filteredRatingPositions,
        },
        cpuCoresArr: data.cpuCores?.split("|") ?? [],
        displayFeaturesArr:
          data.screens
            .find((screen) => screen.isMain)
            ?.displayFeatures?.split("|") ?? [],
      };

      return result;
    }),

  /**
   * Gets all characteristics for a device
   * @param deviceId ID of the device
   * @returns Array of device characteristics
   */
  getDeviceCharacteristics: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const results = await ctx.db.query.deviceCharacteristics.findMany({
        where: eq(deviceCharacteristics.deviceId, input.deviceId),
        orderBy: [desc(deviceCharacteristics.createdAt)],
        with: {
          cameras: true,
          skus: true,
        },
      });

      return results;
    }),

  /**
   * Gets device characteristics by slug (admin access - all statuses)
   * @param slug Device slug
   * @returns Device characteristics with related data
   */
  getDeviceCharacteristicBySlugAdmin: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const data = await ctx.db.query.deviceCharacteristics.findFirst({
        where: eq(deviceCharacteristics.slug, input.slug),
        columns: {
          id: true,
          name: true,
          brand: true,
          status: true,
          publishedAt: true,
          releaseDate: true,
          height_mm: true,
          width_mm: true,
          thickness_mm: true,
          weight_g: true,
          ipRating: true,
          materials: true,
          batteryCapacity_mah: true,
          batteryFastCharging: true,
          batteryWattage: true,
          fingerprintPosition: true,
          cpu: true,
          cpuManufacturer: true,
          cpuCores: true,
          gpu: true,
          nfc: true,
          bluetooth: true,
          sim: true,
          simCount: true,
          usb: true,
          headphoneJack: true,
        },
        with: {
          screens: {
            columns: {
              id: true,
              position: true,
              size_in: true,
              displayType: true,
              resolution: true,
              aspectRatio: true,
              ppi: true,
              displayFeatures: true,
              refreshRate: true,
              brightnessNits: true,
              isMain: true,
            },
            orderBy: [desc(screen.isMain), asc(screen.position)],
          },
          benchmarks: {
            columns: {
              id: true,
              name: true,
              score: true,
            },
          },
          cameras: {
            columns: {
              id: true,
              type: true,
              resolution_mp: true,
              aperture_fstop: true,
              sensor: true,
              features: true,
            },
          },
          device: {
            columns: {
              id: true,
              description: true,
              imageUrl: true,
              valueRating: true,
            },
            with: {
              links: {
                columns: {
                  id: true,
                  url: true,
                  price: true,
                },
                with: {
                  sku: {
                    columns: {
                      id: true,
                      ram_gb: true,
                      storage_gb: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!data) return null;

      const result = {
        ...data,
        cpuCoresArr: data.cpuCores?.split("|") ?? [],
        displayFeaturesArr:
          data.screens
            .find((screen) => screen.isMain)
            ?.displayFeatures?.split("|") ?? [],
      };

      return result;
    }),

  /**
   * Updates device characteristics status
   * @param id Device characteristics ID
   * @param status New status
   * @returns Updated device characteristics
   */
  updateDeviceCharacteristicsStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          PUBLISH_STATUS.DRAFT,
          PUBLISH_STATUS.PUBLISHED,
          PUBLISH_STATUS.PRIVATE,
          PUBLISH_STATUS.ARCHIVED,
        ] as const),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const publishedAt =
        input.status === PUBLISH_STATUS.PUBLISHED ? new Date() : null;

      const [characteristics] = await ctx.db
        .update(deviceCharacteristics)
        .set({
          status: input.status,
          publishedAt: publishedAt,
        })
        .where(eq(deviceCharacteristics.id, input.id))
        .returning({ slug: deviceCharacteristics.slug });

      // Revalidate the page if published and we have a slug
      if (input.status === PUBLISH_STATUS.PUBLISHED && characteristics?.slug) {
        await revalidateDevicePage(characteristics.slug);
      }

      return { success: true };
    }),

  /**
   * Gets IDs of smartphones that have characteristics
   * @returns Array of device IDs
   */
  getSmartphoneIdsWhereCharacteristicsExist: protectedProcedure.query(
    async ({ ctx }) => {
      const smartphoneIdsWhereCharacteristicsExist = await ctx.db
        .select({ deviceId: deviceCharacteristics.deviceId })
        .from(deviceCharacteristics)
        .innerJoin(device, eq(device.id, deviceCharacteristics.deviceId))
        .where(eq(device.type, "Смартфон"));

      return smartphoneIdsWhereCharacteristicsExist.map(
        (item) => item.deviceId
      );
    }
  ),

  /**
   * Updates device specs and related entities (benchmarks, SKUs, cameras)
   * @param id ID of the device characteristics
   * @param props Various device properties
   * @param benchmarks Optional benchmarks to update
   * @param skus Optional SKUs to update
   * @param cameras Optional cameras to update
   * @returns Success status
   */
  updateDeviceSpecsAndRelated: protectedProcedure
    .input(
      z
        .object({
          id: z.string(),
          raw: z.string().optional(),
          name: z.string().optional(),
          brand: z.string().optional(),
          aliases: z.string().optional(),
          releaseDate: z
            .union([z.date(), z.string()])
            .optional()
            .nullable()
            .transform((val) => {
              if (typeof val === "string") {
                return new Date(val);
              }
              return val;
            }),
          height_mm: numericField(),
          width_mm: numericField(),
          thickness_mm: numericField(),
          weight_g: numericField(),
          materials: z.string().optional(),
          ipRating: z.string().optional().nullable(),
          colors: z.string().optional(),
          cpu: z.string().optional().nullable(),
          cpuManufacturer: z.string().optional().nullable(),
          cpuCores: z.string().optional().nullable(),
          gpu: z.string().optional().nullable(),
          sdSlot: z.boolean().optional().nullable(),
          fingerprintPosition: z.string().optional().nullable(),
          nfc: z.boolean().optional().nullable(),
          bluetooth: z.string().optional().nullable(),
          sim: z.string().optional(),
          simCount: numericField({ required: true }),
          usb: z.string().optional().nullable(),
          headphoneJack: z.boolean().optional().nullable(),
          batteryCapacity_mah: numericField(),
          batteryFastCharging: z.boolean().optional().nullable(),
          batteryWattage: numericField(),
          cameraFeatures: z.string().optional(),
          os: z.string().optional().nullable(),
          osSkin: z.string().optional().nullable(),
        })
        .extend({
          benchmarks: z
            .array(
              z.object({
                id: z.string(),
                name: z.string(),
                score: z.number(),
              })
            )
            .optional(),
          skus: z
            .array(
              z.object({
                id: z.string(),
                marketId: z.string(),
                ram_gb: z.number(),
                storage_gb: z.number(),
              })
            )
            .optional(),
          cameras: z
            .array(
              z.object({
                id: z.string(),
                type: z.string().nullable(),
                resolution_mp: numericField({ min: 0 }),
                aperture_fstop: z.string().nullable(),
                sensor: z.string().nullable(),
                features: z.string().nullable(),
              })
            )
            .optional(),
          screens: z
            .array(
              z.object({
                id: z.string(),
                position: z.string(),
                size_in: numericField(),
                displayType: z.string().nullable(),
                resolution: z.string().nullable(),
                aspectRatio: z.string().nullable(),
                ppi: numericField(),
                displayFeatures: z.string().nullable(),
                refreshRate: numericField(),
                brightnessNits: numericField(),
                isMain: z.boolean(),
              })
            )
            .optional(),
        })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, benchmarks, skus, cameras, screens, ...rawData } = input;

      // Get the device characteristics to get the slug
      const [
        characteristics,
        existingBenchmarks,
        existingSkus,
        existingCameras,
        existingScreens,
      ] = await Promise.all([
        ctx.db.query.deviceCharacteristics.findFirst({
          where: eq(deviceCharacteristics.id, id),
          columns: { slug: true },
        }),
        ctx.db
          .select()
          .from(benchmark)
          .where(eq(benchmark.characteristicsId, id)),
        ctx.db.select().from(sku).where(eq(sku.characteristicsId, id)),
        ctx.db.select().from(camera).where(eq(camera.characteristicsId, id)),
        ctx.db.select().from(screen).where(eq(screen.characteristicsId, id)),
      ]);

      // Prepare all changes
      const benchmarkChanges = getRelatedDataChanges(
        benchmarks,
        existingBenchmarks
      );
      const skuChanges = getRelatedDataChanges(skus, existingSkus);
      const cameraChanges = getRelatedDataChanges(cameras, existingCameras);
      const screenChanges = getRelatedDataChanges(screens, existingScreens);

      // Execute all database operations in a single transaction
      await ctx.db.transaction(async (tx) => {
        // Update main characteristics
        const newSlug = `${input.brand?.toLowerCase()}-${input.name
          ?.toLowerCase()
          .replace(/\s+/g, "-")}`;

        // Update characteristics with the provided data
        await tx
          .update(deviceCharacteristics)
          .set({
            slug: newSlug,
            raw: rawData.raw,
            name: rawData.name,
            brand: rawData.brand,
            aliases: rawData.aliases,
            releaseDate: rawData.releaseDate,
            height_mm: rawData.height_mm,
            width_mm: rawData.width_mm,
            thickness_mm: rawData.thickness_mm,
            weight_g: rawData.weight_g,
            materials: rawData.materials,
            ipRating: rawData.ipRating,
            colors: rawData.colors,
            cpu: rawData.cpu,
            cpuManufacturer: rawData.cpuManufacturer,
            cpuCores: rawData.cpuCores,
            gpu: rawData.gpu,
            sdSlot: rawData.sdSlot,
            fingerprintPosition: rawData.fingerprintPosition,
            nfc: rawData.nfc,
            bluetooth: rawData.bluetooth,
            sim: rawData.sim,
            simCount: rawData.simCount!,
            usb: rawData.usb,
            headphoneJack: rawData.headphoneJack,
            batteryCapacity_mah: rawData.batteryCapacity_mah,
            batteryFastCharging: rawData.batteryFastCharging,
            batteryWattage: rawData.batteryWattage,
            cameraFeatures: rawData.cameraFeatures,
            os: rawData.os,
            osSkin: rawData.osSkin,
          })
          .where(eq(deviceCharacteristics.id, id));

        // Handle benchmarks
        if (benchmarkChanges.toDeleteIds.length > 0) {
          await tx
            .delete(benchmark)
            .where(inArray(benchmark.id, benchmarkChanges.toDeleteIds));
        }
        if (benchmarkChanges.toCreate.length > 0) {
          await tx.insert(benchmark).values(
            benchmarkChanges.toCreate.map((item) => ({
              ...item,
              characteristicsId: id,
            }))
          );
        }
        for (const item of benchmarkChanges.toUpdate) {
          if (!item.id) continue;
          await tx.update(benchmark).set(item).where(eq(benchmark.id, item.id));
        }

        // Handle SKUs
        if (skuChanges.toDeleteIds.length > 0) {
          await tx.delete(sku).where(inArray(sku.id, skuChanges.toDeleteIds));
        }
        if (skuChanges.toCreate.length > 0) {
          await tx.insert(sku).values(
            skuChanges.toCreate.map((item) => ({
              ...item,
              characteristicsId: id,
            }))
          );
        }
        for (const item of skuChanges.toUpdate) {
          if (!item.id) continue;
          await tx.update(sku).set(item).where(eq(sku.id, item.id));
        }

        // Handle cameras
        if (cameraChanges.toDeleteIds.length > 0) {
          await tx
            .delete(camera)
            .where(inArray(camera.id, cameraChanges.toDeleteIds));
        }
        if (cameraChanges.toCreate.length > 0) {
          const createData = cameraChanges.toCreate.map((item) => ({
            type: item.type || "",
            resolution_mp: item.resolution_mp ?? 0,
            aperture_fstop: item.aperture_fstop || "",
            sensor: item.sensor || "",
            features: item.features || "",
            characteristicsId: id,
          }));
          await tx.insert(camera).values(createData);
        }
        for (const item of cameraChanges.toUpdate) {
          if (!item.id) continue;
          await tx
            .update(camera)
            .set({
              type: item.type || "",
              resolution_mp: item.resolution_mp ?? 0,
              aperture_fstop: item.aperture_fstop || "",
              sensor: item.sensor || "",
              features: item.features || "",
            })
            .where(eq(camera.id, item.id));
        }

        // Handle screens
        if (screenChanges.toDeleteIds.length > 0) {
          await tx
            .delete(screen)
            .where(inArray(screen.id, screenChanges.toDeleteIds));
        }
        if (screenChanges.toCreate.length > 0) {
          const createData = screenChanges.toCreate.map((item) => ({
            position: item.position || "main",
            size_in: item.size_in,
            displayType: item.displayType || "",
            resolution: item.resolution || "",
            aspectRatio: item.aspectRatio || "",
            ppi: item.ppi,
            displayFeatures: item.displayFeatures || "",
            refreshRate: item.refreshRate,
            brightnessNits: item.brightnessNits,
            isMain: item.isMain ?? false,
            characteristicsId: id,
          }));
          await tx.insert(screen).values(createData);
        }
        for (const item of screenChanges.toUpdate) {
          if (!item.id) continue;
          await tx
            .update(screen)
            .set({
              position: item.position || "main",
              size_in: item.size_in,
              displayType: item.displayType || "",
              resolution: item.resolution || "",
              aspectRatio: item.aspectRatio || "",
              ppi: item.ppi,
              displayFeatures: item.displayFeatures || "",
              refreshRate: item.refreshRate,
              brightnessNits: item.brightnessNits,
              isMain: item.isMain ?? false,
            })
            .where(eq(screen.id, item.id));
        }
      });

      // Revalidate page outside of transaction
      if (characteristics?.slug) {
        await revalidateDevicePage(characteristics.slug);
      }

      return { success: true };
    }),

  /**
   * Deletes device specs
   * @param id ID of the device characteristics
   * @returns Deleted device characteristics
   */
  deleteDeviceSpecs: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await ctx.db
        .delete(deviceCharacteristics)
        .where(eq(deviceCharacteristics.id, input.id))
        .returning();

      return deleted;
    }),

  /**
   * Updates a camera
   * @param id Camera ID
   * @param resolution_mp Optional resolution in megapixels
   * @param aperture_fstop Optional aperture
   * @param sensor Optional sensor information
   * @param front Optional flag indicating if it's a front camera
   * @returns Updated camera
   */
  updateCamera: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        resolution_mp: z.number().optional(),
        aperture_fstop: z.string().optional(),
        sensor: z.string().nullable().optional(),
        front: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      const [updated] = await ctx.db
        .update(camera)
        .set(updateData)
        .where(eq(camera.id, id))
        .returning();

      return updated;
    }),

  /**
   * Deletes a camera
   * @param id Camera ID
   * @returns Deleted camera
   */
  deleteCamera: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await ctx.db
        .delete(camera)
        .where(eq(camera.id, input.id))
        .returning();

      return deleted;
    }),

  /**
   * Updates an SKU
   * @param id SKU ID
   * @param marketId Optional market ID
   * @param ram_gb Optional RAM in GB
   * @param storage_gb Optional storage in GB
   * @returns Updated SKU
   */
  updateSku: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        marketId: z.string().optional(),
        ram_gb: z.number().int().optional(),
        storage_gb: z.number().int().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      const [updated] = await ctx.db
        .update(sku)
        .set(updateData)
        .where(eq(sku.id, id))
        .returning();

      return updated;
    }),

  /**
   * Deletes an SKU
   * @param id SKU ID
   * @returns Deleted SKU
   */
  deleteSku: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await ctx.db
        .delete(sku)
        .where(eq(sku.id, input.id))
        .returning();

      return deleted;
    }),

  /**
   * Updates the value rating of a device
   * @param deviceId Device ID
   * @param value Rating value (0-100)
   * @returns Updated device
   */
  updateDeviceValueRating: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        value: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get the device characteristics to get the slug
      const characteristics =
        await ctx.db.query.deviceCharacteristics.findFirst({
          where: eq(deviceCharacteristics.deviceId, input.deviceId),
          columns: { slug: true },
        });

      const [result] = await ctx.db
        .update(device)
        .set({
          valueRating: input.value,
        })
        .where(eq(device.id, input.deviceId))
        .returning();

      // Revalidate the page if we have a slug
      if (characteristics?.slug) {
        await revalidateDevicePage(characteristics.slug);
      }

      return result;
    }),

  /**
   * Update device's availability status
   * @param deviceId Device ID
   * @param status Availability status (selling, not_in_sale, not_yet_in_sale)
   * @returns Updated device
   */
  updateDeviceAvailabilityStatus: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        status: z.enum(["selling", "not_in_sale", "not_yet_in_sale"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .update(device)
        .set({
          availabilityStatus: input.status,
          updatedAt: new Date(),
        })
        .where(eq(device.id, input.deviceId))
        .returning();

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found",
        });
      }

      return result;
    }),

  /**
   * Gets detailed information about a device
   * @param deviceId Device ID
   * @returns Device with related data
   */
  getDevice: publicProcedure
    .input(
      z.object({
        deviceId: z.string().nullish(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { deviceId } = input;

      if (!deviceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device ID is required",
        });
      }

      const deviceData = await ctx.db.query.device.findFirst({
        where: eq(device.id, deviceId),
        with: {
          links: {
            with: {
              sku: true,
              marketplace: true,
            },
          },
          ratingPositions: {
            with: {
              rating: true,
            },
          },
          configs: {
            with: {
              config: true,
            },
          },
          characteristics: true,
          ratings: {
            with: {
              rating: {
                columns: {
                  id: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!deviceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found",
        });
      }

      return {
        ...deviceData,
        configs: deviceData.configs?.map((c) => c.config) || [],
      };
    }),

  /**
   * Gets devices by their IDs
   * @param deviceIds Array of device IDs
   * @returns Array of devices with related data
   */
  getDevicesById: protectedProcedure
    .input(
      z.object({
        deviceIds: z.array(z.string()),
      })
    )
    .query(async ({ input, ctx }) => {
      const { deviceIds } = input;

      if (deviceIds.length === 0) return [];

      const devices = await ctx.db.query.device.findMany({
        where: inArray(device.id, deviceIds),
        with: {
          links: {
            with: {
              marketplace: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          configs: {
            with: {
              config: true,
            },
          },
          characteristics: {
            with: {
              skus: true,
            },
          },
          ratingPositions: true,
        },
      });

      return devices.map((device) => ({
        ...device,
        configs: device.configs?.map((c) => c.config) || [],
      }));
    }),

  /**
   * Gets pros and cons for a device
   * @param deviceId Device ID
   * @returns Object with pros and cons arrays
   */
  getDeviceProsAndCons: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const prosAndConsData = await ctx.db
        .select()
        .from(prosCons)
        .where(eq(prosCons.deviceId, input.deviceId))
        .orderBy(asc(prosCons.createdAt));

      return {
        pros: prosAndConsData
          .filter((item) => item.type === "pro")
          .map((item) => ({ id: item.id, text: item.text })),
        cons: prosAndConsData
          .filter((item) => item.type === "con")
          .map((item) => ({ id: item.id, text: item.text })),
      };
    }),

  /**
   * Adds a new pro or con for a device
   * @param deviceId Device ID
   * @param type Type of item ("pro" or "con")
   * @param text Text content
   * @returns Created ProsCons item
   */
  addProsCons: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        type: z.enum(["pro", "con"]),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [created] = await ctx.db
        .insert(prosCons)
        .values({
          deviceId: input.deviceId,
          type: input.type,
          text: input.text,
        })
        .returning();

      return created;
    }),

  /**
   * Updates an existing pro or con
   * @param id ProsCons ID
   * @param text Updated text content
   * @returns Updated ProsCons item
   */
  updateProsCons: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [updated] = await ctx.db
        .update(prosCons)
        .set({
          text: input.text,
        })
        .where(eq(prosCons.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Deletes a pro or con
   * @param id ProsCons ID
   * @returns Deleted ProsCons item
   */
  deleteProsCons: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await ctx.db
        .delete(prosCons)
        .where(eq(prosCons.id, input.id))
        .returning();

      return deleted;
    }),

  /**
   * Gets unique device types from the database
   * @returns Array of unique device types
   */
  getDeviceTypes: publicProcedure.query(async ({ ctx }) => {
    const devices = await ctx.db
      .selectDistinct({ type: device.type })
      .from(device)
      .where(isNotNull(device.type));

    return devices
      .map((d) => d.type)
      .filter((type): type is string => type !== null && type !== undefined)
      .sort();
  }),
});
