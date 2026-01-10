import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { Effect } from "effect";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { LiveRuntime } from "./layers/live";
import { ConfigService } from "./config";
import { ClickHouseServiceTag } from "./services/clickhouse";
import { createEventsRoutes } from "./routes/events";
import { createStatsRoutes } from "./routes/stats";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
const minifiedPath = join(__dirname, "../public/analytics.min.js");
const analyticsJs = isProd && existsSync(minifiedPath)
  ? readFileSync(minifiedPath, "utf-8")
  : readFileSync(join(__dirname, "../public/analytics.js"), "utf-8");

const main = Effect.gen(function* () {
  yield* Effect.logInfo("Starting analytics service...");

  const config = yield* ConfigService;

  const pingResult = yield* Effect.gen(function* () {
    const clickhouse = yield* ClickHouseServiceTag;
    return yield* clickhouse.ping();
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError("ClickHouse connection failed").pipe(
          Effect.annotateLogs({ error })
        );
        return false;
      })
    )
  );

  if (!pingResult) {
    yield* Effect.logError("Cannot connect to ClickHouse, exiting");
    return yield* Effect.die("ClickHouse unavailable");
  }

  yield* Effect.logInfo("ClickHouse connection OK");

  const app = new Elysia({ adapter: node() })
    .use(
      cors({
        origin: config.server.allowedOrigins.includes("*")
          ? true
          : config.server.allowedOrigins,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "X-Source", "X-Site-Id", "User-Agent"],
      })
    )
    .get("/health", () => ({ status: "ok", service: "analytics" }))
    .get("/analytics.js", ({ set }) => {
      set.headers["Content-Type"] = "application/javascript";
      set.headers["Cache-Control"] = "public, max-age=3600";
      return analyticsJs;
    })
    .use(createEventsRoutes())
    .use(createStatsRoutes())
    .listen(config.server.port);

  yield* Effect.logInfo("Analytics service listening").pipe(
    Effect.annotateLogs({ port: config.server.port })
  );

  // Handle shutdown signals
  const shutdown = async () => {
    await LiveRuntime.runPromise(
      Effect.logInfo("Shutting down analytics service...")
    );
    await LiveRuntime.dispose();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});

LiveRuntime.runPromise(main).catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
