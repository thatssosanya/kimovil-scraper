import { Layer, ManagedRuntime } from "effect";
import { ConfigServiceLive } from "../config";
import { ClickHouseServiceLive } from "../services/clickhouse";
import { EventWriterServiceLive } from "../services/event-writer";
import { EventIngestionServiceLive } from "../services/event-ingestion";
import { EventQueryServiceLive } from "../services/event-query";

const ClickHouseLayer = ClickHouseServiceLive.pipe(
  Layer.provide(ConfigServiceLive)
);

const EventWriterLayer = EventWriterServiceLive.pipe(
  Layer.provide(ClickHouseLayer),
  Layer.provide(ConfigServiceLive)
);

const EventIngestionLayer = EventIngestionServiceLive.pipe(
  Layer.provide(EventWriterLayer)
);

const EventQueryLayer = EventQueryServiceLive.pipe(
  Layer.provide(ClickHouseLayer)
);

export const LiveLayer = Layer.mergeAll(
  ConfigServiceLive,
  ClickHouseLayer,
  EventWriterLayer,
  EventIngestionLayer,
  EventQueryLayer
);

export type LiveLayerType = typeof LiveLayer;

export const LiveRuntime = ManagedRuntime.make(LiveLayer);

export type LiveRuntimeType = typeof LiveRuntime;
