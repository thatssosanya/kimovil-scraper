import "dotenv/config";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { cors } from "@elysiajs/cors";

import { config } from "./config";
import { log } from "./utils/logger";

// Core infrastructure
import { LiveLayer } from "./layers/live";
import { BulkJobManager } from "./services/bulk-job";

// Routes
import { createApiRoutes } from "./routes/api";
import { createWsRoute } from "./routes/ws";

// Initialize runtime state
const bulkJobManager = new BulkJobManager(LiveLayer);

// Create server
const app = new Elysia({ adapter: node() })
  .use(cors())
  .use(createApiRoutes(LiveLayer, bulkJobManager))
  .use(createWsRoute(LiveLayer, bulkJobManager))
  .listen(config.port);

// Startup
log.banner();
bulkJobManager.resumeStuckJobs();
