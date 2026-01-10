import { Effect, Layer, Context } from "effect";
import { ClickHouseServiceTag } from "./clickhouse";
import { QueryError } from "../domain/errors";
import type {
  WidgetStats,
  PostStats,
  TimeseriesPoint,
  WidgetStatsParams,
  PostStatsParams,
  TimeseriesParams,
} from "../domain/events";

export interface EventQueryService {
  readonly getWidgetStats: (
    params: WidgetStatsParams
  ) => Effect.Effect<WidgetStats[], QueryError>;
  
  readonly getPostStats: (
    params: PostStatsParams
  ) => Effect.Effect<PostStats[], QueryError>;
  
  readonly getTimeseries: (
    params: TimeseriesParams
  ) => Effect.Effect<TimeseriesPoint[], QueryError>;
  
  readonly getTotalStats: (
    from: Date,
    to: Date
  ) => Effect.Effect<TotalStats, QueryError>;
}

export interface TotalStats {
  totalEvents: number;
  totalImpressions: number;
  totalClicks: number;
  uniqueVisitors: number;
  uniqueSessions: number;
}

export class EventQueryServiceTag extends Context.Tag("EventQueryService")<
  EventQueryServiceTag,
  EventQueryService
>() {}

const mapError = (e: unknown): QueryError =>
  new QueryError({
    message: e instanceof Error ? e.message : String(e),
    cause: e,
  });

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function escapeString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export const EventQueryServiceLive = Layer.effect(
  EventQueryServiceTag,
  Effect.gen(function* () {
    const clickhouse = yield* ClickHouseServiceTag;

    const getWidgetStats: EventQueryService["getWidgetStats"] = (params) =>
      Effect.gen(function* () {
        const conditions: string[] = [
          `date >= '${formatDate(params.from)}'`,
          `date <= '${formatDate(params.to)}'`,
        ];
        
        if (params.siteId) conditions.push(`site_id = '${escapeString(params.siteId)}'`);
        if (params.mappingId) conditions.push(`mapping_id = ${params.mappingId}`);
        if (params.postId) conditions.push(`post_id = ${params.postId}`);
        if (params.deviceSlug) conditions.push(`device_slug = '${escapeString(params.deviceSlug)}'`);

        const whereClause = conditions.join(" AND ");
        const limit = params.limit ?? 100;

        const sql = `
          SELECT
            mapping_id,
            post_id,
            device_slug,
            impressions,
            clicks,
            unique_visitors,
            unique_sessions,
            if(impressions > 0, clicks / impressions, 0) AS ctr
          FROM (
            SELECT
              mapping_id,
              post_id,
              device_slug,
              sumMerge(impressions) AS impressions,
              sumMerge(clicks) AS clicks,
              uniqMerge(unique_visitors) AS unique_visitors,
              uniqMerge(unique_sessions) AS unique_sessions
            FROM daily_widget_stats
            WHERE ${whereClause}
            GROUP BY mapping_id, post_id, device_slug
          )
          ORDER BY impressions DESC
          LIMIT ${limit}
        `;

        interface RawWidgetStats {
          mapping_id: string;
          post_id: string;
          device_slug: string;
          impressions: string;
          clicks: string;
          unique_visitors: string;
          unique_sessions: string;
          ctr: string;
        }

        const rows = yield* clickhouse.query<RawWidgetStats>(sql).pipe(
          Effect.mapError(mapError)
        );

        return rows.map((row) => ({
          mapping_id: parseInt(row.mapping_id, 10) || null,
          post_id: parseInt(row.post_id, 10) || null,
          device_slug: row.device_slug || null,
          impressions: parseInt(row.impressions, 10),
          clicks: parseInt(row.clicks, 10),
          unique_visitors: parseInt(row.unique_visitors, 10),
          unique_sessions: parseInt(row.unique_sessions, 10),
          ctr: parseFloat(row.ctr),
        }));
      });

    const getPostStats: EventQueryService["getPostStats"] = (params) =>
      Effect.gen(function* () {
        const conditions: string[] = [
          `date >= '${formatDate(params.from)}'`,
          `date <= '${formatDate(params.to)}'`,
        ];
        
        if (params.siteId) conditions.push(`site_id = '${escapeString(params.siteId)}'`);
        if (params.postId) conditions.push(`post_id = ${params.postId}`);

        const whereClause = conditions.join(" AND ");
        const limit = params.limit ?? 100;

        const sql = `
          SELECT
            post_id,
            sumMerge(widget_impressions) AS widget_impressions,
            sumMerge(widget_clicks) AS widget_clicks,
            uniqMerge(unique_visitors) AS unique_visitors,
            uniqMerge(unique_sessions) AS unique_sessions
          FROM daily_post_stats
          WHERE ${whereClause}
          GROUP BY post_id
          ORDER BY widget_impressions DESC
          LIMIT ${limit}
        `;

        interface RawPostStats {
          post_id: string;
          widget_impressions: string;
          widget_clicks: string;
          unique_visitors: string;
          unique_sessions: string;
        }

        const rows = yield* clickhouse.query<RawPostStats>(sql).pipe(
          Effect.mapError(mapError)
        );

        return rows.map((row) => ({
          post_id: parseInt(row.post_id, 10),
          widget_impressions: parseInt(row.widget_impressions, 10),
          widget_clicks: parseInt(row.widget_clicks, 10),
          unique_visitors: parseInt(row.unique_visitors, 10),
          unique_sessions: parseInt(row.unique_sessions, 10),
        }));
      });

    const getTimeseries: EventQueryService["getTimeseries"] = (params) =>
      Effect.gen(function* () {
        const intervalFunc = {
          fifteen_minutes: "toStartOfFifteenMinutes(occurred_at)",
          hour: "toStartOfHour(occurred_at)",
          day: "toDate(occurred_at)",
          week: "toStartOfWeek(occurred_at)",
          month: "toStartOfMonth(occurred_at)",
        }[params.interval];

        const conditions: string[] = [
          `occurred_at >= '${params.from.toISOString()}'`,
          `occurred_at <= '${params.to.toISOString()}'`,
        ];
        
        if (params.eventType) conditions.push(`event_type = '${escapeString(params.eventType)}'`);
        if (params.siteId) conditions.push(`site_id = '${escapeString(params.siteId)}'`);
        if (params.mappingId) conditions.push(`prop_mapping_id = ${params.mappingId}`);
        if (params.postId) conditions.push(`prop_post_id = ${params.postId}`);

        const whereClause = conditions.join(" AND ");

        const sql = `
          SELECT
            ${intervalFunc} AS bucket,
            count() AS count,
            uniq(visitor_id) AS unique_visitors
          FROM events
          WHERE ${whereClause}
          GROUP BY bucket
          ORDER BY bucket ASC
        `;

        interface RawTimeseriesPoint {
          bucket: string;
          count: string;
          unique_visitors: string;
        }

        const rows = yield* clickhouse.query<RawTimeseriesPoint>(sql).pipe(
          Effect.mapError(mapError)
        );

        return rows.map((row) => ({
          bucket: row.bucket,
          count: parseInt(row.count, 10),
          unique_visitors: parseInt(row.unique_visitors, 10),
        }));
      });

    const getTotalStats: EventQueryService["getTotalStats"] = (from, to) =>
      Effect.gen(function* () {
        const sql = `
          SELECT
            count() AS total_events,
            countIf(event_type = 'widget_impression') AS total_impressions,
            countIf(event_type = 'widget_click') AS total_clicks,
            uniq(visitor_id) AS unique_visitors,
            uniq(session_id) AS unique_sessions
          FROM events
          WHERE occurred_at >= '${from.toISOString()}'
            AND occurred_at <= '${to.toISOString()}'
        `;

        interface RawTotalStats {
          total_events: string;
          total_impressions: string;
          total_clicks: string;
          unique_visitors: string;
          unique_sessions: string;
        }

        const rows = yield* clickhouse.query<RawTotalStats>(sql).pipe(
          Effect.mapError(mapError)
        );

        const row = rows[0] ?? {
          total_events: "0",
          total_impressions: "0",
          total_clicks: "0",
          unique_visitors: "0",
          unique_sessions: "0",
        };

        return {
          totalEvents: parseInt(row.total_events, 10),
          totalImpressions: parseInt(row.total_impressions, 10),
          totalClicks: parseInt(row.total_clicks, 10),
          uniqueVisitors: parseInt(row.unique_visitors, 10),
          uniqueSessions: parseInt(row.unique_sessions, 10),
        };
      });

    return { getWidgetStats, getPostStats, getTimeseries, getTotalStats };
  })
);
