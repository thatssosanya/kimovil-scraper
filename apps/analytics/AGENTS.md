# Analytics Service - Development Guide

## Commands

- **Dev**: `npm run dev` — Start with hot reload (tsx watch)
- **Start**: `npm run start` — Production start
- **Type Check**: `npm run check-types` — TypeScript validation
- **Test**: `npm run test` — Run vitest
- **Migrate**: `npm run migrate` — Run ClickHouse schema migrations

## Running Locally

```bash
# Terminal 1 — Start ClickHouse
cd docker && docker compose up -d

# Terminal 2 — Run migrations (first time only)
npm run migrate

# Terminal 3 — Start analytics service
npm run dev
```

- Analytics API: `http://localhost:1489`
- ClickHouse HTTP: `http://localhost:8123`
- ClickHouse Native: `localhost:9000`

## Architecture

### Stack
- **Runtime**: Effect 3.x + Elysia + Node adapter
- **Database**: ClickHouse (self-hosted via Docker)
- **Protocol**: HTTP JSON REST API

### Directory Structure
```
src/
├── index.ts              # Entry point, Elysia server setup
├── config.ts             # Environment config via Effect Config
├── domain/
│   ├── events.ts         # Event types, schemas (@effect/schema)
│   └── errors.ts         # Typed errors (Data.TaggedError)
├── services/
│   ├── clickhouse.ts     # ClickHouse client wrapper
│   ├── event-writer.ts   # Background batch writer (Queue + Fiber)
│   ├── event-ingestion.ts# Validation + enrichment
│   └── event-query.ts    # Stats query service
├── routes/
│   ├── events.ts         # POST /v1/events
│   └── stats.ts          # GET /v1/stats/*
├── layers/
│   └── live.ts           # Layer composition, ManagedRuntime
└── sql/
    └── schema.sql        # ClickHouse DDL
```

### Service Layer Graph
```
ConfigService
    │
    ▼
ClickHouseService (scoped - manages client lifecycle)
    │
    ├──► EventWriterService (scoped - background fiber)
    │         │
    │         ▼
    │    EventIngestionService
    │
    └──► EventQueryService
```

## Effect Patterns Used

### Service Definition
Services use `Context.Tag` with interface + implementation pattern:
```typescript
export class MyServiceTag extends Context.Tag("MyService")<
  MyServiceTag,
  MyServiceInterface
>() {}

export const MyServiceLive = Layer.effect(
  MyServiceTag,
  Effect.gen(function* () {
    const dep = yield* SomeDependency;
    return { /* implementation */ };
  })
);
```

### Scoped Resources
For services managing resources (connections, fibers), use `Layer.scoped` with `Effect.acquireRelease`:
```typescript
const client = yield* Effect.acquireRelease(
  Effect.sync(() => createClient(...)),
  (client) => Effect.promise(() => client.close())
);
```

### Background Fibers
The EventWriterService spawns a background fiber for batch flushing:
```typescript
yield* Effect.acquireRelease(
  Effect.fork(backgroundWriter),
  (fiber) => Effect.gen(function* () {
    // Drain queue before shutdown
    yield* Fiber.interrupt(fiber);
  })
);
```

### Bounded Queue with Backpressure
```typescript
const queue = yield* Queue.bounded<Event>(maxSize);
// Enqueue with overflow check
const size = yield* Queue.size(queue);
if (size + events.length > maxSize) {
  return yield* Effect.fail(new QueueFullError(...));
}
yield* Queue.offerAll(queue, events);
```

## ClickHouse Schema

### Tables
| Table | Engine | Purpose |
|-------|--------|---------|
| `events` | MergeTree | Raw events, TTL 90 days |
| `daily_widget_stats` | AggregatingMergeTree | Widget rollups, TTL 2 years |
| `daily_post_stats` | AggregatingMergeTree | Post rollups, TTL 2 years |
| `daily_device_stats` | AggregatingMergeTree | Device rollups (future) |

### Materialized Views
- `daily_widget_stats_mv` — Aggregates widget impressions/clicks by day
- `daily_post_stats_mv` — Aggregates post-level stats by day
- `daily_device_stats_mv` — Aggregates device page views (future)

### Key Columns in `events`
| Column | Type | Description |
|--------|------|-------------|
| `event_id` | String | ULID for uniqueness |
| `event_type` | LowCardinality(String) | `widget_impression`, `widget_click`, etc. |
| `occurred_at` | DateTime64(3, 'UTC') | Client timestamp |
| `received_at` | DateTime64(3, 'UTC') | Server timestamp |
| `source` | LowCardinality(String) | `wordpress`, `api`, etc. |
| `site_id` | LowCardinality(String) | Multi-tenant site ID |
| `session_id` | String | Ephemeral session |
| `visitor_id` | String | Persistent visitor cookie |
| `properties` | String | JSON blob for event-specific data |
| `prop_mapping_id` | Nullable(Int64) | Extracted for indexing |
| `prop_post_id` | Nullable(Int64) | Extracted for indexing |
| `prop_device_slug` | Nullable(String) | Extracted for indexing |

## Event Types

### `widget_impression`
Tracked when a widget becomes visible (50%+ viewport).
```typescript
properties: {
  mapping_id: number;    // FK to widget_model_mappings
  post_id: number;       // WordPress post ID
  widget_index?: number; // Position in post
  device_slug?: string;  // Mapped device
  viewport_percent?: number;
}
```

### `widget_click`
Tracked when user clicks a widget link.
```typescript
properties: {
  mapping_id: number;
  post_id: number;
  device_slug?: string;
  click_target?: string;     // 'buy_button', 'specs_link'
  destination_url?: string;
}
```

### `device_page_view` (future)
For tracking device detail page views.
```typescript
properties: {
  device_slug: string;
  brand?: string;
  view_source?: string;  // 'widget_click', 'direct', 'search'
  referrer_mapping_id?: number;
}
```

## API Endpoints

### Ingestion
```
POST /v1/events
Content-Type: application/json

{
  "events": [{
    "event_type": "widget_impression",
    "occurred_at": "2024-01-15T10:30:00.000Z",
    "session_id": "s_abc123",
    "visitor_id": "v_xyz789",
    "site_id": "click-or-die.ru",
    "properties": { "mapping_id": 456, "post_id": 123 }
  }]
}

Response: { "accepted": 1, "rejected": 0 }
```

### Query Endpoints
```
GET /v1/stats/widgets?from=2024-01-01&to=2024-01-31&mapping_id=456
GET /v1/stats/posts?from=2024-01-01&to=2024-01-31&post_id=123
GET /v1/stats/timeseries?from=2024-01-01&to=2024-01-31&interval=day
GET /v1/stats/total?from=2024-01-01&to=2024-01-31
```

### Health
```
GET /health              # Basic health
GET /v1/events/health    # Queue stats
```

## Client-Side Tracking (analytics.js)

### Configuration
```html
<script>
  window.COD_ANALYTICS_ENDPOINT = 'https://analytics.example.com/v1/events';
  window.COD_ANALYTICS_SITE_ID = 'my-site-id';
  window.COD_ANALYTICS_DEBUG = true; // optional
</script>
<script src="/analytics.js" async></script>
```

### Widget Tracking (automatic)
```html
<div data-widget-tracking
     data-mapping-id="123"
     data-post-id="456"
     data-widget-index="0"
     data-device-slug="iphone-15-pro">
  Widget content
</div>
```

### Click Tracking
```html
<a href="https://buy.example.com"
   data-widget-click
   data-mapping-id="123"
   data-post-id="456"
   data-click-target="buy_button">
  Buy Now
</a>
```

### Manual Tracking
```javascript
window.codAnalytics.trackEvent('custom', {
  action: 'share',
  platform: 'twitter'
});
window.codAnalytics.flush(); // Force immediate send
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLICKHOUSE_URL` | `http://localhost:8123` | ClickHouse HTTP endpoint |
| `CLICKHOUSE_DATABASE` | `analytics` | Database name |
| `CLICKHOUSE_USERNAME` | `default` | Username |
| `CLICKHOUSE_PASSWORD` | (empty) | Password |
| `ANALYTICS_BATCH_SIZE` | `1000` | Events per batch insert |
| `ANALYTICS_FLUSH_INTERVAL_MS` | `5000` | Flush interval (ms) |
| `ANALYTICS_MAX_QUEUE_SIZE` | `10000` | Max queue before backpressure |
| `ANALYTICS_PORT` | `1489` | Server port |
| `ANALYTICS_ALLOWED_ORIGINS` | `*` | CORS allowed origins |

## Error Handling

### Error Types
| Error | HTTP Status | When |
|-------|-------------|------|
| `ValidationError` | 400 | Invalid event payload |
| `QueueFullError` | 503 | Queue at capacity |
| `QueryError` | 500 | ClickHouse query failure |
| `ClickHouseError` | 500 | Connection/insert failure |

### Error Pattern
```typescript
class MyError extends Data.TaggedError("MyError")<{
  message: string;
  cause?: unknown;
}> {}
```

## Code Style

- **TypeScript**: Strict mode, explicit types
- **Effect**: Use `Effect.gen` with `yield*`, typed errors, Layer composition
- **SQL**: Use `escapeString()` for all user-provided string values (SQL injection prevention)
- **Imports**: Named imports from libraries
- **Naming**: camelCase for variables/functions, PascalCase for types/services

## Security Considerations

1. **SQL Injection**: All string parameters in queries MUST use `escapeString()`
2. **CORS**: Default `*` allows any origin — restrict in production
3. **No Auth**: Currently no authentication — add API keys for production
4. **PII**: Client strips query params from URLs; no IP logging by default

## Useful ClickHouse Queries

```sql
-- Event counts by type (last 7 days)
SELECT event_type, count()
FROM analytics.events
WHERE occurred_at >= now() - INTERVAL 7 DAY
GROUP BY event_type;

-- Top widgets by impressions
SELECT mapping_id, sum(impressions), sum(clicks)
FROM analytics.daily_widget_stats
WHERE date >= today() - 30
GROUP BY mapping_id
ORDER BY sum(impressions) DESC
LIMIT 20;

-- Check materialized view lag
SELECT table, rows, bytes_on_disk
FROM system.parts
WHERE database = 'analytics'
GROUP BY table;
```

## Debug Commands

```bash
# Check ClickHouse is running
curl http://localhost:8123/ping

# Query events directly
curl "http://localhost:8123/?query=SELECT%20count()%20FROM%20analytics.events"

# Test event ingestion
curl -X POST http://localhost:1489/v1/events \
  -H "Content-Type: application/json" \
  -d '{"events":[{"event_type":"widget_impression","occurred_at":"2024-01-01T00:00:00Z","session_id":"test","visitor_id":"test","properties":{"mapping_id":1,"post_id":1}}]}'

# Check queue health
curl http://localhost:1489/v1/events/health
```

## Data Retention

- **Raw events**: 90 days (ClickHouse TTL)
- **Daily rollups**: 2 years (ClickHouse TTL)
- Retention is enforced automatically by ClickHouse background merges
