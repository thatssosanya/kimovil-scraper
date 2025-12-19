# Kimovil Scraper

Phone specs scraper for Kimovil with AI-powered normalization. Extracts detailed device data (specs, cameras, benchmarks, pricing) and translates/cleans it via Gemini Flash.

## Architecture

```
apps/
  scraper/     # Elysia + Bun + Effect backend
  ws-web/      # SolidJS + Vite + Tailwind v4 frontend
packages/
  scraper-protocol/  # Effect Schema message types
  scraper-domain/    # Service interfaces
```

**Stack**: TypeScript 5.9, Effect 3.x, Playwright, SQLite, Gemini 3 Flash

## Features

- **Search**: Kimovil autocomplete API with WebSocket streaming
- **Scrape**: Playwright extraction → SQLite cache → Gemini normalization (~25s/phone)
- **Bulk jobs**: Queue-based with concurrency, rate limiting, retry backoff
- **Fast mode**: HTML-only scraping (no AI), validates for bot protection

## Scraping Pipeline

```
Browser launch → Navigate to Kimovil → Extract data → Validate HTML → Cache to SQLite → Gemini normalize → Return PhoneData
```

## Running Locally

```bash
# Terminal 1 - Backend (ws://localhost:1488/ws)
cd apps/scraper && bun run dev

# Terminal 2 - Frontend (http://localhost:5173)
cd apps/ws-web && bun run dev
```

## Environment (apps/scraper/.env)

```
GOOGLE_API_KEY=...
LOCAL_PLAYWRIGHT=true
BRD_WSENDPOINT=wss://...  # optional Bright Data
BULK_CONCURRENCY=2
BULK_RATE_LIMIT_MS=1500
```

## Commands

```bash
bun run build       # build all
bun run dev         # dev all
bun run lint        # eslint
bun run check-types # tsc
bun run format      # prettier
```
