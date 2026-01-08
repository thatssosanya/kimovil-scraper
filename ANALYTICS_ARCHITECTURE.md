# Analytics Service Architecture

## Overview

Self-hosted analytics microservice for tracking impressions, clicks, and custom events across WordPress widgets and device pages. Built with Effect + Elysia + ClickHouse.

## Goals

1. **Track widget impressions** — Which widget mappings get views, from which posts
2. **Track device impressions** — Individual device page views (future)
3. **Track clicks** — Click-through on widgets to external links (future)
4. **Extensible event schema** — Support arbitrary event types without schema changes
5. **Real-time + historical** — Sub-second queries for dashboards, long-term rollups for trends
6. **Privacy-conscious** — No PII, hashed visitor IDs, configurable retention

## Scale

- 10-50M events/month (~4-20 events/second average, bursty)
- 90-day raw retention, 2-year rollup retention
- Single ClickHouse node sufficient for this scale

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WordPress Site                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Tracking Script (analytics.js)                                      │    │
│  │  - IntersectionObserver for visibility                               │    │
│  │  - Batches events in memory                                          │    │
│  │  - Flushes via sendBeacon on interval/unload                         │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │ POST /v1/events (batched JSON)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        apps/analytics (Effect + Elysia)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Ingestion Layer                                                     │    │
│  │  - Validate & enrich events (geo, timestamp normalization)           │    │
│  │  - Push to bounded Effect Queue                                      │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                  │                                           │
│  ┌──────────────────────────────▼──────────────────────────────────────┐    │
│  │  BatchWriterService (Effect Fiber)                                   │    │
│  │  - Drains queue on size/time threshold                               │    │
│  │  - Bulk inserts to ClickHouse                                        │    │
│  │  - Backpressure + retry with jitter                                  │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                  │                                           │
│  ┌──────────────────────────────▼──────────────────────────────────────┐    │
│  │  Query Layer                                                         │    │
│  │  - GET /v1/stats/widgets — Aggregated widget impressions             │    │
│  │  - GET /v1/stats/posts — Aggregated post impressions                 │    │
│  │  - GET /v1/stats/timeseries — Time-bucketed data                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ClickHouse (Docker)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  events (MergeTree)                                                  │    │
│  │  - Raw event storage, TTL 90 days                                    │    │
│  │  - Partitioned by toYYYYMM(occurred_at)                              │    │
│  │  - Ordered by (event_type, source, occurred_at)                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  daily_widget_stats (SummingMergeTree)                               │    │
│  │  - Materialized view rollup                                          │    │
│  │  - TTL 2 years                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  daily_post_stats (SummingMergeTree)                                 │    │
│  │  - Materialized view rollup                                          │    │
│  │  - TTL 2 years                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Schema (Extensible)

### Core Event Structure

All events share a common envelope with type-specific properties in a JSON column:

```typescript
interface AnalyticsEvent {
  // === Identity ===
  event_id: string;          // ULID for ordering + uniqueness
  event_type: string;        // 'widget_impression' | 'widget_click' | 'page_view' | custom
  event_version: number;     // Schema version for this event type (default 1)
  
  // === Timing ===
  occurred_at: Date;         // When event happened (client timestamp)
  received_at: Date;         // When server received (server timestamp)
  
  // === Source ===
  source: string;            // 'wordpress' | 'mobile_app' | 'api'
  site_id: string;           // Domain or site identifier
  
  // === Context ===
  session_id: string;        // Ephemeral session ID (rotates on 30min inactivity)
  visitor_id: string;        // Hashed 1st-party cookie ID
  
  // === Location ===
  page_url: string;          // Full URL (stripped of query params with PII)
  page_path: string;         // Just the path portion
  referrer_domain: string;   // Referrer domain only (not full URL)
  
  // === Device ===
  user_agent: string;        // Raw UA (for parsing device/browser)
  device_type: string;       // 'desktop' | 'mobile' | 'tablet' (parsed)
  
  // === Geo (enriched server-side) ===
  country_code: string;      // ISO 3166-1 alpha-2
  region: string;            // Region/state code
  
  // === Type-specific properties ===
  properties: Record<string, unknown>;  // Stored as JSON in ClickHouse
}
```

### Event Type: `widget_impression`

```typescript
interface WidgetImpressionProperties {
  mapping_id: number;        // FK to widget_model_mappings.id
  post_id: number;           // WordPress post ID
  widget_index: number;      // Position of widget in post (0-based)
  device_slug: string;       // Mapped device slug (if resolved)
  raw_model: string;         // Original raw model text
  viewport_percent: number;  // How much of widget was visible (0-100)
}
```

### Event Type: `widget_click`

```typescript
interface WidgetClickProperties {
  mapping_id: number;
  post_id: number;
  device_slug: string;
  click_target: string;      // 'buy_button' | 'specs_link' | 'price_link'
  destination_url: string;   // Where click leads (affiliate link, etc.)
}
```

### Event Type: `device_page_view`

```typescript
interface DevicePageViewProperties {
  device_id: string;         // Internal device ID
  device_slug: string;
  brand: string;
  view_source: string;       // 'widget_click' | 'direct' | 'search'
  referrer_mapping_id?: number;  // If came from widget click
}
```

---

## ClickHouse Schema

### Raw Events Table

```sql
CREATE TABLE events (
    -- Identity
    event_id String,
    event_type LowCardinality(String),
    event_version UInt8 DEFAULT 1,
    
    -- Timing
    occurred_at DateTime64(3, 'UTC'),
    received_at DateTime64(3, 'UTC') DEFAULT now64(3),
    
    -- Source
    source LowCardinality(String),
    site_id LowCardinality(String),
    
    -- Context
    session_id String,
    visitor_id String,
    
    -- Location
    page_url String,
    page_path String,
    referrer_domain LowCardinality(String),
    
    -- Device
    user_agent String,
    device_type LowCardinality(String),
    
    -- Geo
    country_code LowCardinality(String),
    region LowCardinality(String),
    
    -- Type-specific (JSON for flexibility)
    properties String,  -- JSON string, parsed at query time
    
    -- Extracted fields for indexing (from properties)
    -- These are materialized for common query patterns
    prop_mapping_id Nullable(Int64),
    prop_post_id Nullable(Int64),
    prop_device_slug Nullable(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (event_type, source, site_id, occurred_at, event_id)
TTL occurred_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Secondary index for visitor lookups
ALTER TABLE events ADD INDEX idx_visitor visitor_id TYPE bloom_filter(0.01) GRANULARITY 4;

-- Secondary index for session lookups
ALTER TABLE events ADD INDEX idx_session session_id TYPE bloom_filter(0.01) GRANULARITY 4;
```

### Daily Widget Stats (Materialized View)

```sql
CREATE TABLE daily_widget_stats (
    date Date,
    source LowCardinality(String),
    site_id LowCardinality(String),
    mapping_id Int64,
    post_id Int64,
    device_slug String,
    
    impressions UInt64,
    clicks UInt64,
    unique_visitors AggregateFunction(uniq, String),
    unique_sessions AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, source, site_id, mapping_id, post_id)
TTL date + INTERVAL 2 YEAR;

CREATE MATERIALIZED VIEW daily_widget_stats_mv TO daily_widget_stats AS
SELECT
    toDate(occurred_at) AS date,
    source,
    site_id,
    prop_mapping_id AS mapping_id,
    prop_post_id AS post_id,
    prop_device_slug AS device_slug,
    countIf(event_type = 'widget_impression') AS impressions,
    countIf(event_type = 'widget_click') AS clicks,
    uniqState(visitor_id) AS unique_visitors,
    uniqState(session_id) AS unique_sessions
FROM events
WHERE event_type IN ('widget_impression', 'widget_click')
  AND prop_mapping_id IS NOT NULL
GROUP BY date, source, site_id, mapping_id, post_id, device_slug;
```

### Daily Post Stats (Materialized View)

```sql
CREATE TABLE daily_post_stats (
    date Date,
    source LowCardinality(String),
    site_id LowCardinality(String),
    post_id Int64,
    
    widget_impressions UInt64,
    widget_clicks UInt64,
    unique_visitors AggregateFunction(uniq, String),
    unique_sessions AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, source, site_id, post_id)
TTL date + INTERVAL 2 YEAR;

CREATE MATERIALIZED VIEW daily_post_stats_mv TO daily_post_stats AS
SELECT
    toDate(occurred_at) AS date,
    source,
    site_id,
    prop_post_id AS post_id,
    countIf(event_type = 'widget_impression') AS widget_impressions,
    countIf(event_type = 'widget_click') AS widget_clicks,
    uniqState(visitor_id) AS unique_visitors,
    uniqState(session_id) AS unique_sessions
FROM events
WHERE event_type IN ('widget_impression', 'widget_click')
  AND prop_post_id IS NOT NULL
GROUP BY date, source, site_id, post_id;
```

---

## Effect Service Architecture

### Service Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AnalyticsRuntime                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────┐    ┌───────────────────┐                     │
│  │ ClickHouseClient  │◄───┤ EventWriterService│                     │
│  │ (SqlClient)       │    │ - Queue + Batch   │                     │
│  └───────────────────┘    │ - Retry logic     │                     │
│           ▲               └───────────────────┘                     │
│           │                         ▲                               │
│           │                         │                               │
│  ┌────────┴──────────┐    ┌────────┴──────────┐                     │
│  │ EventQueryService │    │ EventIngestion    │                     │
│  │ - Stats queries   │    │ Service           │                     │
│  │ - Timeseries      │    │ - Validation      │                     │
│  │ - Export          │    │ - Enrichment      │                     │
│  └───────────────────┘    │ - Queueing        │                     │
│                           └───────────────────┘                     │
│                                                                      │
│  ┌───────────────────┐    ┌───────────────────┐                     │
│  │ GeoEnrichService  │    │ ConfigService     │                     │
│  │ (optional)        │    │ - Batch size      │                     │
│  └───────────────────┘    │ - Flush interval  │                     │
│                           │ - Retention       │                     │
│                           └───────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Services

```typescript
// === ClickHouse Client ===
// Uses @clickhouse/client wrapped in Effect
interface ClickHouseService {
  readonly insert: <T>(table: string, values: T[]) => Effect.Effect<void, ClickHouseError>;
  readonly query: <T>(sql: string) => Effect.Effect<T[], ClickHouseError>;
}

// === Event Writer (Background Fiber) ===
interface EventWriterService {
  readonly enqueue: (events: AnalyticsEvent[]) => Effect.Effect<void, never>;
  readonly flush: () => Effect.Effect<void, ClickHouseError>;
  readonly getQueueSize: () => Effect.Effect<number, never>;
}

// === Event Ingestion ===
interface EventIngestionService {
  readonly ingest: (rawEvents: RawEventInput[]) => Effect.Effect<IngestResult, ValidationError>;
}

// === Event Query ===
interface EventQueryService {
  readonly getWidgetStats: (params: WidgetStatsParams) => Effect.Effect<WidgetStats[], QueryError>;
  readonly getPostStats: (params: PostStatsParams) => Effect.Effect<PostStats[], QueryError>;
  readonly getTimeseries: (params: TimeseriesParams) => Effect.Effect<TimeseriesPoint[], QueryError>;
}
```

### Idiomatic Effect Patterns

1. **Bounded Queue with Backpressure**
   ```typescript
   // Create bounded queue - blocks when full (backpressure)
   const eventQueue = yield* Queue.bounded<AnalyticsEvent>(10_000);
   ```

2. **Background Batch Writer Fiber**
   ```typescript
   // Flush on size OR time threshold
   const batchWriter = Effect.gen(function* () {
     const queue = yield* EventQueue;
     const clickhouse = yield* ClickHouseService;
     
     yield* Effect.forever(
       Effect.gen(function* () {
         // Take up to batch size, with timeout
         const batch = yield* Queue.takeBetween(queue, 1, BATCH_SIZE).pipe(
           Effect.timeout(FLUSH_INTERVAL_MS),
           Effect.catchTag("TimeoutException", () => Queue.takeAll(queue))
         );
         
         if (Chunk.size(batch) > 0) {
           yield* clickhouse.insert("events", Chunk.toArray(batch)).pipe(
             Effect.retry(Schedule.exponential("100 millis").pipe(
               Schedule.jittered,
               Schedule.upTo("10 seconds")
             ))
           );
         }
       })
     );
   });
   ```

3. **Graceful Shutdown**
   ```typescript
   // Use acquireRelease for cleanup
   const writerFiber = yield* Effect.acquireRelease(
     Effect.fork(batchWriter),
     (fiber) => Effect.gen(function* () {
       yield* flush();  // Drain queue
       yield* Fiber.interrupt(fiber);
     })
   );
   ```

---

## API Endpoints

### Ingestion

```
POST /v1/events
Content-Type: application/json

{
  "events": [
    {
      "event_type": "widget_impression",
      "occurred_at": "2024-01-15T10:30:00.000Z",
      "session_id": "s_abc123",
      "visitor_id": "v_xyz789",
      "page_url": "https://click-or-die.ru/post/123",
      "properties": {
        "mapping_id": 456,
        "post_id": 123,
        "widget_index": 0,
        "device_slug": "iphone-15-pro",
        "viewport_percent": 100
      }
    }
  ]
}

Response: 
{ "accepted": 1, "rejected": 0 }
```

### Query

```
GET /v1/stats/widgets?from=2024-01-01&to=2024-01-31&mapping_id=456

Response:
{
  "data": [
    {
      "mapping_id": 456,
      "device_slug": "iphone-15-pro",
      "impressions": 12500,
      "clicks": 340,
      "unique_visitors": 8200,
      "ctr": 0.027
    }
  ]
}
```

```
GET /v1/stats/posts?from=2024-01-01&to=2024-01-31&post_id=123

Response:
{
  "data": [
    {
      "post_id": 123,
      "widget_impressions": 5000,
      "widget_clicks": 150,
      "unique_visitors": 3200
    }
  ]
}
```

```
GET /v1/stats/timeseries?from=2024-01-01&to=2024-01-31&interval=day&event_type=widget_impression

Response:
{
  "data": [
    { "bucket": "2024-01-01", "count": 1200, "unique_visitors": 800 },
    { "bucket": "2024-01-02", "count": 1350, "unique_visitors": 920 }
  ]
}
```

---

## Client-Side Tracking (analytics.js)

```javascript
(function() {
  const CONFIG = {
    endpoint: 'https://analytics.click-or-die.ru/v1/events',
    batchSize: 20,
    flushInterval: 5000,  // 5 seconds
    visibilityThreshold: 0.5  // 50% visible = impression
  };
  
  let queue = [];
  let visitorId = getOrCreateVisitorId();
  let sessionId = getOrCreateSessionId();
  
  // Track widget impressions with IntersectionObserver
  function observeWidgets() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= CONFIG.visibilityThreshold) {
          const widget = entry.target;
          if (!widget.dataset.tracked) {
            widget.dataset.tracked = 'true';
            trackEvent('widget_impression', {
              mapping_id: parseInt(widget.dataset.mappingId),
              post_id: parseInt(widget.dataset.postId),
              widget_index: parseInt(widget.dataset.widgetIndex),
              device_slug: widget.dataset.deviceSlug,
              viewport_percent: Math.round(entry.intersectionRatio * 100)
            });
          }
        }
      });
    }, { threshold: [0, 0.5, 1.0] });
    
    document.querySelectorAll('[data-widget-tracking]').forEach(el => observer.observe(el));
  }
  
  function trackEvent(eventType, properties) {
    queue.push({
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      session_id: sessionId,
      visitor_id: visitorId,
      page_url: location.href.split('?')[0],  // Strip query params
      page_path: location.pathname,
      referrer_domain: document.referrer ? new URL(document.referrer).hostname : '',
      properties
    });
    
    if (queue.length >= CONFIG.batchSize) flush();
  }
  
  function flush() {
    if (queue.length === 0) return;
    
    const payload = JSON.stringify({ events: queue });
    queue = [];
    
    // Use sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon(CONFIG.endpoint, payload);
    } else {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      });
    }
  }
  
  // Flush on interval
  setInterval(flush, CONFIG.flushInterval);
  
  // Flush on page hide/unload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  
  // Initialize
  observeWidgets();
  
  // Expose for manual tracking
  window.codAnalytics = { trackEvent, flush };
})();
```

---

## Directory Structure

```
apps/analytics/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment config
│   ├── routes/
│   │   ├── events.ts         # POST /v1/events
│   │   └── stats.ts          # GET /v1/stats/*
│   ├── services/
│   │   ├── clickhouse.ts     # ClickHouse client wrapper
│   │   ├── event-writer.ts   # Background batch writer
│   │   ├── event-ingestion.ts# Validation + enrichment
│   │   └── event-query.ts    # Stats queries
│   ├── domain/
│   │   ├── events.ts         # Event types + schemas
│   │   └── errors.ts         # Error types
│   ├── layers/
│   │   └── live.ts           # Layer composition
│   └── sql/
│       └── schema.sql        # ClickHouse DDL
├── docker/
│   └── docker-compose.yml    # ClickHouse container
└── scripts/
    └── migrate.ts            # Schema migration
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create `apps/analytics` scaffold
- [ ] Docker Compose with ClickHouse
- [ ] ClickHouse schema + migrations
- [ ] Basic Effect service structure

### Phase 2: Ingestion Pipeline
- [ ] EventIngestionService with validation
- [ ] EventWriterService with batching
- [ ] POST /v1/events endpoint
- [ ] Backpressure + retry logic

### Phase 3: Query Layer
- [ ] EventQueryService
- [ ] Stats endpoints (widgets, posts, timeseries)
- [ ] Query caching (optional)

### Phase 4: Client Integration
- [ ] analytics.js tracking script
- [ ] WordPress plugin/snippet
- [ ] Widget component updates (data attributes)

### Phase 5: Dashboard
- [ ] Stats UI in ws-web
- [ ] Real-time updates (optional)

---

## Configuration

```typescript
interface AnalyticsConfig {
  // ClickHouse
  clickhouse: {
    url: string;           // 'http://localhost:8123'
    database: string;      // 'analytics'
    username: string;
    password: string;
  };
  
  // Ingestion
  ingestion: {
    batchSize: number;     // 1000
    flushIntervalMs: number; // 5000
    maxQueueSize: number;  // 10000
  };
  
  // Retention
  retention: {
    rawEventsDays: number;   // 90
    rollupYears: number;     // 2
  };
  
  // Security
  security: {
    allowedOrigins: string[];  // CORS
    rateLimitPerMinute: number; // 1000
  };
}
```

---

## Future Extensions

1. **Device page views** — Track direct device page visits
2. **Conversion tracking** — Track purchases/signups from widget clicks
3. **A/B testing** — Track variant exposure
4. **Funnel analysis** — Multi-step conversion funnels
5. **Real-time streaming** — WebSocket for live dashboards
6. **Sampling** — Client-side sampling at high scale
7. **Geo enrichment** — MaxMind GeoIP integration
