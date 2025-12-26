import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/src/server/api/trpc";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { 
  ratingsPage, 
  ratingsGroup, 
  ratingsGroupPosition, 
  ratingsPagePosition 
} from "@/src/server/db/schema";
import { PUBLISH_STATUS } from "@/src/constants/publishStatus";

const ratingsGroupSchema = z.object({
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
  displayType: z.enum(["regular", "feature", "single"]).default("regular"),
  type: z
    .string()
    .nullable()
    .transform((val) => val?.trim() ?? null),
});

const ratingsPageSchema = z.object({
  id: z.string().optional(),
  name: z.string().transform((val) => val.trim()),
  slug: z
    .string()
    .transform((val) => val.trim().toLowerCase().replace(/\s+/g, "-")),
  description: z
    .string()
    .nullable()
    .transform((val) => val?.trim() ?? null),
  iconName: z
    .string()
    .nullable()
    .transform((val) => val?.trim() ?? null),
});

export const ratingsPageRouter = createTRPCRouter({
  /**
   * Gets all ratings pages with basic group and rating info for dashboard
   */
  getAllPages: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.ratingsPage.findMany({
      where: eq(ratingsPage.status, PUBLISH_STATUS.PUBLISHED),
      with: {
        groups: {
          with: {
            group: {
              with: {
                ratings: {
                  columns: {
                    id: true,
                    position: true,
                    shortName: true,
                    ratingId: true,
                    groupId: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                  with: {
                    rating: {
                      columns: {
                        id: true,
                        name: true,
                      },
                      with: {
                        ratingType: {
                          columns: {
                            id: true,
                            name: true,
                            displayName: true,
                          },
                        },
                      },
                    },
                  },
                  orderBy: (ratingsGroupPosition, { asc }) => [asc(ratingsGroupPosition.position)],
                },
              },
            },
          },
          orderBy: (ratingsPagePosition, { asc }) => [asc(ratingsPagePosition.position)],
        },
      },
      orderBy: [asc(ratingsPage.position), desc(ratingsPage.createdAt)],
    });
  }),

  /**
   * Gets all ratings pages (admin access - all statuses)
   */
  getAllPagesAdmin: protectedProcedure
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
      return await ctx.db.query.ratingsPage.findMany({
        where: input.status ? eq(ratingsPage.status, input.status) : undefined,
        with: {
          groups: {
            with: {
              group: {
                with: {
                  ratings: {
                    columns: {
                      id: true,
                      position: true,
                      shortName: true,
                      ratingId: true,
                      groupId: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                    with: {
                      rating: {
                        columns: {
                          id: true,
                          name: true,
                          status: true,
                        },
                        with: {
                          ratingType: {
                            columns: {
                              id: true,
                              name: true,
                              displayName: true,
                            },
                          },
                        },
                      },
                    },
                    orderBy: (ratingsGroupPosition, { asc }) => [asc(ratingsGroupPosition.position)],
                  },
                },
              },
            },
            orderBy: (ratingsPagePosition, { asc }) => [asc(ratingsPagePosition.position)],
          },
        },
        orderBy: [asc(ratingsPage.position), desc(ratingsPage.createdAt)],
      });
    }),

  /**
   * Gets a specific ratings page by ID with basic info
   */
  getPageById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.query.ratingsPage.findFirst({
        where: and(
          eq(ratingsPage.id, input.id),
          eq(ratingsPage.status, PUBLISH_STATUS.PUBLISHED)
        ),
        with: {
          groups: {
            with: {
              group: {
                with: {
                  ratings: {
                    columns: {
                      id: true,
                      position: true,
                      shortName: true,
                      ratingId: true,
                      groupId: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                    with: {
                      rating: {
                        columns: {
                          id: true,
                          name: true,
                        },
                        with: {
                          ratingType: {
                            columns: {
                              id: true,
                              name: true,
                              displayName: true,
                            },
                          },
                        },
                      },
                    },
                    orderBy: (ratingsGroupPosition, { asc }) => [asc(ratingsGroupPosition.position)],
                  },
                },
              },
            },
            orderBy: (ratingsPagePosition, { asc }) => [asc(ratingsPagePosition.position)],
          },
        },
      });
    }),

  /**
   * Gets a specific ratings page by ID (admin access - all statuses)
   */
  getPageByIdAdmin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.query.ratingsPage.findFirst({
        where: eq(ratingsPage.id, input.id),
        with: {
          groups: {
            with: {
              group: {
                with: {
                  ratings: {
                    columns: {
                      id: true,
                      position: true,
                      shortName: true,
                      ratingId: true,
                      groupId: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                    with: {
                      rating: {
                        columns: {
                          id: true,
                          name: true,
                          status: true,
                        },
                        with: {
                          ratingType: {
                            columns: {
                              id: true,
                              name: true,
                              displayName: true,
                            },
                          },
                        },
                      },
                    },
                    orderBy: (ratingsGroupPosition, { asc }) => [asc(ratingsGroupPosition.position)],
                  },
                },
              },
            },
            orderBy: (ratingsPagePosition, { asc }) => [asc(ratingsPagePosition.position)],
          },
        },
      });
    }),

  /**
   * Gets a specific ratings page by slug
   */
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.query.ratingsPage.findFirst({
        where: and(
          eq(ratingsPage.slug, input.slug),
          eq(ratingsPage.status, PUBLISH_STATUS.PUBLISHED)
        ),
        with: {
          groups: {
            with: {
              group: {
                with: {
                  ratings: {
                    columns: {
                      id: true,
                      position: true,
                      shortName: true,
                      ratingId: true,
                      groupId: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                    with: {
                      rating: {
                        columns: {
                          id: true,
                          name: true,
                        },
                        with: {
                          ratingType: {
                            columns: {
                              id: true,
                              name: true,
                              displayName: true,
                            },
                          },
                        },
                      },
                    },
                    orderBy: (ratingsGroupPosition, { asc }) => [asc(ratingsGroupPosition.position)],
                  },
                },
              },
            },
            orderBy: (ratingsPagePosition, { asc }) => [asc(ratingsPagePosition.position)],
          },
        },
      });
    }),

  /**
   * Creates a new ratings page
   */
  createPage: protectedProcedure
    .input(
      ratingsPageSchema.extend({
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

      const result = await ctx.db.insert(ratingsPage)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description,
          iconName: input.iconName,
          status: input.status || PUBLISH_STATUS.DRAFT,
          publishedAt,
        })
        .returning();

      return result[0];
    }),

  /**
   * Updates ratings page status
   */
  updatePageStatus: protectedProcedure
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

      const result = await ctx.db.update(ratingsPage)
        .set({
          status: input.status,
          publishedAt,
        })
        .where(eq(ratingsPage.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Updates a ratings page
   */
  updatePage: protectedProcedure
    .input(ratingsPageSchema.extend({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      
      const result = await ctx.db.update(ratingsPage)
        .set(updateData)
        .where(eq(ratingsPage.id, id))
        .returning();

      return result[0];
    }),

  /**
   * Deletes a ratings page
   */
  deletePage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.delete(ratingsPage)
        .where(eq(ratingsPage.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Creates a new ratings group
   */
  createGroup: protectedProcedure
    .input(ratingsGroupSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.insert(ratingsGroup)
        .values({
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          displayType: input.displayType,
          type: input.type,
        })
        .returning();

      return result[0];
    }),

  /**
   * Updates a ratings group
   */
  updateGroup: protectedProcedure
    .input(ratingsGroupSchema.extend({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      
      const result = await ctx.db.update(ratingsGroup)
        .set(updateData)
        .where(eq(ratingsGroup.id, id))
        .returning();

      return result[0];
    }),

  /**
   * Gets a ratings group by ID
   */
  getGroupById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.query.ratingsGroup.findFirst({
        where: eq(ratingsGroup.id, input.id),
        with: {
          ratings: {
            with: {
              rating: {
                with: {
                  ratingType: true,
                },
              },
            },
          },
        },
      });
    }),

  /**
   * Deletes a ratings group
   */
  deleteGroup: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.delete(ratingsGroup)
        .where(eq(ratingsGroup.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Gets all ratings groups with basic rating info for dashboard
   */
  getAllGroups: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.ratingsGroup.findMany({
      with: {
        ratings: {
          columns: {
            id: true,
            position: true,
            shortName: true,
            ratingId: true,
            groupId: true,
            createdAt: true,
            updatedAt: true,
          },
          with: {
            rating: {
              columns: {
                id: true,
                name: true,
              },
              with: {
                ratingType: {
                  columns: {
                    id: true,
                    name: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: (ratingsGroupPosition, { asc }) => [asc(ratingsGroupPosition.position)],
        },
      },
      orderBy: [desc(ratingsGroup.createdAt)],
    });
  }),

  /**
   * Adds a group to a page at a specific position
   */
  addGroupToPage: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        groupId: z.string(),
        position: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // First, shift existing positions to make room
        await tx.update(ratingsPagePosition)
          .set({
            position: sql`${ratingsPagePosition.position} + 1`,
          })
          .where(and(
            eq(ratingsPagePosition.pageId, input.pageId),
            sql`${ratingsPagePosition.position} >= ${input.position}`
          ));

        // Then insert the new group
        const result = await tx.insert(ratingsPagePosition)
          .values({
            pageId: input.pageId,
            groupId: input.groupId,
            position: input.position,
          })
          .returning();

        return result[0];
      });
    }),

  /**
   * Removes a group from a page
   */
  removeGroupFromPage: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        groupId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // Get the position of the group being removed
        const removedPosition = await tx.select({ position: ratingsPagePosition.position })
          .from(ratingsPagePosition)
          .where(and(
            eq(ratingsPagePosition.pageId, input.pageId),
            eq(ratingsPagePosition.groupId, input.groupId)
          ))
          .limit(1);

        if (removedPosition.length === 0) return null;

        const position = removedPosition[0]!.position;

        // Delete the position record
        await tx.delete(ratingsPagePosition)
          .where(and(
            eq(ratingsPagePosition.pageId, input.pageId),
            eq(ratingsPagePosition.groupId, input.groupId)
          ));

        // Shift remaining positions down
        await tx.update(ratingsPagePosition)
          .set({
            position: sql`${ratingsPagePosition.position} - 1`,
          })
          .where(and(
            eq(ratingsPagePosition.pageId, input.pageId),
            sql`${ratingsPagePosition.position} > ${position}`
          ));

        return { success: true };
      });
    }),

  /**
   * Updates group positions within a page
   */
  updateGroupPositions: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        positions: z.array(
          z.object({
            groupId: z.string(),
            position: z.number().int().min(1),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { pageId, positions } = input;

      return await ctx.db.transaction(async (tx) => {
        // 1. Get all current positions in this page
        const currentPositions = await tx.select()
          .from(ratingsPagePosition)
          .where(eq(ratingsPagePosition.pageId, pageId))
          .orderBy(asc(ratingsPagePosition.position));

        // 2. Validate all groups exist in the page
        const groupIdsToUpdate = positions.map((p) => p.groupId);
        const existingGroupIds = currentPositions.map((p) => p.groupId);

        for (const groupId of groupIdsToUpdate) {
          if (!existingGroupIds.includes(groupId)) {
            throw new Error(`Group ${groupId} not found in page ${pageId}`);
          }
        }

        // 3. Calculate a safe temporary offset to avoid any conflicts
        const maxPosition = Math.max(
          ...currentPositions.map((p) => p.position),
          0
        );
        const TEMP_OFFSET = maxPosition + 1000;

        // 4. Move ALL groups in this page to temporary positions first
        for (let i = 0; i < currentPositions.length; i++) {
          await tx.update(ratingsPagePosition)
            .set({ position: TEMP_OFFSET + i })
            .where(eq(ratingsPagePosition.id, currentPositions[i]!.id));
        }

        // 5. Now safely update to final positions
        for (const update of positions) {
          const groupPosition = currentPositions.find(
            (pos) => pos.groupId === update.groupId
          );

          if (groupPosition) {
            await tx.update(ratingsPagePosition)
              .set({ position: update.position })
              .where(eq(ratingsPagePosition.id, groupPosition.id));
          }
        }

        // 6. Get and return the final state
        return await tx.select()
          .from(ratingsPagePosition)
          .where(eq(ratingsPagePosition.pageId, pageId))
          .orderBy(asc(ratingsPagePosition.position));
      });
    }),

  /**
   * Adds a rating to a group at a specific position
   */
  addRatingToGroup: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        ratingId: z.string(),
        position: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // First, shift existing positions to make room
        await tx.update(ratingsGroupPosition)
          .set({
            position: sql`${ratingsGroupPosition.position} + 1`,
          })
          .where(and(
            eq(ratingsGroupPosition.groupId, input.groupId),
            sql`${ratingsGroupPosition.position} >= ${input.position}`
          ));

        // Then insert the new rating
        const result = await tx.insert(ratingsGroupPosition)
          .values({
            groupId: input.groupId,
            ratingId: input.ratingId,
            position: input.position,
          })
          .returning();

        return result[0];
      });
    }),

  /**
   * Removes a rating from a group
   */
  removeRatingFromGroup: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        ratingId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // Get the position of the rating being removed
        const removedPosition = await tx.select({ position: ratingsGroupPosition.position })
          .from(ratingsGroupPosition)
          .where(and(
            eq(ratingsGroupPosition.groupId, input.groupId),
            eq(ratingsGroupPosition.ratingId, input.ratingId)
          ))
          .limit(1);

        if (removedPosition.length === 0) return null;

        const position = removedPosition[0]!.position;

        // Delete the position record
        await tx.delete(ratingsGroupPosition)
          .where(and(
            eq(ratingsGroupPosition.groupId, input.groupId),
            eq(ratingsGroupPosition.ratingId, input.ratingId)
          ));

        // Shift remaining positions down
        await tx.update(ratingsGroupPosition)
          .set({
            position: sql`${ratingsGroupPosition.position} - 1`,
          })
          .where(and(
            eq(ratingsGroupPosition.groupId, input.groupId),
            sql`${ratingsGroupPosition.position} > ${position}`
          ));

        return { success: true };
      });
    }),

  /**
   * Updates rating positions within a group
   */
  updateRatingPositions: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        positions: z.array(
          z.object({
            ratingId: z.string(),
            position: z.number().int().min(1),
            shortName: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { groupId, positions } = input;

      return await ctx.db.transaction(async (tx) => {
        // 1. Get all current positions in this group
        const currentPositions = await tx.select()
          .from(ratingsGroupPosition)
          .where(eq(ratingsGroupPosition.groupId, groupId))
          .orderBy(asc(ratingsGroupPosition.position));

        // 2. Validate all ratings exist in the group
        const ratingIdsToUpdate = positions.map((p) => p.ratingId);
        const existingRatingIds = currentPositions.map((p) => p.ratingId);

        for (const ratingId of ratingIdsToUpdate) {
          if (!existingRatingIds.includes(ratingId)) {
            throw new Error(
              `Rating ${ratingId} not found in group ${groupId}`
            );
          }
        }

        // 3. Calculate a safe temporary offset to avoid any conflicts
        const maxPosition = Math.max(
          ...currentPositions.map((p) => p.position),
          0
        );
        const TEMP_OFFSET = maxPosition + 1000;

        // 4. Move ALL ratings in this group to temporary positions first
        for (let i = 0; i < currentPositions.length; i++) {
          await tx.update(ratingsGroupPosition)
            .set({ position: TEMP_OFFSET + i })
            .where(eq(ratingsGroupPosition.id, currentPositions[i]!.id));
        }

        // 5. Now safely update to final positions
        for (const update of positions) {
          const ratingPosition = currentPositions.find(
            (pos) => pos.ratingId === update.ratingId
          );

          if (ratingPosition) {
            await tx.update(ratingsGroupPosition)
              .set({
                position: update.position,
                shortName: update.shortName,
              })
              .where(eq(ratingsGroupPosition.id, ratingPosition.id));
          }
        }

        // 6. Get and return the final state
        return await tx.select()
          .from(ratingsGroupPosition)
          .where(eq(ratingsGroupPosition.groupId, groupId))
          .orderBy(asc(ratingsGroupPosition.position));
      });
    }),

  /**
   * Updates shortName for a rating in a group
   */
  updateRatingShortName: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        ratingId: z.string(),
        shortName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.update(ratingsGroupPosition)
        .set({
          shortName: input.shortName,
        })
        .where(and(
          eq(ratingsGroupPosition.groupId, input.groupId),
          eq(ratingsGroupPosition.ratingId, input.ratingId)
        ))
        .returning();

      return result[0];
    }),

  /**
   * Updates page positions for reordering
   */
  updatePagePositions: protectedProcedure
    .input(
      z.object({
        positions: z.array(
          z.object({
            pageId: z.string(),
            position: z.number().int().min(1),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { positions } = input;

      return await ctx.db.transaction(async (tx) => {
        // 1. Get all current pages
        const currentPages = await tx.select()
          .from(ratingsPage)
          .orderBy(asc(ratingsPage.position), desc(ratingsPage.createdAt));

        // 2. Validate all pages exist
        const pageIdsToUpdate = positions.map((p) => p.pageId);
        const existingPageIds = currentPages.map((p) => p.id);

        for (const pageId of pageIdsToUpdate) {
          if (!existingPageIds.includes(pageId)) {
            throw new Error(`Page ${pageId} not found`);
          }
        }

        // 3. Calculate a safe temporary offset to avoid any conflicts
        const maxPosition = Math.max(
          ...currentPages.map((p) => p.position ?? 0).filter((p) => p > 0),
          0
        );
        const TEMP_OFFSET = maxPosition + 1000;

        // 4. Move ALL pages to temporary positions first
        for (let i = 0; i < currentPages.length; i++) {
          await tx.update(ratingsPage)
            .set({ position: TEMP_OFFSET + i })
            .where(eq(ratingsPage.id, currentPages[i]!.id));
        }

        // 5. Now safely update to final positions
        for (const update of positions) {
          await tx.update(ratingsPage)
            .set({ position: update.position })
            .where(eq(ratingsPage.id, update.pageId));
        }

        // 6. Get and return the final state
        return await tx.select()
          .from(ratingsPage)
          .orderBy(asc(ratingsPage.position), desc(ratingsPage.createdAt));
      });
    }),
});
