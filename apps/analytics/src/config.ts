import { Effect, Config, Layer, Context } from "effect";

export interface AnalyticsConfig {
  readonly clickhouse: {
    readonly url: string;
    readonly database: string;
    readonly username: string;
    readonly password: string;
  };
  readonly ingestion: {
    readonly batchSize: number;
    readonly flushIntervalMs: number;
    readonly maxQueueSize: number;
  };
  readonly retention: {
    readonly rawEventsDays: number;
    readonly rollupYears: number;
  };
  readonly server: {
    readonly port: number;
    readonly allowedOrigins: string[];
    readonly statsApiKey: string | null;
  };
}

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  AnalyticsConfig
>() {}

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const clickhouseUrl = yield* Config.string("CLICKHOUSE_URL").pipe(
      Config.withDefault("http://localhost:8123")
    );
    const clickhouseDb = yield* Config.string("CLICKHOUSE_DATABASE").pipe(
      Config.withDefault("analytics")
    );
    const clickhouseUser = yield* Config.string("CLICKHOUSE_USERNAME").pipe(
      Config.withDefault("default")
    );
    const clickhousePass = yield* Config.string("CLICKHOUSE_PASSWORD").pipe(
      Config.withDefault("")
    );

    const batchSize = yield* Config.number("ANALYTICS_BATCH_SIZE").pipe(
      Config.withDefault(1000)
    );
    const flushIntervalMs = yield* Config.number("ANALYTICS_FLUSH_INTERVAL_MS").pipe(
      Config.withDefault(5000)
    );
    const maxQueueSize = yield* Config.number("ANALYTICS_MAX_QUEUE_SIZE").pipe(
      Config.withDefault(10000)
    );

    const rawEventsDays = yield* Config.number("ANALYTICS_RAW_RETENTION_DAYS").pipe(
      Config.withDefault(90)
    );
    const rollupYears = yield* Config.number("ANALYTICS_ROLLUP_RETENTION_YEARS").pipe(
      Config.withDefault(2)
    );

    const port = yield* Config.number("ANALYTICS_PORT").pipe(
      Config.withDefault(1489)
    );
    const allowedOriginsStr = yield* Config.string("ANALYTICS_ALLOWED_ORIGINS").pipe(
      Config.withDefault("*")
    );
    const allowedOrigins = allowedOriginsStr === "*" 
      ? ["*"] 
      : allowedOriginsStr.split(",").map(s => s.trim());

    const statsApiKeyRaw = yield* Config.string("ANALYTICS_STATS_API_KEY").pipe(
      Config.withDefault("")
    );
    const statsApiKey = statsApiKeyRaw.trim() || null;

    return {
      clickhouse: {
        url: clickhouseUrl,
        database: clickhouseDb,
        username: clickhouseUser,
        password: clickhousePass,
      },
      ingestion: {
        batchSize,
        flushIntervalMs,
        maxQueueSize,
      },
      retention: {
        rawEventsDays,
        rollupYears,
      },
      server: {
        port,
        allowedOrigins,
        statsApiKey,
      },
    };
  })
);
