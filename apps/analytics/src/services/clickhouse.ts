import { Effect, Layer, Context, Scope } from "effect";
import { createClient, ClickHouseClient } from "@clickhouse/client";
import { ConfigService } from "../config";
import { ClickHouseError } from "../domain/errors";
import type { AnalyticsEvent } from "../domain/events";

export interface ClickHouseService {
  readonly insert: (events: AnalyticsEvent[]) => Effect.Effect<void, ClickHouseError>;
  readonly query: <T>(sql: string, params?: Record<string, unknown>) => Effect.Effect<T[], ClickHouseError>;
  readonly command: (sql: string) => Effect.Effect<void, ClickHouseError>;
  readonly ping: () => Effect.Effect<boolean, ClickHouseError>;
}

export class ClickHouseServiceTag extends Context.Tag("ClickHouseService")<
  ClickHouseServiceTag,
  ClickHouseService
>() {}

const mapError = (e: unknown): ClickHouseError =>
  new ClickHouseError({
    message: e instanceof Error ? e.message : String(e),
    cause: e,
  });

export const ClickHouseServiceLive = Layer.scoped(
  ClickHouseServiceTag,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    
    const client: ClickHouseClient = yield* Effect.acquireRelease(
      Effect.sync(() =>
        createClient({
          url: config.clickhouse.url,
          database: config.clickhouse.database,
          username: config.clickhouse.username,
          password: config.clickhouse.password,

        })
      ),
      (client) => Effect.promise(() => client.close())
    );

    const insert: ClickHouseService["insert"] = (events) =>
      Effect.tryPromise({
        try: async () => {
          if (events.length === 0) return;
          
          await client.insert({
            table: "events",
            values: events.map((e) => ({
              event_id: e.event_id,
              event_type: e.event_type,
              event_version: e.event_version,
              occurred_at: e.occurred_at.toISOString().replace("T", " ").replace("Z", ""),
              received_at: e.received_at.toISOString().replace("T", " ").replace("Z", ""),
              source: e.source,
              site_id: e.site_id,
              session_id: e.session_id,
              visitor_id: e.visitor_id,
              page_url: e.page_url,
              page_path: e.page_path,
              referrer_domain: e.referrer_domain,
              user_agent: e.user_agent,
              device_type: e.device_type,
              country_code: e.country_code,
              region: e.region,
              properties: e.properties,
              prop_mapping_id: e.prop_mapping_id,
              prop_post_id: e.prop_post_id,
              prop_device_slug: e.prop_device_slug,
            })),
            format: "JSONEachRow",
          });
        },
        catch: mapError,
      });

    const query: ClickHouseService["query"] = <T>(
      sql: string,
      params?: Record<string, unknown>
    ) =>
      Effect.tryPromise({
        try: async () => {
          const result = await client.query({
            query: sql,
            query_params: params,
            format: "JSONEachRow",
          });
          return (await result.json()) as T[];
        },
        catch: mapError,
      });

    const command: ClickHouseService["command"] = (sql: string) =>
      Effect.tryPromise({
        try: async () => {
          await client.command({ query: sql });
        },
        catch: mapError,
      });

    const ping: ClickHouseService["ping"] = () =>
      Effect.tryPromise({
        try: async () => {
          const result = await client.ping();
          return result.success;
        },
        catch: mapError,
      });

    return { insert, query, command, ping };
  })
);
