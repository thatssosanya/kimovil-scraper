import "dotenv/config";
import http from "http";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { cors } from "@elysiajs/cors";

import { config } from "./config";
import { log } from "./utils/logger";

import { LiveRuntime } from "./layers/live";
import { BulkJobManager } from "./services/bulk-job";

import { createApiRoutes } from "./routes/api";
import { createWsServer } from "./routes/ws-server";

const bulkJobManager = new BulkJobManager(LiveRuntime);

// Create Elysia app WITHOUT the node adapter - we'll own the http.Server ourselves
const app = new Elysia()
  .use(cors({ origin: true, credentials: true }))
  .use(createApiRoutes(bulkJobManager));

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
createWsServer(httpServer, bulkJobManager);

httpServer.listen(config.port, () => {
  log.banner();
  bulkJobManager.resumeStuckJobs();
});
