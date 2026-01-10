import { Effect, Layer, Context, Queue, Chunk, Fiber, Schedule, Ref } from "effect";
import { ConfigService } from "../config";
import { ClickHouseServiceTag } from "./clickhouse";
import { ClickHouseError, QueueFullError } from "../domain/errors";
import type { AnalyticsEvent } from "../domain/events";

export interface EventWriterService {
  readonly enqueue: (events: AnalyticsEvent[]) => Effect.Effect<void, QueueFullError>;
  readonly flush: () => Effect.Effect<void, ClickHouseError>;
  readonly getQueueSize: () => Effect.Effect<number, never>;
  readonly getStats: () => Effect.Effect<WriterStats, never>;
}

export interface WriterStats {
  queueSize: number;
  totalEnqueued: number;
  totalFlushed: number;
  totalBatches: number;
  lastFlushAt: Date | null;
}

export class EventWriterServiceTag extends Context.Tag("EventWriterService")<
  EventWriterServiceTag,
  EventWriterService
>() {}

export const EventWriterServiceLive = Layer.scoped(
  EventWriterServiceTag,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const clickhouse = yield* ClickHouseServiceTag;

    const eventQueue = yield* Queue.bounded<AnalyticsEvent>(config.ingestion.maxQueueSize);
    
    const stats = yield* Ref.make<WriterStats>({
      queueSize: 0,
      totalEnqueued: 0,
      totalFlushed: 0,
      totalBatches: 0,
      lastFlushAt: null,
    });

    const flushBatch = Effect.gen(function* () {
      const batch = yield* Queue.takeUpTo(eventQueue, config.ingestion.batchSize);
      const events = Chunk.toArray(batch);
      
      if (events.length === 0) return;

      yield* clickhouse.insert(events).pipe(
        Effect.retry(
          Schedule.exponential("100 millis").pipe(
            Schedule.jittered,
            Schedule.compose(Schedule.recurs(5))
          )
        ),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError("Failed to flush events to ClickHouse").pipe(
              Effect.annotateLogs({ error, batchSize: events.length })
            );
          })
        )
      );

      yield* Ref.update(stats, (s) => ({
        ...s,
        queueSize: s.queueSize - events.length,
        totalFlushed: s.totalFlushed + events.length,
        totalBatches: s.totalBatches + 1,
        lastFlushAt: new Date(),
      }));

      yield* Effect.logDebug("Flushed event batch").pipe(
        Effect.annotateLogs({ count: events.length })
      );
    });

    const backgroundWriter = Effect.gen(function* () {
      yield* Effect.logInfo("Starting background event writer");
      
      yield* Effect.forever(
        Effect.gen(function* () {
          const queueSize = yield* Queue.size(eventQueue);
          
          if (queueSize >= config.ingestion.batchSize) {
            yield* flushBatch;
          } else if (queueSize > 0) {
            yield* Effect.sleep(config.ingestion.flushIntervalMs);
            yield* flushBatch;
          } else {
            yield* Effect.sleep(config.ingestion.flushIntervalMs);
          }
        })
      );
    });

    // Fork the background writer as a daemon (won't block runtime)
    yield* Effect.forkDaemon(backgroundWriter);

    const enqueue: EventWriterService["enqueue"] = (events) =>
      Effect.gen(function* () {
        const currentSize = yield* Queue.size(eventQueue);
        
        if (currentSize + events.length > config.ingestion.maxQueueSize) {
          return yield* Effect.fail(
            new QueueFullError({
              message: "Event queue is full, dropping events",
              queueSize: currentSize,
            })
          );
        }

        yield* Queue.offerAll(eventQueue, events);
        
        yield* Ref.update(stats, (s) => ({
          ...s,
          queueSize: s.queueSize + events.length,
          totalEnqueued: s.totalEnqueued + events.length,
        }));
      });

    const flush: EventWriterService["flush"] = () => flushBatch;

    const getQueueSize: EventWriterService["getQueueSize"] = () =>
      Queue.size(eventQueue);

    const getStats: EventWriterService["getStats"] = () => Ref.get(stats);

    return { enqueue, flush, getQueueSize, getStats };
  })
);
