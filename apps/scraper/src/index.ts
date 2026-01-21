import "dotenv/config";
import http from "http";
import { Effect } from "effect";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

import { config } from "./config";
import { log } from "./utils/logger";

import { LiveRuntime } from "./layers/live";
import { runSchedulerLoop } from "./services/scheduler";
import { getBulkJobManager } from "./services/bulk-job-manager-instance";

import { createApiRoutes } from "./routes/api";
import { createApiV2Routes } from "./routes/api-v2";
import { createDebugRoutes } from "./routes/debug";
import { createAuthRoutes, requireRole } from "./routes/auth";
import { createWidgetRoutes } from "./routes/widget";
import { createWidgetDebugRoutes } from "./routes/widget-debug";
import { createWidgetMappingsRoutes } from "./routes/widget-mappings";
import { createDeviceImagesRoutes } from "./routes/device-images";
import { createWsServer } from "./routes/ws-server";

export { getBulkJobManager };

// Paths that don't require authentication
const PUBLIC_PATH_PREFIXES = ["/widget/v1/", "/api/auth/"];

// Create Elysia app WITHOUT the node adapter - we'll own the http.Server ourselves
const app = new Elysia()
  .use(cors({ 
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://click-or-die.test",
      "https://click-or-die.ru",
      "https://www.click-or-die.ru",
    ],
    credentials: true,
  }))
  .onBeforeHandle(async ({ request, set }) => {
    const url = new URL(request.url);
    const isPublic = PUBLIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
    
    if (!isPublic) {
      // Check service token first (for service-to-service calls from catalogue)
      const serviceToken = process.env.SCRAPER_SERVICE_TOKEN;
      const authHeader = request.headers.get("authorization");
      const isServiceAuth = serviceToken && authHeader === `Bearer ${serviceToken}`;
      
      if (isServiceAuth) {
        return; // Service token valid, allow through
      }
      
      // Fall back to session auth for browser users
      try {
        await requireRole(request, "admin");
      } catch {
        set.status = 401;
        return { error: "Unauthorized" };
      }
    }
  })
  .use(createAuthRoutes())
  .use(createApiRoutes(getBulkJobManager()))
  .use(createApiV2Routes(getBulkJobManager()))
  .use(createWidgetRoutes())
  .use(createWidgetDebugRoutes())
  .use(createWidgetMappingsRoutes())
  .use(createDeviceImagesRoutes());

// Mount debug eval endpoint only in development
if (config.enableDebugEval) {
  app.use(createDebugRoutes());
  log.info("Debug", "Debug eval endpoint enabled at POST /debug/eval");
}

// Create our own http.Server and route requests to Elysia
const httpServer = http.createServer((req, res) => {
  // Elysia's fetch handler expects a Request object
  const protocol = "http";
  const url = new URL(req.url ?? "/", `${protocol}://${req.headers.host}`);
  
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const body = ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : req;

  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body: body as BodyInit | undefined,
    // @ts-expect-error - duplex is needed for streaming bodies
    duplex: "half",
  });

  app
    .handle(request)
    .then(async (response) => {
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    })
    .catch((err) => {
      // console used here - outside Effect runtime (http error handler)
      console.error("Request error:", err);
      res.writeHead(500);
      res.end("Internal Server Error");
    });
});

// Attach WebSocket server to our http.Server (no conflict with Elysia now)
createWsServer(httpServer, getBulkJobManager());

httpServer.listen(config.port, () => {
  log.banner();
  getBulkJobManager().resumeStuckJobs();
  
  LiveRuntime.runFork(
    Effect.gen(function* () {
      yield* Effect.logInfo("Scheduler loop started");
      yield* runSchedulerLoop;
    }),
  );
});
