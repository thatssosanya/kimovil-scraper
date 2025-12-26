import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/src/server/api/trpc";
import { eq, asc } from "drizzle-orm";
import { 
  widget, 
  device,
  categoryToWidget,
  tagToWidget
} from "@/src/server/db/schema";

export const widgetRouter = createTRPCRouter({
  /**
   * Gets all widgets with related data
   * @returns Array of widgets with devices, categories, and tags
   */
  getAllWidgets: publicProcedure.query(async ({ ctx }) => {
    const widgets = await ctx.db.query.widget.findMany({
      limit: 40,
      orderBy: [asc(widget.createdAt)],
      with: {
        devices: {
          with: {
            configs: {
              with: {
                config: true,
              },
            },
            links: {
              with: {
                marketplace: true,
                config: true,
              },
            },
            ratingPositions: true,
          },
        },
        categories: {
          with: {
            category: true,
          },
        },
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    return widgets;
  }),

  /**
   * Creates a new widget
   * @param name Widget name
   * @returns Created widget
   */
  createWidget: protectedProcedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [createdWidget] = await ctx.db.insert(widget).values({
        name: input.name,
      }).returning();

      return createdWidget;
    }),

  /**
   * Associates a category with a widget
   * @param widgetId Widget ID
   * @param categoryId Category ID
   * @returns Updated widget
   */
  attachCategoryToWidget: protectedProcedure
    .input(z.object({ widgetId: z.string(), categoryId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Insert the relationship into the junction table
      await ctx.db.insert(categoryToWidget).values({
        A: input.categoryId, // categoryId
        B: input.widgetId,   // widgetId
      });

      // Return the updated widget with its categories
      const updatedWidget = await ctx.db.query.widget.findFirst({
        where: eq(widget.id, input.widgetId),
        with: {
          categories: {
            with: {
              category: true,
            },
          },
        },
      });

      return updatedWidget;
    }),

  /**
   * Associates a tag with a widget
   * @param widgetId Widget ID
   * @param tagId Tag ID
   * @returns Updated widget
   */
  attachTagToWidget: protectedProcedure
    .input(z.object({ widgetId: z.string(), tagId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Insert the relationship into the junction table
      await ctx.db.insert(tagToWidget).values({
        A: input.tagId,   // tagId
        B: input.widgetId, // widgetId
      });

      // Return the updated widget with its tags
      const updatedWidget = await ctx.db.query.widget.findFirst({
        where: eq(widget.id, input.widgetId),
        with: {
          tags: {
            with: {
              tag: true,
            },
          },
        },
      });

      return updatedWidget;
    }),

  /**
   * Gets all devices for a specific widget
   * @param id Widget ID
   * @returns Array of devices with configurations
   */
  getWidgetDevices: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const devices = await ctx.db.query.device.findMany({
        where: eq(device.widgetId, input.id),
        with: {
          configs: {
            with: {
              config: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return devices;
    }),

  /**
   * Associates a device with a widget
   * @param deviceId Device ID
   * @param widgetId Widget ID
   * @returns Updated device
   */
  attachDeviceToWidget: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        widgetId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if device exists
      const existingDevice = await ctx.db.query.device.findFirst({
        where: eq(device.id, input.deviceId),
      });

      if (!existingDevice) {
        throw new Error("Device not found");
      }

      // Check if widget exists
      const existingWidget = await ctx.db.query.widget.findFirst({
        where: eq(widget.id, input.widgetId),
      });

      if (!existingWidget) {
        throw new Error("Widget not found");
      }

      // Update the device to associate it with the widget
      const [updatedDevice] = await ctx.db
        .update(device)
        .set({
          widgetId: input.widgetId,
        })
        .where(eq(device.id, input.deviceId))
        .returning();

      return updatedDevice;
    }),
});
