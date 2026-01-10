import { Schema } from "@effect/schema";

export const EventType = Schema.Literal(
  "widget_impression",
  "widget_click",
  "device_page_view",
  "custom"
);
export type EventType = Schema.Schema.Type<typeof EventType>;

export const DeviceType = Schema.Literal("desktop", "mobile", "tablet", "unknown");
export type DeviceType = Schema.Schema.Type<typeof DeviceType>;

export const WidgetImpressionProperties = Schema.Struct({
  mapping_id: Schema.Number,
  post_id: Schema.Number,
  widget_index: Schema.optional(Schema.Number),
  device_slug: Schema.optional(Schema.String),
  raw_model: Schema.optional(Schema.String),
  viewport_percent: Schema.optional(Schema.Number),
});

export const WidgetClickProperties = Schema.Struct({
  mapping_id: Schema.Number,
  post_id: Schema.Number,
  device_slug: Schema.optional(Schema.String),
  click_target: Schema.optional(Schema.String),
  destination_url: Schema.optional(Schema.String),
});

export const DevicePageViewProperties = Schema.Struct({
  device_id: Schema.optional(Schema.String),
  device_slug: Schema.String,
  brand: Schema.optional(Schema.String),
  view_source: Schema.optional(Schema.String),
  referrer_mapping_id: Schema.optional(Schema.Number),
});

export const CustomProperties = Schema.Record({ key: Schema.String, value: Schema.Unknown });

export const EventProperties = Schema.Union(
  WidgetImpressionProperties,
  WidgetClickProperties,
  DevicePageViewProperties,
  CustomProperties
);

export const RawEventInput = Schema.Struct({
  event_type: EventType,
  occurred_at: Schema.String,
  session_id: Schema.String,
  visitor_id: Schema.String,
  page_url: Schema.optional(Schema.String),
  page_path: Schema.optional(Schema.String),
  referrer_domain: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String),
  site_id: Schema.optional(Schema.NullOr(Schema.String)),
  properties: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});
export type RawEventInput = Schema.Schema.Type<typeof RawEventInput>;

export const RawEventsPayload = Schema.Struct({
  events: Schema.Array(RawEventInput),
});
export type RawEventsPayload = Schema.Schema.Type<typeof RawEventsPayload>;

export interface AnalyticsEvent {
  event_id: string;
  event_type: EventType;
  event_version: number;
  occurred_at: Date;
  received_at: Date;
  source: string;
  site_id: string;
  session_id: string;
  visitor_id: string;
  page_url: string;
  page_path: string;
  referrer_domain: string;
  user_agent: string;
  device_type: DeviceType;
  country_code: string;
  region: string;
  properties: string;
  prop_mapping_id: number | null;
  prop_post_id: number | null;
  prop_device_slug: string | null;
}

export interface IngestResult {
  accepted: number;
  rejected: number;
  errors?: string[];
}

export interface WidgetStats {
  mapping_id: number | null;
  post_id: number | null;
  device_slug: string | null;
  impressions: number;
  clicks: number;
  unique_visitors: number;
  unique_sessions: number;
  ctr: number;
}

export interface PostStats {
  post_id: number;
  widget_impressions: number;
  widget_clicks: number;
  unique_visitors: number;
  unique_sessions: number;
}

export interface TimeseriesPoint {
  bucket: string;
  count: number;
  unique_visitors: number;
}

export interface WidgetStatsParams {
  from: Date;
  to: Date;
  siteId?: string;
  mappingId?: number;
  postId?: number;
  deviceSlug?: string;
  limit?: number;
}

export interface PostStatsParams {
  from: Date;
  to: Date;
  siteId?: string;
  postId?: number;
  limit?: number;
}

export interface TimeseriesParams {
  from: Date;
  to: Date;
  interval: "fifteen_minutes" | "hour" | "day" | "week" | "month";
  eventType?: EventType;
  siteId?: string;
  mappingId?: number;
  postId?: number;
}
