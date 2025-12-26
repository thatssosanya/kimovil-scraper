import { createTRPCRouter } from "@/src/server/api/trpc";
import { deviceRouter } from "./routers/device";
import { linkRouter } from "./routers/link";
import { ratingRouter } from "./routers/rating";
import { configRouter } from "./routers/config";
import { widgetRouter } from "./routers/widget";
import { scrapingRouter } from "./routers/scraping";
import { searchRouter } from "./routers/search";
import { utilsRouter } from "./routers/utils";
import { aliexpressRouter } from "./routers/aliexpress";
import { ratingsPageRouter } from "./routers/ratingsPage";
import { dashboardWidgetsRouter } from "./routers/dashboardWidgets";
import { scraperServiceRouter } from "./routers/scraper-service";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  device: deviceRouter, // Core device management
  link: linkRouter, // Link management
  rating: ratingRouter, // Rating system
  config: configRouter, // Configuration management
  widget: widgetRouter, // Widget system
  scraping: scrapingRouter, // Data scraping
  search: searchRouter, // Search functionality
  utils: utilsRouter, // Utility endpoints
  aliexpress: aliexpressRouter, // AliExpress items management
  ratingsPage: ratingsPageRouter, // Ratings page management
  dashboardWidgets: dashboardWidgetsRouter, // Dashboard widgets data
  scraperService: scraperServiceRouter, // Scraper backend API
});

export type AppRouter = typeof appRouter;
