import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/src/server/api/trpc";
import { eq, sql } from "drizzle-orm";
import {
  device,
  link,
  deviceCharacteristics,
  ratingsPage,
} from "@/src/server/db/schema";
import { PUBLISH_STATUS } from "@/src/constants/publishStatus";
import { getAgeStyle, type AgeCategory } from "@/src/utils/utils";

// Custom age thresholds for dashboard (different from default)
const DASHBOARD_AGE_THRESHOLDS = {
  recent: 7, // This week
  aging: 14, // 2 weeks
  old: 30, // 1 month
  veryOld: 180, // 6 months
};

export const dashboardWidgetsRouter = createTRPCRouter({
  /**
   * Widget 1: Device price update stats
   * Groups devices by last price update age
   */
  getDeviceUpdateStats: publicProcedure.query(async ({ ctx }) => {
    // Get all devices with their most recent link update and availability status
    const devicesWithLastUpdate = await ctx.db
      .select({
        deviceId: device.id,
        availabilityStatus: device.availabilityStatus,
        lastUpdate: sql<string>`MAX(${link.updatedAt})`,
      })
      .from(device)
      .leftJoin(link, eq(link.deviceId, device.id))
      .groupBy(device.id, device.availabilityStatus);

    // Calculate time buckets
    const stats = devicesWithLastUpdate.reduce(
      (acc, row) => {
        // Only include "selling" devices in age categories
        if (row.availabilityStatus !== "selling") {
          acc.notSelling++;
          return acc;
        }

        if (!row.lastUpdate) {
          acc.notSelling++;
          return acc;
        }

        const lastUpdate = new Date(row.lastUpdate);
        const ageCategory: AgeCategory = getAgeStyle(
          lastUpdate,
          DASHBOARD_AGE_THRESHOLDS
        );

        if (ageCategory === "very-old") acc.veryOld++;
        else if (ageCategory === "old") acc.old++;
        else if (ageCategory === "aging") acc.aging++;
        else acc.fresh++; // Combines fresh + recent

        return acc;
      },
      { notSelling: 0, veryOld: 0, old: 0, aging: 0, fresh: 0 }
    );

    const total = devicesWithLastUpdate.length;

    return {
      fresh: stats.fresh,
      aging: stats.aging,
      old: stats.old,
      veryOld: stats.veryOld,
      notSelling: stats.notSelling,
      total,
    };
  }),

  /**
   * Widget 2: Ratings pages overview
   * Shows top pages with their groups and last update times
   */
  getRatingsPagesOverview: publicProcedure.query(async ({ ctx }) => {
    const pages = await ctx.db.query.ratingsPage.findMany({
      where: eq(ratingsPage.status, PUBLISH_STATUS.PUBLISHED),
      orderBy: (ratingsPage, { desc }) => [desc(ratingsPage.updatedAt)],
      with: {
        groups: {
          with: {
            group: {
              with: {
                ratings: {
                  columns: {
                    id: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
          orderBy: (ratingsPagePosition, { asc }) => [
            asc(ratingsPagePosition.position),
          ],
        },
      },
    });

    // Get total count of all published pages
    const totalPagesResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(ratingsPage)
      .where(eq(ratingsPage.status, PUBLISH_STATUS.PUBLISHED));

    const totalPages = totalPagesResult[0]?.count ?? 0;

    // Transform data for easier consumption
    const transformedPages = pages.map((page) => ({
      id: page.id,
      name: page.name,
      updatedAt: page.updatedAt,
      groups: page.groups.map((pg) => ({
        id: pg.group.id,
        name: pg.group.name,
        ratingCount: pg.group.ratings.length,
        lastUpdate:
          pg.group.ratings.length > 0
            ? new Date(
                Math.max(
                  ...pg.group.ratings.map((r) => new Date(r.updatedAt).getTime())
                )
              )
            : pg.group.updatedAt,
      })),
    }));

    return {
      pages: transformedPages,
      totalPages,
    };
  }),

  /**
   * Widget 3: Characteristics coverage stats
   * Shows how many devices have characteristics data
   */
  getCharacteristicsCoverage: publicProcedure.query(async ({ ctx }) => {
    // Count total devices
    const totalDevicesResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(device);

    const totalDevices = totalDevicesResult[0]?.count ?? 0;

    // Count devices with characteristics by status
    const characteristicsStats = await ctx.db
      .select({
        status: deviceCharacteristics.status,
        count: sql<number>`count(*)`,
      })
      .from(deviceCharacteristics)
      .groupBy(deviceCharacteristics.status);

    // Calculate stats
    const published =
      characteristicsStats.find((s) => s.status === PUBLISH_STATUS.PUBLISHED)
        ?.count ?? 0;
    const draft =
      characteristicsStats.find((s) => s.status === PUBLISH_STATUS.DRAFT)
        ?.count ?? 0;

    const withCharacteristics = published + draft;
    const withoutCharacteristics = totalDevices - withCharacteristics;
    const coveragePercent =
      totalDevices > 0 ? (withCharacteristics / totalDevices) * 100 : 0;

    // Determine completion rating
    let completionRating: "poor" | "fair" | "good" | "excellent";
    if (coveragePercent < 50) completionRating = "poor";
    else if (coveragePercent < 70) completionRating = "fair";
    else if (coveragePercent < 85) completionRating = "good";
    else completionRating = "excellent";

    return {
      totalDevices,
      withCharacteristics,
      withoutCharacteristics,
      published,
      draft,
      coveragePercent: Math.round(coveragePercent * 10) / 10, // Round to 1 decimal
      completionRating,
    };
  }),

  /**
   * Get devices by age category for the stats widget
   */
  getDevicesByAgeCategory: publicProcedure
    .input(
      z.object({
        category: z.enum(["fresh", "aging", "old", "veryOld", "notSelling"]),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build subquery to get latest link update per device with availability status
      const devicesWithLastUpdate = await ctx.db
        .select({
          deviceId: device.id,
          deviceName: device.name,
          deviceType: device.type,
          availabilityStatus: device.availabilityStatus,
          lastUpdate: sql<string>`MAX(${link.updatedAt})`,
        })
        .from(device)
        .leftJoin(link, eq(link.deviceId, device.id))
        .groupBy(device.id, device.name, device.type, device.availabilityStatus);

      // Filter by category
      const filtered = devicesWithLastUpdate.filter((row) => {
        if (input.category === "notSelling") {
          // Include devices that are not selling OR have no price data
          return row.availabilityStatus !== "selling" || !row.lastUpdate;
        }

        // Only process "selling" devices for age categories
        if (row.availabilityStatus !== "selling") return false;
        if (!row.lastUpdate) return false;

        const lastUpdate = new Date(row.lastUpdate);
        const ageCategory = getAgeStyle(lastUpdate, DASHBOARD_AGE_THRESHOLDS);

        switch (input.category) {
          case "fresh":
            return ageCategory === "fresh" || ageCategory === "recent";
          case "aging":
            return ageCategory === "aging";
          case "old":
            return ageCategory === "old";
          case "veryOld":
            return ageCategory === "very-old";
          default:
            return false;
        }
      });

      // Enrich with additional data (links, characteristics status, and availability status)
      const enrichedDevices = await Promise.all(
        filtered.map(async (row) => {
          // Get links for price display
          const deviceLinks = await ctx.db.query.link.findMany({
            where: eq(link.deviceId, row.deviceId),
          });

          // Check if device has characteristics
          const characteristics = await ctx.db.query.deviceCharacteristics.findFirst({
            where: eq(deviceCharacteristics.deviceId, row.deviceId),
            columns: { id: true },
          });

          return {
            id: row.deviceId,
            name: row.deviceName,
            type: row.deviceType,
            availabilityStatus: row.availabilityStatus,
            lastUpdate: row.lastUpdate ? new Date(row.lastUpdate) : null,
            links: deviceLinks,
            hasProfile: !!characteristics,
          };
        })
      );

      return enrichedDevices;
    }),

  /**
   * Widget 4: Analytics preview
   * Returns null for now - placeholder for future analytics integration
   */
  getAnalyticsPreview: publicProcedure.query(async () => {
    // Future: Return analytics data from WordPress API or analytics service
    return null;
  }),
});
