import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { Effect } from "effect";
import { LiveRuntime } from "./layers/live";
import { ConfigService } from "./config";
import { ClickHouseServiceTag } from "./services/clickhouse";
import { createEventsRoutes } from "./routes/events";
import { createStatsRoutes } from "./routes/stats";

const log = {
  info: (ctx: string, msg: string, data?: unknown) =>
    console.log(`[${new Date().toISOString()}] [INFO] [${ctx}] ${msg}`, data ?? ""),
  error: (ctx: string, msg: string, data?: unknown) =>
    console.error(`[${new Date().toISOString()}] [ERROR] [${ctx}] ${msg}`, data ?? ""),
};

async function main() {
  log.info("Main", "Starting analytics service...");

  const config = await LiveRuntime.runPromise(ConfigService);

  const pingResult = await LiveRuntime.runPromise(
    Effect.gen(function* () {
      const clickhouse = yield* ClickHouseServiceTag;
      return yield* clickhouse.ping();
    }).pipe(
      Effect.catchAll((e) => {
        log.error("Main", "ClickHouse connection failed", e);
        return Effect.succeed(false);
      })
    )
  );

  if (!pingResult) {
    log.error("Main", "Cannot connect to ClickHouse, exiting");
    process.exit(1);
  }

  log.info("Main", "ClickHouse connection OK");

  const app = new Elysia({ adapter: node() })
    .use(
      cors({
        origin: config.server.allowedOrigins.includes("*")
          ? true
          : config.server.allowedOrigins,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "X-Source",
          "X-Site-Id",
          "User-Agent",
        ],
      })
    )
    .get("/health", () => ({ status: "ok", service: "analytics" }))
    .use(createEventsRoutes())
    .use(createStatsRoutes())
    .listen(config.server.port);

  log.info("Main", `Analytics service listening on port ${config.server.port}`);

  const shutdown = async () => {
    log.info("Main", "Shutting down...");
    await LiveRuntime.dispose();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  log.error("Main", "Fatal error", e);
  process.exit(1);
});
