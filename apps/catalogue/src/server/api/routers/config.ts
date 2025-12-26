import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "../trpc";
import { asc } from "drizzle-orm";
import { marketplace, config, category, tag, configToDevice, categoryToWidget, tagToWidget } from "../../db/schema";

export const configRouter = createTRPCRouter({
  /**
   * Gets all marketplace configurations
   * @returns Array of marketplaces
   */
  getAllMarketplaces: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(marketplace).orderBy(asc(marketplace.createdAt)).limit(40);
  }),

  /**
   * Creates a new marketplace
   * @param name Marketplace name
   * @param baseUrl Base URL of the marketplace
   * @param iconUrl URL to the marketplace icon
   * @returns Created marketplace
   */
  createMarketplace: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        baseUrl: z.string(),
        iconUrl: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.insert(marketplace).values({
        name: input.name,
        baseUrl: input.baseUrl,
        iconUrl: input.iconUrl,
      }).returning();
      return result[0];
    }),

  /**
   * Gets all configuration options
   * @returns Array of configurations
   */
  getAllConfigs: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.select().from(config).orderBy(asc(config.createdAt)).limit(40);
  }),

  /**
   * Creates a new configuration
   * @param name Configuration name
   * @param deviceId Optional device ID to associate the config with
   * @param ram Optional RAM value
   * @param capacitY Optional capacity value
   * @returns Created configuration
   */
  createConfig: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(3, "Конфигурация должна иметь от 3 до 10 символов")
          .max(10, "Конфигурация должна иметь от 3 до 10 символов")
          .refine((val) => val.trim().length >= 3 && val.trim().length <= 10, {
            message: "Конфигурация должна иметь от 3 до 10 символов",
          }),
        deviceId: z.string().optional(),
        ram: z.string().optional(),
        capacitY: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.insert(config).values({
        name: input.name.trim(),
        ram: input.ram?.trim() || undefined,
        capacity: input.capacitY?.trim() || undefined,
      }).returning();
      
      // Create relationship with device if deviceId is provided
      if (input.deviceId && result[0]) {
        await ctx.db.insert(configToDevice).values({
          A: result[0].id,
          B: input.deviceId,
        });
      }
      
      return result[0];
    }),

  /**
   * Creates a category for widgets
   * @param name Category name
   * @param id WordPress ID
   * @param widgetId Optional widget ID to associate with
   * @returns Created category
   */
  createCategory: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        id: z.number(),
        widgetId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.insert(category).values({
        name: input.name.trim(),
        wordpressId: input.id.toString(),
      }).returning();
      
      // Create relationship with widget if widgetId is provided
      if (input.widgetId && result[0]) {
        await ctx.db.insert(categoryToWidget).values({
          A: result[0].id,
          B: input.widgetId,
        });
      }
      
      return result[0];
    }),

  /**
   * Creates a tag for widgets
   * @param name Tag name
   * @param id WordPress ID
   * @param widgetId Optional widget ID to associate with
   * @returns Created tag
   */
  createTag: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        id: z.number(),
        widgetId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db.insert(tag).values({
        name: input.name,
        wordpressId: input.id.toString(),
      }).returning();
      
      // Create relationship with widget if widgetId is provided
      if (input.widgetId && result[0]) {
        await ctx.db.insert(tagToWidget).values({
          A: result[0].id,
          B: input.widgetId,
        });
      }
      
      return result[0];
    }),
});
