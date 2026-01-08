# Analytics Service

Self-hosted analytics microservice for tracking widget impressions, clicks, and custom events.

## Stack

- **Runtime**: Effect 3.x + Elysia
- **Database**: ClickHouse (self-hosted via Docker)
- **Protocol**: HTTP JSON

## Quick Start

### 1. Start ClickHouse

```bash
cd docker
docker compose up -d
```

### 2. Run Migrations

```bash
cp .env.example .env
npm install
npm run migrate
```

### 3. Start the Service

```bash
npm run dev
```

The service will be available at `http://localhost:1489`.

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
      "page_url": "https://example.com/post/123",
      "properties": {
        "mapping_id": 456,
        "post_id": 123,
        "device_slug": "iphone-15-pro"
      }
    }
  ]
}
```

### Query Stats

```
GET /v1/stats/widgets?from=2024-01-01&to=2024-01-31
GET /v1/stats/posts?from=2024-01-01&to=2024-01-31
GET /v1/stats/timeseries?from=2024-01-01&to=2024-01-31&interval=day
GET /v1/stats/total?from=2024-01-01&to=2024-01-31
```

### Health Check

```
GET /health
GET /v1/events/health  # Queue stats
```

## Client-Side Tracking

Include `public/analytics.js` on your WordPress site:

```html
<script>
  window.COD_ANALYTICS_ENDPOINT = 'https://analytics.your-domain.ru/v1/events';
</script>
<script src="https://analytics.your-domain.ru/analytics.js" async></script>
```

Then add data attributes to widgets:

```html
<div data-widget-tracking
     data-mapping-id="123"
     data-post-id="456"
     data-device-slug="iphone-15-pro">
  Widget content
</div>
```

For click tracking:

```html
<a href="https://buy.example.com"
   data-widget-click
   data-mapping-id="123"
   data-post-id="456"
   data-click-target="buy_button">
  Buy Now
</a>
```

## Architecture

See [ANALYTICS_ARCHITECTURE.md](../../ANALYTICS_ARCHITECTURE.md) for detailed architecture documentation.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLICKHOUSE_URL` | `http://localhost:8123` | ClickHouse HTTP endpoint |
| `CLICKHOUSE_DATABASE` | `analytics` | Database name |
| `CLICKHOUSE_USERNAME` | `default` | Username |
| `CLICKHOUSE_PASSWORD` | (empty) | Password |
| `ANALYTICS_BATCH_SIZE` | `1000` | Events per batch |
| `ANALYTICS_FLUSH_INTERVAL_MS` | `5000` | Flush interval |
| `ANALYTICS_MAX_QUEUE_SIZE` | `10000` | Max queue size |
| `ANALYTICS_PORT` | `1489` | Server port |
| `ANALYTICS_ALLOWED_ORIGINS` | `*` | CORS origins |

## Data Retention

- **Raw events**: 90 days (configurable via ClickHouse TTL)
- **Daily rollups**: 2 years

## Useful ClickHouse Queries

```sql
-- Event counts by type (last 7 days)
SELECT event_type, count()
FROM analytics.events
WHERE occurred_at >= now() - INTERVAL 7 DAY
GROUP BY event_type;

-- Top widgets by impressions (last 30 days)
SELECT mapping_id, device_slug, sum(impressions), sum(clicks)
FROM analytics.daily_widget_stats
WHERE date >= today() - 30
GROUP BY mapping_id, device_slug
ORDER BY sum(impressions) DESC
LIMIT 20;

-- Top posts by widget impressions
SELECT post_id, sum(widget_impressions)
FROM analytics.daily_post_stats
WHERE date >= today() - 30
GROUP BY post_id
ORDER BY sum(widget_impressions) DESC
LIMIT 20;
```
