import { Effect, Layer, Context } from "effect";
import { Schema } from "@effect/schema";
import { ulid } from "ulid";
import { EventWriterServiceTag } from "./event-writer";
import { ValidationError, QueueFullError } from "../domain/errors";
import {
  type RawEventInput,
  type AnalyticsEvent,
  type IngestResult,
  type DeviceType,
  RawEventsPayload,
} from "../domain/events";

export interface EventIngestionService {
  readonly ingest: (
    rawEvents: unknown,
    context: IngestContext
  ) => Effect.Effect<IngestResult, ValidationError | QueueFullError>;
}

export interface IngestContext {
  userAgent: string;
  ip?: string;
  source?: string;
  siteId?: string;
}

export class EventIngestionServiceTag extends Context.Tag("EventIngestionService")<
  EventIngestionServiceTag,
  EventIngestionService
>() {}

function parseDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    return "mobile";
  }
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return "tablet";
  }
  if (/windows|macintosh|linux/i.test(ua)) {
    return "desktop";
  }
  return "unknown";
}

function extractMappingId(properties: Record<string, unknown>): number | null {
  const val = properties.mapping_id;
  return typeof val === "number" ? val : null;
}

function extractPostId(properties: Record<string, unknown>): number | null {
  const val = properties.post_id;
  return typeof val === "number" ? val : null;
}

function extractDeviceSlug(properties: Record<string, unknown>): string | null {
  const val = properties.device_slug;
  return typeof val === "string" ? val : null;
}

function extractRawModel(properties: Record<string, unknown>): string | null {
  const val = properties.raw_model;
  return typeof val === "string" ? val : null;
}

class TransformError {
  readonly _tag = "TransformError";
  constructor(
    readonly index: number,
    readonly message: string
  ) {}
}

const transformEvent = (
  raw: RawEventInput,
  context: IngestContext,
  index: number
): Effect.Effect<AnalyticsEvent, TransformError> =>
  Effect.try({
    try: () => {
      const now = new Date();
      const occurredAt = new Date(raw.occurred_at);

      if (isNaN(occurredAt.getTime())) {
        throw new Error(`Invalid occurred_at: ${raw.occurred_at}`);
      }

      const pageUrl = raw.page_url ?? "";
      const pagePath = raw.page_path ?? (pageUrl ? new URL(pageUrl).pathname : "");

      return {
        event_id: ulid(),
        event_type: raw.event_type,
        event_version: 1,
        occurred_at: occurredAt,
        received_at: now,
        source: raw.source ?? context.source ?? "wordpress",
        site_id: raw.site_id ?? context.siteId ?? "default",
        session_id: raw.session_id,
        visitor_id: raw.visitor_id,
        page_url: pageUrl,
        page_path: pagePath,
        referrer_domain: raw.referrer_domain ?? "",
        user_agent: context.userAgent,
        device_type: parseDeviceType(context.userAgent),
        country_code: "",
        region: "",
        properties: JSON.stringify(raw.properties),
        prop_mapping_id: extractMappingId(raw.properties),
        prop_post_id: extractPostId(raw.properties),
        prop_device_slug: extractDeviceSlug(raw.properties),
        prop_raw_model: extractRawModel(raw.properties),
      };
    },
    catch: (e) =>
      new TransformError(index, e instanceof Error ? e.message : String(e)),
  });

export const EventIngestionServiceLive = Layer.effect(
  EventIngestionServiceTag,
  Effect.gen(function* () {
    const writer = yield* EventWriterServiceTag;

    const ingest: EventIngestionService["ingest"] = (rawPayload, context) =>
      Effect.gen(function* () {
        const parseResult = Schema.decodeUnknownEither(RawEventsPayload)(rawPayload);
        
        if (parseResult._tag === "Left") {
          const errors = parseResult.left.message.split("\n").slice(0, 5);
          return yield* Effect.fail(
            new ValidationError({
              message: "Invalid event payload",
              errors,
            })
          );
        }

        const payload = parseResult.right;

        const transformResults = yield* Effect.forEach(
          payload.events,
          (raw, index) =>
            transformEvent(raw, context, index).pipe(
              Effect.map((event) => ({ ok: true as const, event })),
              Effect.catchAll((err) =>
                Effect.succeed({
                  ok: false as const,
                  error: `Event ${err.index}: ${err.message}`,
                })
              )
            ),
          { concurrency: "unbounded" }
        );

        const transformedEvents = transformResults
          .filter((r): r is { ok: true; event: AnalyticsEvent } => r.ok)
          .map((r) => r.event);

        const errors = transformResults
          .filter((r): r is { ok: false; error: string } => !r.ok)
          .map((r) => r.error);

        if (transformedEvents.length > 0) {
          yield* writer.enqueue(transformedEvents);
        }

        yield* Effect.logInfo("Ingested events").pipe(
          Effect.annotateLogs({
            accepted: transformedEvents.length,
            rejected: errors.length,
            source: context.source,
            siteId: context.siteId,
          })
        );

        return {
          accepted: transformedEvents.length,
          rejected: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        };
      });

    return { ingest };
  })
);
