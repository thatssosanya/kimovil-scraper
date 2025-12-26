import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/src/server/api/trpc";
import { eq, and, or, inArray, sql, desc, asc, ne, isNotNull, like, lt, gt } from "drizzle-orm";
import { aliExpressItem } from "@/src/server/db/schema";

export const aliexpressRouter = createTRPCRouter({
  /**
   * Gets all AliExpress items with pagination, search, and sorting
   * @param limit Maximum number of items to return (default: 20)
   * @param cursor Pagination cursor
   * @param search Optional search string to filter items by name or URL
   * @param sortBy Field to sort by (default: commissionRate)
   * @param sortOrder Sort order (default: desc)
   * @returns Paginated list of AliExpress items with nextCursor
   */
  getAllItems: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
        search: z.string().optional(),
        sortBy: z
          .enum(["commissionRate", "name", "createdAt", "updatedAt"])
          .default("commissionRate"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, search, sortBy, sortOrder } = input;

      // Build where clause for search
      const whereConditions = [];
      
      if (search) {
        whereConditions.push(
          or(
            like(aliExpressItem.name, `%${search}%`),
            like(aliExpressItem.url, `%${search}%`)
          )
        );
      }
      
      whereConditions.push(isNotNull(aliExpressItem.name));
      
      // Handle cursor pagination with proper column-based comparison
      if (cursor) {
        // Get the cursor item to extract the sort column value
        const cursorItem = await ctx.db
          .select({
            id: aliExpressItem.id,
            commissionRate: aliExpressItem.commissionRate,
            name: aliExpressItem.name,
            createdAt: aliExpressItem.createdAt,
            updatedAt: aliExpressItem.updatedAt,
          })
          .from(aliExpressItem)
          .where(eq(aliExpressItem.id, cursor))
          .limit(1);

        if (cursorItem.length > 0 && cursorItem[0]) {
          const cursorValue = cursorItem[0];
          
          // Build cursor condition based on sort column
          let cursorCondition;
          if (sortBy === "commissionRate") {
            // Handle potentially null commissionRate values
            if (cursorValue.commissionRate === null) {
              cursorCondition = sortOrder === "desc"
                ? gt(aliExpressItem.id, cursor) // If cursor value is null, just use id comparison
                : gt(aliExpressItem.id, cursor);
            } else {
              cursorCondition = sortOrder === "desc"
                ? or(
                    lt(aliExpressItem.commissionRate, cursorValue.commissionRate),
                    and(eq(aliExpressItem.commissionRate, cursorValue.commissionRate), gt(aliExpressItem.id, cursor))
                  )
                : or(
                    gt(aliExpressItem.commissionRate, cursorValue.commissionRate),
                    and(eq(aliExpressItem.commissionRate, cursorValue.commissionRate), gt(aliExpressItem.id, cursor))
                  );
            }
          } else if (sortBy === "name") {
            // Handle potentially null name values
            if (cursorValue.name === null) {
              cursorCondition = gt(aliExpressItem.id, cursor);
            } else {
              cursorCondition = sortOrder === "desc"
                ? or(
                    lt(aliExpressItem.name, cursorValue.name),
                    and(eq(aliExpressItem.name, cursorValue.name), gt(aliExpressItem.id, cursor))
                  )
                : or(
                    gt(aliExpressItem.name, cursorValue.name),
                    and(eq(aliExpressItem.name, cursorValue.name), gt(aliExpressItem.id, cursor))
                  );
            }
          } else if (sortBy === "createdAt") {
            cursorCondition = sortOrder === "desc"
              ? or(
                  lt(aliExpressItem.createdAt, cursorValue.createdAt),
                  and(eq(aliExpressItem.createdAt, cursorValue.createdAt), gt(aliExpressItem.id, cursor))
                )
              : or(
                  gt(aliExpressItem.createdAt, cursorValue.createdAt),
                  and(eq(aliExpressItem.createdAt, cursorValue.createdAt), gt(aliExpressItem.id, cursor))
                );
          } else { // updatedAt
            cursorCondition = sortOrder === "desc"
              ? or(
                  lt(aliExpressItem.updatedAt, cursorValue.updatedAt),
                  and(eq(aliExpressItem.updatedAt, cursorValue.updatedAt), gt(aliExpressItem.id, cursor))
                )
              : or(
                  gt(aliExpressItem.updatedAt, cursorValue.updatedAt),
                  and(eq(aliExpressItem.updatedAt, cursorValue.updatedAt), gt(aliExpressItem.id, cursor))
                );
          }
          
          whereConditions.push(cursorCondition);
        }
      }

      const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

      // Build orderBy clause with id tie-breaker for consistent pagination
      const orderByColumn = sortBy === "commissionRate" ? aliExpressItem.commissionRate
        : sortBy === "name" ? aliExpressItem.name
        : sortBy === "createdAt" ? aliExpressItem.createdAt
        : aliExpressItem.updatedAt;

      const items = await ctx.db.select()
        .from(aliExpressItem)
        .where(whereClause)
        .orderBy(
          sortOrder === "desc" ? desc(orderByColumn) : asc(orderByColumn),
          asc(aliExpressItem.id) // Always use id as tie-breaker for consistent results
        )
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
   * Gets a single AliExpress item by ID
   * @param id Item ID
   * @returns AliExpress item or null
   */
  getItem: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db.select()
        .from(aliExpressItem)
        .where(eq(aliExpressItem.id, input.id))
        .limit(1);
      
      return result[0] || null;
    }),

  /**
   * Updates an AliExpress item
   * @param id Item ID
   * @param name Optional name update
   * @param commissionRate Optional commission rate update
   * @param imageUrl Optional image URL update
   * @returns Updated item
   */
  updateItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        commissionRate: z.string().optional(),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;

      const result = await ctx.db.update(aliExpressItem)
        .set({
          ...updateData,
        })
        .where(eq(aliExpressItem.id, id))
        .returning();

      return result[0];
    }),

  /**
   * Deletes AliExpress items by IDs
   * @param ids Array of item IDs to delete
   * @returns Number of deleted items
   */
  deleteItems: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.delete(aliExpressItem)
        .where(inArray(aliExpressItem.id, input.ids))
        .returning();

      return {
        success: true,
        count: result.length,
      };
    }),

  /**
   * Gets statistics about AliExpress items
   * @returns Statistics object
   */
  getStats: publicProcedure.query(async ({ ctx }) => {
    const [totalResult, withCommissionResult, withNamesResult] = await Promise.all([
      ctx.db.select({ count: sql<number>`count(*)` })
        .from(aliExpressItem)
        .where(isNotNull(aliExpressItem.name)),
      ctx.db.select({ count: sql<number>`count(*)` })
        .from(aliExpressItem)
        .where(and(
          isNotNull(aliExpressItem.commissionRate),
          ne(aliExpressItem.commissionRate, "0.00%"),
          ne(aliExpressItem.commissionRate, "0.00"),
          ne(aliExpressItem.commissionRate, "0")
        )),
      ctx.db.select({ count: sql<number>`count(*)` })
        .from(aliExpressItem)
        .where(isNotNull(aliExpressItem.name)),
    ]);

    const total = totalResult[0]?.count || 0;
    const withCommission = withCommissionResult[0]?.count || 0;
    const withNames = withNamesResult[0]?.count || 0;

    return {
      total,
      withCommission,
      withNames,
      withoutCommission: total - withCommission,
      withoutNames: total - withNames,
    };
  }),
});
