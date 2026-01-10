-- Analytics ClickHouse Schema
-- Run with: clickhouse-client --multiquery < schema.sql

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS analytics;

USE analytics;

-- =============================================================================
-- Raw Events Table
-- =============================================================================
-- Stores all raw events with 90-day TTL
-- Partitioned by month for efficient pruning
-- Ordered by (event_type, source, site_id, occurred_at) for common query patterns

CREATE TABLE IF NOT EXISTS events (
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
    
    -- Type-specific properties (JSON)
    properties String,
    
    -- Extracted fields for indexing (from properties)
    prop_mapping_id Nullable(Int64),
    prop_post_id Nullable(Int64),
    prop_device_slug Nullable(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (event_type, source, site_id, occurred_at, event_id)
TTL toDateTime(occurred_at) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Secondary indices for common lookups
ALTER TABLE events ADD INDEX IF NOT EXISTS idx_visitor visitor_id TYPE bloom_filter(0.01) GRANULARITY 4;
ALTER TABLE events ADD INDEX IF NOT EXISTS idx_session session_id TYPE bloom_filter(0.01) GRANULARITY 4;
ALTER TABLE events ADD INDEX IF NOT EXISTS idx_mapping prop_mapping_id TYPE minmax GRANULARITY 4;
ALTER TABLE events ADD INDEX IF NOT EXISTS idx_post prop_post_id TYPE minmax GRANULARITY 4;


-- =============================================================================
-- Daily Widget Stats (Rollup Table)
-- =============================================================================
-- Pre-aggregated daily stats per widget mapping
-- Uses AggregatingMergeTree for unique visitor/session counts

CREATE TABLE IF NOT EXISTS daily_widget_stats (
    date Date,
    source LowCardinality(String),
    site_id LowCardinality(String),
    mapping_id Int64 DEFAULT 0,
    post_id Int64 DEFAULT 0,
    device_slug String,
    
    impressions UInt64,
    clicks UInt64,
    unique_visitors AggregateFunction(uniq, String),
    unique_sessions AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, source, site_id, mapping_id, post_id, device_slug)
TTL date + INTERVAL 2 YEAR;

-- Materialized view to populate daily_widget_stats
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_widget_stats_mv TO daily_widget_stats AS
SELECT
    toDate(occurred_at) AS date,
    source,
    site_id,
    coalesce(prop_mapping_id, 0) AS mapping_id,
    coalesce(prop_post_id, 0) AS post_id,
    coalesce(prop_device_slug, '') AS device_slug,
    countIf(event_type = 'widget_impression') AS impressions,
    countIf(event_type = 'widget_click') AS clicks,
    uniqState(visitor_id) AS unique_visitors,
    uniqState(session_id) AS unique_sessions
FROM events
WHERE event_type IN ('widget_impression', 'widget_click')
GROUP BY date, source, site_id, mapping_id, post_id, device_slug;


-- =============================================================================
-- Daily Post Stats (Rollup Table)
-- =============================================================================
-- Pre-aggregated daily stats per WordPress post

CREATE TABLE IF NOT EXISTS daily_post_stats (
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

-- Materialized view to populate daily_post_stats
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_post_stats_mv TO daily_post_stats AS
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


-- =============================================================================
-- Daily Device Stats (Rollup Table) - Future use
-- =============================================================================
-- Pre-aggregated daily stats per device (for device page view tracking)

CREATE TABLE IF NOT EXISTS daily_device_stats (
    date Date,
    source LowCardinality(String),
    site_id LowCardinality(String),
    device_slug String,
    brand LowCardinality(String),
    
    page_views UInt64,
    widget_referrals UInt64,
    unique_visitors AggregateFunction(uniq, String),
    unique_sessions AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, source, site_id, device_slug)
TTL date + INTERVAL 2 YEAR;

-- Materialized view for device stats (triggered by device_page_view events)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_device_stats_mv TO daily_device_stats AS
SELECT
    toDate(occurred_at) AS date,
    source,
    site_id,
    coalesce(prop_device_slug, '') AS device_slug,
    coalesce(JSONExtractString(properties, 'brand'), '') AS brand,
    countIf(event_type = 'device_page_view') AS page_views,
    countIf(event_type = 'device_page_view' AND JSONExtractString(properties, 'view_source') = 'widget_click') AS widget_referrals,
    uniqState(visitor_id) AS unique_visitors,
    uniqState(session_id) AS unique_sessions
FROM events
WHERE event_type = 'device_page_view'
  AND prop_device_slug IS NOT NULL
GROUP BY date, source, site_id, device_slug, brand;


-- =============================================================================
-- Useful Queries for Debugging
-- =============================================================================

-- Check event counts by type (last 7 days)
-- SELECT event_type, count() FROM events WHERE occurred_at >= now() - INTERVAL 7 DAY GROUP BY event_type;

-- Check daily widget stats
-- SELECT date, sum(impressions), sum(clicks) FROM daily_widget_stats GROUP BY date ORDER BY date DESC LIMIT 30;

-- Top widgets by impressions (last 30 days)
-- SELECT mapping_id, device_slug, sum(impressions), sum(clicks), uniqMerge(unique_visitors)
-- FROM daily_widget_stats
-- WHERE date >= today() - 30
-- GROUP BY mapping_id, device_slug
-- ORDER BY sum(impressions) DESC
-- LIMIT 20;

-- Top posts by widget impressions (last 30 days)
-- SELECT post_id, sum(widget_impressions), uniqMerge(unique_visitors)
-- FROM daily_post_stats
-- WHERE date >= today() - 30
-- GROUP BY post_id
-- ORDER BY sum(widget_impressions) DESC
-- LIMIT 20;
