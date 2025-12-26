import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { toast } from "sonner";
import { eq, and, inArray, sql, asc, ne } from "drizzle-orm";
import {
  rating,
  ratingType,
  ratingCategory,
  ratingPosition,
  device,
  deviceToRating,
  ratingToRatingCategory,
} from "@/src/server/db/schema";
import { PUBLISH_STATUS } from "@/src/constants/publishStatus";
import { generateUniqueSlug } from "@/src/lib/slug";

const ratingTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().transform((val) => val.trim()),
  displayName: z
    .string()
    .nullable()
    .transform((val) => val?.trim() ?? null),
  description: z
    .string()
    .nullable()
    .transform((val) => val?.trim() ?? null),
});

const ratingCategorySchema = z.object({
  name: z.string().transform((val) => val.trim()),
  slug: z.string().transform((val) => val.trim()),
  description: z
    .string()
    .nullable()
    .transform((val) => val?.trim() ?? null),
});

export const ratingRouter = createTRPCRouter({
  /**
   * Gets all ratings with their related data
   * @returns List of ratings with types, categories, and devices
   */
  getAllRatings: publicProcedure.query(async ({ ctx }) => {
    const ratings = await ctx.db.query.rating.findMany({
      with: {
        ratingType: true,
        ratingCategories: {
          with: {
            ratingCategory: true,
          },
        },
        devices: {
          with: {
            device: {
              with: {
                ratingPositions: true,
                configs: {
                  with: {
                    config: true,
                  },
                },
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
              },
            },
          },
        },
      },
    });

    // Transform the data to match the expected structure
    const transformedRatings = ratings.map((rating) => ({
      ...rating,
      RatingType: rating.ratingType,
      RatingCategory: rating.ratingCategories.map((rc) => rc.ratingCategory),
      devices: rating.devices
        .filter((d) => d.device !== null)
        .map((d) => ({
          ...d.device,
          ratingPositions: d.device.ratingPositions || [],
          configs: d.device.configs?.map((c) => c.config) || [],
          links:
            d.device.links?.map((l) => ({
              ...l,
              marketplace: l.marketplace || null,
            })) || [],
        })),
    }));

    return transformedRatings;
  }),

  /**
   * Gets all ratings with their related data (admin access - all statuses)
   * @returns List of ratings with types, categories, and devices
   */
  getAllRatingsAdmin: protectedProcedure
    .input(
      z.object({
        status: z
          .enum([
            PUBLISH_STATUS.DRAFT,
            PUBLISH_STATUS.PUBLISHED,
            PUBLISH_STATUS.PRIVATE,
            PUBLISH_STATUS.ARCHIVED,
          ] as const)
          .optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const ratings = await ctx.db.query.rating.findMany({
        where: input.status ? eq(rating.status, input.status) : undefined,
        with: {
          ratingType: true,
          ratingCategories: {
            with: {
              ratingCategory: true,
            },
          },
          ratingPositions: {
            with: {
              device: {
                with: {
                  configs: {
                    with: {
                      config: true,
                    },
                  },
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
                },
              },
            },
            orderBy: (ratingPosition, { asc }) => [asc(ratingPosition.position)],
          },
        },
      });

      // Transform the data to match the expected structure
      return ratings.map((rating) => ({
        ...rating,
        RatingType: rating.ratingType,
        RatingCategory: rating.ratingCategories.map((rc) => rc.ratingCategory),
        devices: rating.ratingPositions.map((rp) => ({
          ...rp.device,
          configs: rp.device.configs?.map((c) => c.config).filter(Boolean) || [],
        })),
      }));
    }),

  /**
   * Creates a new rating
   * @param name Rating name
   * @param ratingTypeId Rating type ID
   * @param status Optional status (defaults to DRAFT)
   * @returns Created rating
   */
  createRating: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        ratingTypeId: z.string(),
        status: z
          .enum([
            PUBLISH_STATUS.DRAFT,
            PUBLISH_STATUS.PUBLISHED,
            PUBLISH_STATUS.PRIVATE,
            PUBLISH_STATUS.ARCHIVED,
          ] as const)
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const publishedAt =
        input.status === PUBLISH_STATUS.PUBLISHED ? new Date() : null;

      const slug = await generateUniqueSlug(
        input.name,
        async (slug: string) => {
          const existing = await ctx.db.query.rating.findFirst({
            where: eq(rating.slug, slug),
          });
          return !!existing;
        }
      );

      const result = await ctx.db
        .insert(rating)
        .values({
          name: input.name,
          slug,
          ratingTypeId: input.ratingTypeId,
          status: input.status || PUBLISH_STATUS.DRAFT,
          publishedAt,
        })
        .returning();

      return result[0];
    }),

  /**
   * Updates rating status
   * @param id Rating ID
   * @param status New status
   * @returns Updated rating
   */
  updateRatingStatus: protectedProcedure
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

      const result = await ctx.db
        .update(rating)
        .set({
          status: input.status,
          publishedAt: publishedAt,
        })
        .where(eq(rating.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Publishes a rating (convenience method)
   * @param id Rating ID
   * @returns Updated rating
   */
  publishRating: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .update(rating)
        .set({
          status: PUBLISH_STATUS.PUBLISHED,
          publishedAt: new Date(),
        })
        .where(eq(rating.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Unpublishes a rating (sets to DRAFT)
   * @param id Rating ID
   * @returns Updated rating
   */
  unpublishRating: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .update(rating)
        .set({
          status: PUBLISH_STATUS.DRAFT,
          publishedAt: null,
        })
        .where(eq(rating.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Bulk update rating status for multiple ratings
   * @param ids Array of rating IDs
   * @param status New status
   * @returns Update count
   */
  bulkUpdateRatingStatus: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
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

      const result = await ctx.db
        .update(rating)
        .set({
          status: input.status,
          publishedAt,
        })
        .where(inArray(rating.id, input.ids))
        .returning();

      return { count: result.length };
    }),

  /**
   * Deletes a rating
   * @param id Rating ID
   * @returns Deleted rating
   */
  deleteRating: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // First, check if the rating exists
        const existingRating = await tx.query.rating.findFirst({
          where: eq(rating.id, input.id),
        });

        if (!existingRating) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Rating not found",
          });
        }

        // First, disconnect all devices from this rating to clean up the many-to-many relationship
        await tx.delete(deviceToRating).where(eq(deviceToRating.B, input.id));

        // Delete rating positions
        await tx
          .delete(ratingPosition)
          .where(eq(ratingPosition.ratingId, input.id));

        // Delete rating category relationships
        await tx
          .delete(ratingToRatingCategory)
          .where(eq(ratingToRatingCategory.A, input.id));

        // Then delete the rating
        const result = await tx
          .delete(rating)
          .where(eq(rating.id, input.id))
          .returning();

        return result[0];
      });
    }),

  /**
   * Gets devices and their positions for a specific rating
   * @param id Rating ID
   * @returns Rating positions and devices
   */
  getRatingDevices: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [ratingPositions, ratingWithDevices] = await Promise.all([
        ctx.db
          .select()
          .from(ratingPosition)
          .where(eq(ratingPosition.ratingId, input.id)),
        ctx.db.query.rating.findFirst({
          where: eq(rating.id, input.id),
          with: {
            devices: {
              with: {
                device: {
                  with: {
                    configs: {
                      with: {
                        config: {
                          columns: {
                            name: true,
                            id: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

      return {
        ratingPosition: ratingPositions,
        devices: ratingWithDevices?.devices.map((d) => d.device) || [],
      };
    }),

  /**
   * Gets a rating by ID (only published ratings)
   * @param id Rating ID
   * @returns Rating
   */
  getRatingById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const ratingData = await ctx.db.query.rating.findFirst({
        where: and(
          eq(rating.id, input.id),
          eq(rating.status, PUBLISH_STATUS.PUBLISHED)
        ),
        with: {
          ratingType: true,
          ratingCategories: {
            with: {
              ratingCategory: true,
            },
          },
          devices: {
            with: {
              device: {
                with: {
                  links: {
                    columns: {
                      price: true,
                      url: true,
                    },
                  },
                  ratingPositions: {
                    where: (ratingPosition, { eq }) =>
                      eq(ratingPosition.ratingId, input.id),
                    columns: {
                      position: true,
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

      return {
        ...ratingData,
        RatingType: ratingData.ratingType,
        RatingCategory: ratingData.ratingCategories.map(
          (rc) => rc.ratingCategory
        ),
        devices: ratingData.devices
          .map((deviceRelation) => ({
            ...deviceRelation.device,
            ratingPosition: deviceRelation.device.ratingPositions[0]?.position,
            price: deviceRelation.device.links[0]?.price,
            link: deviceRelation.device.links[0],
            RatingPosition: deviceRelation.device.ratingPositions,
          }))
          .sort((a, b) => (a.ratingPosition || 0) - (b.ratingPosition || 0)),
      };
    }),

  /**
   * Gets a rating by slug (only published ratings)
   * @param slug Rating slug
   * @returns Rating
   */
  getRatingBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      // Step 1: Get rating with devices and links
      const ratingData = await ctx.db.query.rating.findFirst({
        where: and(
          eq(rating.slug, input.slug),
          eq(rating.status, PUBLISH_STATUS.PUBLISHED)
        ),
        with: {
          ratingType: true,
          ratingCategories: {
            with: {
              ratingCategory: true,
            },
          },
          devices: {
            with: {
              device: {
                with: {
                  links: {
                    columns: {
                      price: true,
                      url: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Return null if rating doesn't exist
      if (!ratingData) {
        return null;
      }

      // Step 2: Get rating positions for all devices in this rating
      const deviceIds = ratingData.devices.map((d) => d.device.id);
      const ratingPositions =
        deviceIds.length > 0
          ? await ctx.db
              .select({
                deviceId: ratingPosition.deviceId,
                position: ratingPosition.position,
              })
              .from(ratingPosition)
              .where(
                and(
                  eq(ratingPosition.ratingId, ratingData.id),
                  inArray(ratingPosition.deviceId, deviceIds)
                )
              )
          : [];

      // Create a map for efficient position lookup
      const positionMap = new Map(
        ratingPositions.map((pos) => [pos.deviceId, pos.position])
      );

      // Step 3: Merge position data into devices array
      return {
        ...ratingData,
        RatingType: ratingData.ratingType,
        RatingCategory: ratingData.ratingCategories.map(
          (rc) => rc.ratingCategory
        ),
        devices: ratingData.devices
          .map((deviceRelation) => ({
            ...deviceRelation.device,
            ratingPosition: positionMap.get(deviceRelation.device.id),
            price: deviceRelation.device.links[0]?.price,
            link: deviceRelation.device.links[0],
          }))
          .sort((a, b) => (a.ratingPosition || 0) - (b.ratingPosition || 0)),
      };
    }),
  /**
   * Removes a device from a rating
   * @param deviceId Device ID
   * @param ratingId Rating ID
   * @returns Updated rating
   */
  removeDeviceFromRating: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        ratingId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .delete(deviceToRating)
        .where(
          and(
            eq(deviceToRating.A, input.deviceId),
            eq(deviceToRating.B, input.ratingId)
          )
        );

      // Also remove rating position if it exists
      await ctx.db
        .delete(ratingPosition)
        .where(
          and(
            eq(ratingPosition.deviceId, input.deviceId),
            eq(ratingPosition.ratingId, input.ratingId)
          )
        );

      // Return the updated rating
      const result = await ctx.db.query.rating.findFirst({
        where: eq(rating.id, input.ratingId),
      });

      return result;
    }),

  /**
   * Sets the position for a device in a rating
   * @param ratingId Rating ID
   * @param deviceId Device ID
   * @param position Position number
   * @returns Created rating position
   */
  setRatingPosition: protectedProcedure
    .input(
      z.object({
        ratingId: z.string(),
        deviceId: z.string(),
        position: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await ctx.db
          .delete(ratingPosition)
          .where(
            and(
              eq(ratingPosition.deviceId, input.deviceId),
              eq(ratingPosition.ratingId, input.ratingId)
            )
          );
      } catch (e) {
        console.log(e);
      }

      try {
        await ctx.db
          .delete(ratingPosition)
          .where(
            and(
              eq(ratingPosition.position, input.position),
              eq(ratingPosition.ratingId, input.ratingId)
            )
          );
      } catch (e) {
        console.log(e);
      }

      const result = await ctx.db
        .insert(ratingPosition)
        .values({
          ratingId: input.ratingId,
          deviceId: input.deviceId,
          position: input.position,
        })
        .returning();

      return result[0];
    }),

  /**
   * Sets positions for multiple devices in a rating
   * @param ratingId Rating ID
   * @param positions Array of device positions
   * @returns Array of updated rating positions
   */
  setRatingPositions: protectedProcedure
    .input(
      z.object({
        ratingId: z.string(),
        positions: z.array(
          z.object({
            deviceId: z.string(),
            position: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { ratingId, positions } = input;

      const result = await ctx.db.transaction(async (tx) => {
        const results = [];
        for (const update of positions) {
          // Delete existing position for this device and rating
          await tx
            .delete(ratingPosition)
            .where(
              and(
                eq(ratingPosition.ratingId, ratingId),
                eq(ratingPosition.deviceId, update.deviceId)
              )
            );

          // Insert new position
          const inserted = await tx
            .insert(ratingPosition)
            .values({
              deviceId: update.deviceId,
              ratingId: ratingId,
              position: update.position,
            })
            .returning();

          results.push(inserted[0]);
        }
        return results;
      });

      toast.success("Позиции успешно обновлены");
      return result;
    }),

  /**
   * Associates a device with a rating
   * @param deviceId Device ID
   * @param ratingId Rating ID
   * @returns Updated device
   */
  attachDeviceToRating: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        ratingId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const deviceData = await ctx.db.query.device.findFirst({
        where: eq(device.id, input.deviceId),
      });

      if (!deviceData) {
        throw new Error("Device not found");
      }

      const ratingData = await ctx.db.query.rating.findFirst({
        where: eq(rating.id, input.ratingId),
      });

      if (!ratingData) {
        throw new Error("Rating not found");
      }

      // Insert into the many-to-many relationship table
      await ctx.db
        .insert(deviceToRating)
        .values({
          A: input.deviceId,
          B: input.ratingId,
        })
        .onConflictDoNothing();

      toast.success("Device attached to rating successfully");
      return deviceData;
    }),

  /**
   * Gets ratings for a specific device
   * @param deviceId Device ID
   * @returns Array of ratings with their positions
   */
  getDeviceRatings: publicProcedure
    .input(z.object({ deviceId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      if (!input.deviceId) return [];

      // Get ratings that include this device
      const deviceRatings = await ctx.db
        .select({
          id: rating.id,
          name: rating.name,
          ratingTypeId: rating.ratingTypeId,
        })
        .from(rating)
        .innerJoin(deviceToRating, eq(deviceToRating.B, rating.id))
        .where(eq(deviceToRating.A, input.deviceId));

      if (deviceRatings.length === 0) return [];

      // Get rating types and positions for these ratings
      const ratingIds = deviceRatings.map((r) => r.id);

      const [ratingTypes, positions] = await Promise.all([
        ctx.db
          .select({
            id: ratingType.id,
            name: ratingType.name,
            displayName: ratingType.displayName,
          })
          .from(ratingType)
          .where(
            inArray(
              ratingType.id,
              deviceRatings.map((r) => r.ratingTypeId)
            )
          ),

        ctx.db
          .select({
            ratingId: ratingPosition.ratingId,
            position: ratingPosition.position,
          })
          .from(ratingPosition)
          .where(
            and(
              eq(ratingPosition.deviceId, input.deviceId),
              inArray(ratingPosition.ratingId, ratingIds)
            )
          ),
      ]);

      const typeMap = new Map(ratingTypes.map((t) => [t.id, t]));
      const positionMap = new Map(
        positions.map((p) => [p.ratingId, p.position])
      );

      return deviceRatings.map((r) => ({
        id: r.id,
        name: r.name,
        RatingType: typeMap.get(r.ratingTypeId) || null,
        RatingPosition: [{ position: positionMap.get(r.id) }].filter(
          (p) => p.position !== undefined
        ),
      }));
    }),

  /**
   * Adds a rating to a category
   * @param ratingId Rating ID
   * @param categoryId Category ID
   * @returns Updated rating category
   */
  addRatingToCategory: protectedProcedure
    .input(
      z.object({
        ratingId: z.string(),
        categoryId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Insert into the many-to-many relationship table
      await ctx.db
        .insert(ratingToRatingCategory)
        .values({
          A: input.ratingId,
          B: input.categoryId,
        })
        .onConflictDoNothing();

      // Return the updated category
      const result = await ctx.db.query.ratingCategory.findFirst({
        where: eq(ratingCategory.id, input.categoryId),
      });

      return result;
    }),

  /**
   * Gets all rating categories with their ratings
   * @returns Array of rating categories
   */
  getAllCategories: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.ratingCategory.findMany({
      with: {
        ratings: {
          with: {
            rating: true,
          },
        },
      },
    });
  }),

  /**
   * Gets all rating types
   * @returns Array of rating types
   */
  getRatingTypes: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(ratingType);
  }),

  /**
   * Gets all rating categories
   * @returns Array of rating categories
   */
  getRatingCategories: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(ratingCategory);
  }),

  /**
   * Creates a new rating type
   * @param name Type name
   * @param displayName Display name
   * @param description Description
   * @returns Created rating type
   */
  createRatingType: protectedProcedure
    .input(ratingTypeSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const result = await ctx.db.insert(ratingType).values(data).returning();

      return result[0];
    }),

  /**
   * Updates a rating type
   * @param id Type ID
   * @param name Type name
   * @param displayName Display name
   * @param description Description
   * @returns Updated rating type
   */
  updateRatingType: protectedProcedure
    .input(ratingTypeSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const result = await ctx.db
        .update(ratingType)
        .set(data)
        .where(eq(ratingType.id, id!))
        .returning();

      return result[0];
    }),

  /**
   * Updates the type of a rating
   * @param id Rating ID
   * @param typeId Type ID
   * @returns Updated rating
   */
  updateRatingRatingType: protectedProcedure
    .input(z.object({ id: z.string(), typeId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { id, typeId } = input;

      // Check if the rating exists
      const existingRating = await ctx.db.query.rating.findFirst({
        where: eq(rating.id, id),
      });

      if (!existingRating) {
        throw new Error(`Rating with id ${id} not found`);
      }

      // Check if the rating type exists
      const existingRatingType = await ctx.db.query.ratingType.findFirst({
        where: eq(ratingType.id, typeId),
      });

      if (!existingRatingType) {
        throw new Error(`Rating type with id ${typeId} not found`);
      }

      toast.success("Тип рейтинга успешно обновлен");

      // Update the rating with the new rating type
      const result = await ctx.db
        .update(rating)
        .set({ ratingTypeId: typeId })
        .where(eq(rating.id, id))
        .returning();

      return result[0];
    }),

  /**
   * Deletes a rating type
   * @param id Type ID
   * @returns Deleted rating type
   */
  deleteRatingType: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .delete(ratingType)
        .where(eq(ratingType.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Creates a new rating category
   * @param name Category name
   * @param slug Category slug
   * @param description Category description
   * @returns Created rating category
   */
  createRatingCategory: protectedProcedure
    .input(ratingCategorySchema)
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .insert(ratingCategory)
        .values(input)
        .returning();

      return result[0];
    }),

  /**
   * Updates a rating category
   * @param id Category ID
   * @param name Optional category name
   * @param slug Optional category slug
   * @param description Optional category description
   * @returns Updated rating category
   */
  updateRatingCategory: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z
          .string()
          .transform((val) => val.trim())
          .optional(),
        slug: z
          .string()
          .transform((val) => val.trim())
          .optional(),
        description: z
          .string()
          .transform((val) => val.trim())
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      // Check if the new slug is unique
      if (data.slug) {
        const existingCategory = await ctx.db.query.ratingCategory.findFirst({
          where: eq(ratingCategory.slug, data.slug),
        });

        if (existingCategory && existingCategory.id !== id) {
          throw new Error("Slug must be unique");
        }
      }

      const result = await ctx.db
        .update(ratingCategory)
        .set(data)
        .where(eq(ratingCategory.id, id))
        .returning();

      toast.success("Категория успешно обновлена");

      return result[0];
    }),

  /**
   * Deletes a rating category
   * @param id Category ID
   * @returns Deleted rating category
   */
  deleteRatingCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .delete(ratingCategory)
        .where(eq(ratingCategory.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Updates the type of multiple ratings
   * @param ratingIds Array of rating IDs
   * @param typeId Type ID
   * @returns Success status
   */
  updateMultipleRatingTypes: protectedProcedure
    .input(
      z.object({
        ratingIds: z.array(z.string()),
        typeId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { ratingIds, typeId } = input;

      // Check if the rating type exists
      const existingRatingType = await ctx.db.query.ratingType.findFirst({
        where: eq(ratingType.id, typeId),
      });

      if (!existingRatingType) {
        throw new Error(`Rating type with id ${typeId} not found`);
      }

      // Update all selected ratings with the new rating type
      await ctx.db
        .update(rating)
        .set({ ratingTypeId: typeId })
        .where(inArray(rating.id, ratingIds));

      return { success: true };
    }),

  /**
   * Updates the position of a device in a rating
   * @param deviceId Device ID
   * @param position New position
   * @returns Updated rating position
   */
  updateDevicePosition: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        position: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { deviceId, position } = input;

      return await ctx.db.transaction(async (tx) => {
        // Find the current rating position for this device
        const currentPosition = await tx.query.ratingPosition.findFirst({
          where: eq(ratingPosition.deviceId, deviceId),
          with: {
            rating: true,
          },
        });

        if (!currentPosition) {
          throw new Error("Rating position not found");
        }

        // Find if there's a device at the target position
        const deviceAtPosition = await tx
          .select()
          .from(ratingPosition)
          .where(
            and(
              eq(ratingPosition.ratingId, currentPosition.ratingId),
              eq(ratingPosition.position, position),
              ne(ratingPosition.deviceId, currentPosition.deviceId)
            )
          )
          .limit(1);

        if (deviceAtPosition.length > 0) {
          // Move the other device to a temporary position
          await tx
            .update(ratingPosition)
            .set({ position: -1 })
            .where(eq(ratingPosition.id, deviceAtPosition[0]!.id));
        }

        // Update the current device's position
        await tx
          .update(ratingPosition)
          .set({ position })
          .where(eq(ratingPosition.id, currentPosition.id));

        if (deviceAtPosition.length > 0) {
          // Move the other device to the original position
          await tx
            .update(ratingPosition)
            .set({ position: currentPosition.position })
            .where(eq(ratingPosition.id, deviceAtPosition[0]!.id));
        }

        return currentPosition;
      });
    }),

  /**
   * Updates the name of a rating
   * @param id Rating ID
   * @param name New name
   * @returns Updated rating
   */
  updateRatingName: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .update(rating)
        .set({ name: input.name })
        .where(eq(rating.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Updates positions of multiple devices in a rating
   * @param ratingId Rating ID
   * @param updates Array of device position updates
   * @returns Array of updated rating positions
   */
  updateDevicePositions: protectedProcedure
    .input(
      z.object({
        ratingId: z.string(),
        updates: z.array(
          z.object({
            deviceId: z.string(),
            position: z.number().int().min(0),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { ratingId, updates } = input;

      return await ctx.db.transaction(async (tx) => {
        // 1. Get all current positions and validate devices exist
        const currentPositions = await tx
          .select()
          .from(ratingPosition)
          .where(eq(ratingPosition.ratingId, ratingId))
          .orderBy(asc(ratingPosition.position));

        // Validate all devices exist in the rating
        const positionsToUpdate = currentPositions.filter((pos) =>
          updates.some((update) => update.deviceId === pos.deviceId)
        );

        if (positionsToUpdate.length !== updates.length) {
          throw new Error("Some devices not found in this rating");
        }

        // 2. Calculate temporary positions that won't conflict
        const maxPosition = Math.max(
          ...currentPositions.map((p) => p.position),
          0
        );
        const TEMP_OFFSET = maxPosition + currentPositions.length + 1;

        // 3. Sort updates by target position
        const sortedUpdates = [...updates].sort(
          (a, b) => a.position - b.position
        );

        // 4. First move all affected devices to temporary positions
        await Promise.all(
          positionsToUpdate.map((pos, index) =>
            tx
              .update(ratingPosition)
              .set({ position: TEMP_OFFSET + index })
              .where(eq(ratingPosition.id, pos.id))
          )
        );

        // 5. Then move devices that need to swap positions
        for (const update of sortedUpdates) {
          const deviceToMove = positionsToUpdate.find(
            (pos) => pos.deviceId === update.deviceId
          );
          if (!deviceToMove) throw new Error("Position not found");

          // Find if there's a device at the target position
          const deviceAtPosition = currentPositions.find(
            (pos) =>
              pos.position === update.position &&
              pos.deviceId !== update.deviceId
          );

          if (deviceAtPosition) {
            // Get the original position of the device we're moving
            const originalPosition = currentPositions.find(
              (pos) => pos.deviceId === update.deviceId
            )?.position;

            if (originalPosition !== undefined) {
              // Move the other device to the original position
              await tx
                .update(ratingPosition)
                .set({ position: originalPosition })
                .where(eq(ratingPosition.id, deviceAtPosition.id));
            }
          }

          // Move the current device to its new position
          await tx
            .update(ratingPosition)
            .set({ position: update.position })
            .where(eq(ratingPosition.id, deviceToMove.id));
        }

        // 6. Get and return the final state
        return await tx
          .select()
          .from(ratingPosition)
          .where(eq(ratingPosition.ratingId, ratingId))
          .orderBy(asc(ratingPosition.position));
      });
    }),

  /**
   * Replaces a device in a rating
   * @param ratingId Rating ID
   * @param oldDeviceId ID of device to replace
   * @param newDeviceId ID of new device
   * @returns Updated device
   */
  replaceDeviceInRating: protectedProcedure
    .input(
      z.object({
        ratingId: z.string(),
        oldDeviceId: z.string(),
        newDeviceId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { ratingId, oldDeviceId, newDeviceId } = input;

      return await ctx.db.transaction(async (tx) => {
        // 1. Find the current position entry
        const currentPosition = await tx
          .select()
          .from(ratingPosition)
          .where(
            and(
              eq(ratingPosition.ratingId, ratingId),
              eq(ratingPosition.deviceId, oldDeviceId)
            )
          )
          .limit(1);

        if (currentPosition.length === 0) {
          throw new Error("Current device position not found");
        }

        // 2. Update the position entry to point to the new device
        await tx
          .update(ratingPosition)
          .set({
            deviceId: newDeviceId,
          })
          .where(eq(ratingPosition.id, currentPosition[0]!.id));

        // 3. Get the updated device with all relations
        const updatedDevice = await tx.query.device.findFirst({
          where: eq(device.id, newDeviceId),
          with: {
            links: true,
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

        return updatedDevice;
      });
    }),

  /**
   * Updates devices in a rating with positions
   * @param ratingId Rating ID
   * @param devices Record mapping positions to device IDs
   * @returns Updated rating
   */
  updateRatingDevices: protectedProcedure
    .input(
      z.object({
        ratingId: z.string(),
        devices: z.record(z.string(), z.string()).transform((obj) => 
          Object.fromEntries(Object.entries(obj).map(([k, v]) => [parseInt(k), v]))
        ), // position -> deviceId mapping
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check for duplicate positions
      const positions = Object.keys(input.devices).map((p) => parseInt(p));
      const uniquePositions = new Set(positions);
      if (positions.length !== uniquePositions.size) {
        throw new Error("Duplicate positions are not allowed");
      }

      return await ctx.db.transaction(async (tx) => {
        // 1. Delete all current positions
        await tx
          .delete(ratingPosition)
          .where(eq(ratingPosition.ratingId, input.ratingId));

        // 2. Delete all current device-rating connections
        await tx
          .delete(deviceToRating)
          .where(eq(deviceToRating.B, input.ratingId));

        // 3. Create new device-rating connections
        const deviceIds = Object.values(input.devices);
        for (const deviceId of deviceIds) {
          await tx
            .insert(deviceToRating)
            .values({
              A: deviceId,
              B: input.ratingId,
            })
            .onConflictDoNothing();
        }

        // 4. Create new positions sequentially
        const sortedEntries = Object.entries(input.devices)
          .map(([position, deviceId]) => ({
            position: parseInt(position),
            deviceId,
          }))
          .sort((a, b) => a.position - b.position);

        for (const { position, deviceId } of sortedEntries) {
          await tx.insert(ratingPosition).values({
            position,
            deviceId,
            ratingId: input.ratingId,
          });
        }

        // 5. Return updated rating with devices
        const updatedRating = await tx.query.rating.findFirst({
          where: eq(rating.id, input.ratingId),
          with: {
            devices: {
              with: {
                device: {
                  with: {
                    links: true,
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
                    ratingPositions: {
                      where: (ratingPosition, { eq }) =>
                        eq(ratingPosition.ratingId, input.ratingId),
                    },
                  },
                },
              },
            },
          },
        });

        return updatedRating;
      });
    }),

  /**
   * Fixes positions in a rating to be sequential
   * @param ratingId Rating ID
   * @returns Updated rating
   */
  fixRatingPositions: protectedProcedure
    .input(z.object({ ratingId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // 1. Get all current positions
        const currentPositions = await tx
          .select()
          .from(ratingPosition)
          .where(eq(ratingPosition.ratingId, input.ratingId))
          .orderBy(asc(ratingPosition.position));

        // 2. Update all positions to be sequential
        for (let i = 0; i < currentPositions.length; i++) {
          const pos = currentPositions[i]!;
          const newPosition = i + 1;

          await tx
            .update(ratingPosition)
            .set({ position: newPosition })
            .where(eq(ratingPosition.id, pos.id));
        }

        // 3. Return updated rating with devices
        const updatedRating = await tx.query.rating.findFirst({
          where: eq(rating.id, input.ratingId),
          with: {
            devices: {
              with: {
                device: {
                  with: {
                    links: true,
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
                    ratingPositions: {
                      where: (ratingPosition, { eq }) =>
                        eq(ratingPosition.ratingId, input.ratingId),
                    },
                  },
                },
              },
            },
          },
        });

        return updatedRating;
      });
    }),

  /**
   * Updates categories for a rating
   * @param ratingId Rating ID
   * @param categoryIds Array of category IDs
   * @returns Updated rating
   */
  updateRatingCategories: protectedProcedure
    .input(
      z.object({
        ratingId: z.string(),
        categoryIds: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { ratingId, categoryIds } = input;

      // Check if the rating exists
      const existingRating = await ctx.db.query.rating.findFirst({
        where: eq(rating.id, ratingId),
      });

      if (!existingRating) {
        throw new Error(`Rating with id ${ratingId} not found`);
      }

      // Check if all categories exist
      const existingCategories = await ctx.db
        .select()
        .from(ratingCategory)
        .where(inArray(ratingCategory.id, categoryIds));

      if (existingCategories.length !== categoryIds.length) {
        throw new Error("Some categories not found");
      }

      return await ctx.db.transaction(async (tx) => {
        // Delete existing category relationships
        await tx
          .delete(ratingToRatingCategory)
          .where(eq(ratingToRatingCategory.A, ratingId));

        // Insert new category relationships
        for (const categoryId of categoryIds) {
          await tx
            .insert(ratingToRatingCategory)
            .values({
              A: ratingId,
              B: categoryId,
            })
            .onConflictDoNothing();
        }

        // Return updated rating with categories
        const updatedRating = await tx.query.rating.findFirst({
          where: eq(rating.id, ratingId),
          with: {
            ratingCategories: {
              with: {
                ratingCategory: true,
              },
            },
          },
        });

        return updatedRating;
      });
    }),

  /**
   * Checks if there are any orphaned rating data without fetching details
   * @returns Boolean indicating if orphaned data exists
   */
  hasOrphanedRatingData: protectedProcedure.query(async ({ ctx }) => {
    // Find all existing rating IDs
    const existingRatings = await ctx.db.select({ id: rating.id }).from(rating);
    const existingRatingIds = existingRatings.map((r) => r.id);

    // Check for orphaned join table entries
    const orphanedJoinTableEntries = await ctx.db
      .select()
      .from(deviceToRating)
      .leftJoin(rating, eq(deviceToRating.B, rating.id))
      .where(sql`${rating.id} IS NULL`);

    // Check for orphaned rating positions
    const orphanedPositions =
      existingRatingIds.length > 0
        ? await ctx.db
            .select()
            .from(ratingPosition)
            .where(
              sql`${ratingPosition.ratingId} NOT IN (${sql.join(
                existingRatingIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            )
        : await ctx.db.select().from(ratingPosition);

    const totalOrphaned =
      orphanedJoinTableEntries.length + orphanedPositions.length;

    return {
      hasOrphanedData: totalOrphaned > 0,
      totalCount: totalOrphaned,
    };
  }),

  /**
   * Finds orphaned rating data - devices that are connected to ratings that no longer exist
   * @returns Object with orphaned device-rating connections and rating positions
   */
  findOrphanedRatingData: protectedProcedure.query(async ({ ctx }) => {
    // Find all existing rating IDs
    const existingRatings = await ctx.db
      .select({ id: rating.id, name: rating.name })
      .from(rating);
    const existingRatingIds = new Set(existingRatings.map((r) => r.id));

    // Find orphaned join table entries
    const orphanedJoinTableEntries = await ctx.db
      .select({
        deviceId: deviceToRating.A,
        ratingId: deviceToRating.B,
      })
      .from(deviceToRating)
      .leftJoin(rating, eq(deviceToRating.B, rating.id))
      .where(sql`${rating.id} IS NULL`);

    // Get device names for the orphaned connections
    const orphanedDeviceIds = [
      ...new Set(orphanedJoinTableEntries.map((entry) => entry.deviceId)),
    ];
    const devicesInfo =
      orphanedDeviceIds.length > 0
        ? await ctx.db
            .select({ id: device.id, name: device.name })
            .from(device)
            .where(inArray(device.id, orphanedDeviceIds))
        : [];
    const deviceIdToName = new Map(devicesInfo.map((d) => [d.id, d.name]));

    // Build orphaned connections array
    const orphanedConnections = orphanedJoinTableEntries.map((entry) => ({
      deviceId: entry.deviceId,
      deviceName: deviceIdToName.get(entry.deviceId) || null,
      ratingId: entry.ratingId,
      ratingName: `Deleted Rating (${entry.ratingId.slice(-8)})`,
    }));

    // Find orphaned rating positions by checking if ratingId exists in current ratings
    const orphanedPositions =
      existingRatingIds.size > 0
        ? await ctx.db
            .select({
              id: ratingPosition.id,
              deviceId: ratingPosition.deviceId,
              ratingId: ratingPosition.ratingId,
              position: ratingPosition.position,
              deviceName: device.name,
            })
            .from(ratingPosition)
            .leftJoin(device, eq(ratingPosition.deviceId, device.id))
            .where(
              sql`${ratingPosition.ratingId} NOT IN (${sql.join(
                Array.from(existingRatingIds).map((id) => sql`${id}`),
                sql`, `
              )})`
            )
        : await ctx.db
            .select({
              id: ratingPosition.id,
              deviceId: ratingPosition.deviceId,
              ratingId: ratingPosition.ratingId,
              position: ratingPosition.position,
              deviceName: device.name,
            })
            .from(ratingPosition)
            .leftJoin(device, eq(ratingPosition.deviceId, device.id));

    const transformedOrphanedPositions = orphanedPositions.map((pos) => ({
      id: pos.id,
      deviceId: pos.deviceId,
      ratingId: pos.ratingId,
      position: pos.position,
      device: {
        name: pos.deviceName,
      },
    }));

    return {
      orphanedConnections,
      orphanedPositions: transformedOrphanedPositions,
      totalOrphanedItems: orphanedConnections.length + orphanedPositions.length,
    };
  }),

  /**
   * Cleans up orphaned rating data
   * @returns Number of cleaned up items
   */
  cleanupOrphanedRatingData: protectedProcedure.mutation(async ({ ctx }) => {
    return await ctx.db.transaction(async (tx) => {
      let cleanedCount = 0;

      // Find all existing rating IDs
      const existingRatings = await tx.select({ id: rating.id }).from(rating);
      const existingRatingIds = existingRatings.map((r) => r.id);

      // Clean up orphaned entries in the join table
      if (existingRatingIds.length > 0) {
        const deletedJoinTableEntries = await tx
          .delete(deviceToRating)
          .where(
            sql`${deviceToRating.B} NOT IN (${sql.join(
              existingRatingIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
          .returning();
        cleanedCount += deletedJoinTableEntries.length;
      } else {
        // If no ratings exist, delete all join table entries
        const deletedJoinTableEntries = await tx
          .delete(deviceToRating)
          .returning();
        cleanedCount += deletedJoinTableEntries.length;
      }

      // Clean up orphaned rating positions
      const orphanedPositions =
        existingRatingIds.length > 0
          ? await tx
              .select({ id: ratingPosition.id })
              .from(ratingPosition)
              .where(
                sql`${ratingPosition.ratingId} NOT IN (${sql.join(
                  existingRatingIds.map((id) => sql`${id}`),
                  sql`, `
                )})`
              )
          : await tx.select({ id: ratingPosition.id }).from(ratingPosition);

      if (orphanedPositions.length > 0) {
        const orphanedPositionIds = orphanedPositions.map((p) => p.id);
        const deletedPositions = await tx
          .delete(ratingPosition)
          .where(inArray(ratingPosition.id, orphanedPositionIds))
          .returning();
        cleanedCount += deletedPositions.length;
      }

      return { cleanedCount };
    });
  }),
});
