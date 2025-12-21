# Unified Refactor Plan v2

## Overview

Combines Epic 2 (Idiomatic Effect Migration) + Schema Refactor into a single incremental migration to `@effect/sql` with proper Effect patterns.

**Constraints** (from planning session):

- App not live yet - can go offline, change schema freely
- No external DB consumers
- ~50 writes/sec peak (SQLite + WAL handles fine)
- Fail fast on reads, quarantine corrupted data
- Model.Class for DB entities only (frontend keeps plain TS)
- Backup restore acceptable (no reversible migrations needed)

**Estimated effort**: 1.5-2 days

---

## Phase 0: Browser Resource Management

**Goal**: Fix browser leak before touching DB (isolated, reduces flakes during later work)

**Tasks**:

- Add `Effect.acquireRelease` to `BrowserService.createBrowser()`
- Add `Effect.acquireRelease` to `BrowserService.createLocalBrowser()`
- Update callers to use `Effect.scoped`
- Verify no browser processes leak after scrape errors

**Files**:

- `apps/scraper/src/services/browser.ts`
- `apps/scraper/src/services/scrape-kimovil.ts`
- `apps/scraper/src/services/bulk-job.ts`

**Verification**:

- Run scrape, kill mid-way, check no orphan Chrome processes
- `npm run check-types` passes

---

## Phase 1: Install Packages + Test Harness

**Goal**: Set up @effect/sql and testing infrastructure

**Tasks**:

- Add `@effect/sql`, `@effect/sql-sqlite-node` to `apps/scraper`
- Add `@effect/vitest` to dev dependencies
- Create test harness with temp SQLite DB
- Write one smoke test proving harness works

**Files**:

- `apps/scraper/package.json`
- `apps/scraper/src/test/setup.ts` (new)
- `apps/scraper/src/test/smoke.test.ts` (new)

**Verification**:

- `bun test` runs and passes
- `npm run check-types` passes

---

## Phase 2: SqlClient Layer + Quarantine Table

**Goal**: Replace DatabaseService with @effect/sql SqlClient, add quarantine infrastructure

**Tasks**:

- Create `apps/scraper/src/sql/client.ts` with SqlClient layer
- Configure WAL mode, busy timeout, statement cache
- Migrate schema initialization to new client
- Create quarantine table for corrupted data
- Create quarantine helper: `quarantine(slug, sourceTable, data, error)`
- Delete old `services/db.ts`

**Schema**:

```sql
CREATE TABLE IF NOT EXISTS quarantine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  source_table TEXT NOT NULL,
  data TEXT NOT NULL,
  error TEXT NOT NULL,
  quarantined_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_quarantine_slug ON quarantine(slug);
CREATE INDEX idx_quarantine_source ON quarantine(source_table);
```

**Files**:

- `apps/scraper/src/sql/client.ts` (new)
- `apps/scraper/src/sql/quarantine.ts` (new)
- `apps/scraper/src/sql/schema.ts` (new - schema init)
- `apps/scraper/src/services/db.ts` (delete)
- `apps/scraper/src/layers/live.ts` (update)

**Verification**:

- App starts with new SqlClient
- `npm run check-types` passes

---

## Phase 3: Domain Models

**Goal**: Create canonical domain models using Model.Class

**Tasks**:

- Create `Camera`, `Sku`, `Benchmark` as Schema.Class (embedded types)
- Create `Phone` as Model.Class with proper field types
- Create `RawPhone` as Model.Class for pre-AI data
- Use `Model.JsonFromString` for array fields
- Use `Model.BooleanFromNumber` for SQLite booleans
- Add `createdAt`, `updatedAt` timestamps
- Export from `@repo/scraper-domain`

**Files**:

- `packages/scraper-domain/src/models/phone.ts` (new)
- `packages/scraper-domain/src/models/index.ts` (new)
- `packages/scraper-domain/src/index.ts` (update exports)

**Verification**:

- `npm run build` passes
- `npm run check-types` passes

---

## Phase 4: Migrate PhoneDataService

**Goal**: Migrate phone data storage to @effect/sql with Model + quarantine

**Tasks**:

- Write integration tests for current PhoneDataService behavior
- Create `PhoneRepo` using Model.makeRepository for basic CRUD
- Keep custom queries hand-written (`getSlugsNeedingAi`, `getSlugsNeedingExtraction`)
- Add Schema.decode with fail-fast + quarantine fallback
- Update service internals, keep interface stable
- Delete old implementation

**Error handling pattern**:

```typescript
const getPhone = (slug: string) =>
  sql<PhoneRow>`
  SELECT * FROM phone_data WHERE slug = ${slug}
`.pipe(
    Effect.flatMap((rows) =>
      rows[0] ? Schema.decode(Phone)(rows[0]) : Effect.succeed(null),
    ),
    Effect.catchTag("ParseError", (e) =>
      quarantine(slug, "phone_data", rows[0], e.message).pipe(Effect.as(null)),
    ),
  );
```

**Files**:

- `apps/scraper/src/test/phone-data.test.ts` (new)
- `apps/scraper/src/repositories/phone.ts` (new)
- `apps/scraper/src/services/phone-data.ts` (rewrite internals)

**Verification**:

- All phone-data tests pass
- `npm run check-types` passes

---

## Phase 5: Migrate HtmlCacheService

**Goal**: Migrate HTML cache to @effect/sql

**Tasks**:

- Write integration tests for current HtmlCacheService behavior
- Rewrite internals to use SqlClient
- Keep interface stable
- Add quarantine for corrupted verification records

**Files**:

- `apps/scraper/src/test/html-cache.test.ts` (new)
- `apps/scraper/src/services/html-cache.ts` (rewrite internals)

**Verification**:

- All html-cache tests pass
- `npm run check-types` passes

---

## Phase 6: Migrate JobQueueService

**Goal**: Migrate job queue to @effect/sql with explicit transactions

**Tasks**:

- Write integration tests for queue behavior (ordering, retry, backoff)
- Identify multi-step operations needing transactions
- Rewrite internals to use SqlClient
- Wrap transactional operations explicitly
- Keep interface stable

**Transactional operations**:

- `claimNextQueueItem` (SELECT + UPDATE in one transaction)
- `rescheduleQueueItem` (UPDATE attempt + next_attempt_at)
- `enqueueJobSlugs` (bulk INSERT)

**Files**:

- `apps/scraper/src/test/job-queue.test.ts` (new)
- `apps/scraper/src/services/job-queue.ts` (rewrite internals)

**Verification**:

- All job-queue tests pass
- `npm run check-types` passes

---

## Phase 7: Migrate DeviceService

**Goal**: Migrate device storage to @effect/sql

**Tasks**:

- Write integration tests for DeviceService
- Create `Device` Model.Class if beneficial (or keep simple)
- Rewrite internals to use SqlClient
- Keep interface stable

**Files**:

- `apps/scraper/src/test/device.test.ts` (new)
- `apps/scraper/src/services/device.ts` (rewrite internals)

**Verification**:

- All device tests pass
- `npm run check-types` passes

---

## Phase 8: Data Migration (Pipe → JSON)

**Goal**: Convert pipe-delimited strings to JSON arrays

**Tasks**:

- Create idempotent migration script
- Add pre-check: count rows needing migration
- Add post-check: count valid JSON rows
- Backup DB before running
- Run migration
- Verify no data loss

**Migration logic**:

```typescript
// Idempotent: skip if already valid JSON
const needsMigration = (value: string) => {
  if (!value) return false;
  try {
    JSON.parse(value);
    return false;
  } catch {
    // Already JSON
    return value.includes("|");
  } // Pipe-delimited
};

const migrate = (value: string) =>
  JSON.stringify(value.split("|").filter(Boolean));
```

**Files**:

- `apps/scraper/src/migrations/001-pipe-to-json.ts` (new)

**Verification**:

- Pre-check count matches post-check count
- Random sample of migrated rows parse correctly
- App reads migrated data without errors

---

## Phase 9: Update AI Service

**Goal**: Use domain models, eliminate runPromise escapes

**Tasks**:

- Import `Phone` schema from `@repo/scraper-domain`
- Delete duplicate schemas (`NormalizedDataSchema`, etc.)
- Keep Vercel AI SDK (`@ai-sdk/google`)
- Wrap AI calls in Effect.tryPromise
- Return typed Effect, not Promise

**Files**:

- `apps/scraper/src/services/openai.ts`

**Verification**:

- AI normalization works end-to-end
- `npm run check-types` passes

---

## Phase 10: Update Scrape Service

**Goal**: Use new repositories, eliminate runPromise escapes

**Tasks**:

- Update scrape-kimovil.ts to use new PhoneRepo
- Replace `Effect.runPromise` calls with `yield*`
- Use `Effect.acquireRelease` for page lifecycle
- Stay in Effect context throughout

**Files**:

- `apps/scraper/src/services/scrape-kimovil.ts`

**Verification**:

- Full scrape works end-to-end
- No `Effect.runPromise` in service code
- `npm run check-types` passes

---

## Phase 11: Frontend Types

**Goal**: Share types with frontend without adding @effect/schema dependency

**Tasks**:

- Export plain TS types derived from domain models
- Update frontend to import from `@repo/scraper-domain`
- Remove duplicate type definitions in frontend

**Pattern**:

```typescript
// @repo/scraper-domain/index.ts
export type { Phone } from "./models/phone"; // Re-export as plain type
```

**Files**:

- `packages/scraper-domain/src/index.ts`
- `apps/ws-web/src/pages/slugs/types.ts` (simplify)

**Verification**:

- Frontend builds
- `npm run check-types` passes

---

## Phase 12: Structured Logging

**Goal**: Replace console.log with Effect.log\*

**Tasks**:

- Replace `console.log` → `Effect.logInfo`
- Replace `console.warn` → `Effect.logWarning`
- Replace `console.error` → `Effect.logError`
- Add structured annotations where useful
- Configure log output format

**Files**:

- All service files
- `apps/scraper/src/utils/logger.ts` (may delete or adapt)

**Verification**:

- Logs appear with proper levels
- `npm run check-types` passes

---

## Phase 13: Effect.Stream for WebSocket (Optional)

**Goal**: Replace AsyncGenerator with Effect.Stream for better backpressure

**Tasks**:

- Convert scrape progress events to Stream.Stream
- Update WebSocket handler to consume stream
- Add cancellation via Fiber interruption

**Files**:

- `apps/scraper/src/services/scrape-kimovil.ts`
- `apps/scraper/src/routes/ws.ts`

**Verification**:

- WebSocket progress works
- Cancellation works
- `npm run check-types` passes

---

## Final Verification Checklist

After all phases:

- [ ] Zero `Effect.runPromise` inside service implementations
- [ ] Zero `async/await` in services (except `Effect.tryPromise`)
- [ ] All resources use `acquireRelease`
- [ ] No browser leaks under error conditions
- [ ] All tests pass
- [ ] Full scrape pipeline works end-to-end
- [ ] Bulk job works end-to-end
- [ ] Frontend displays data correctly

---

## File Structure After Refactor

```
apps/scraper/src/
├── sql/
│   ├── client.ts           # SqlClient layer
│   ├── schema.ts           # Schema initialization
│   └── quarantine.ts       # Quarantine helpers
├── repositories/
│   └── phone.ts            # Model.makeRepository + custom queries
├── services/
│   ├── browser.ts          # With acquireRelease
│   ├── html-cache.ts       # SqlClient internals
│   ├── job-queue.ts        # SqlClient + transactions
│   ├── device.ts           # SqlClient internals
│   ├── phone-data.ts       # Uses PhoneRepo
│   ├── openai.ts           # Uses domain Phone type
│   ├── scrape-kimovil.ts   # Effect-native, no runPromise
│   └── ...
├── test/
│   ├── setup.ts            # Test harness
│   ├── phone-data.test.ts
│   ├── html-cache.test.ts
│   ├── job-queue.test.ts
│   └── device.test.ts
├── migrations/
│   └── 001-pipe-to-json.ts
└── layers/
    └── live.ts             # Updated with SqlClient

packages/scraper-domain/src/
├── models/
│   ├── phone.ts            # Phone, RawPhone, Camera, Sku, Benchmark
│   └── index.ts
├── services/
│   ├── scrape.ts
│   └── search.ts
└── index.ts                # Exports models + plain TS types
```

---

## Rollback Strategy

Since app is not live:

1. Keep `scraper-cache.sqlite.backup` before each phase
2. If phase fails badly: restore backup, revert code changes
3. No dual-write or feature flags needed

---

## Dependencies Between Phases

```
Phase 0 (Browser) ──────────────────────────────────┐
                                                    │
Phase 1 (Packages) ─→ Phase 2 (SqlClient) ─→ Phase 3 (Models)
                                                    │
                      ┌─────────────────────────────┤
                      ↓                             ↓
              Phase 4 (PhoneData)           Phase 5 (HtmlCache)
                      │                             │
                      ↓                             ↓
              Phase 6 (JobQueue)            Phase 7 (Device)
                      │                             │
                      └──────────┬──────────────────┘
                                 ↓
                      Phase 8 (Data Migration)
                                 │
                      ┌──────────┴──────────┐
                      ↓                     ↓
              Phase 9 (AI)          Phase 10 (Scrape)
                      │                     │
                      └──────────┬──────────┘
                                 ↓
                      Phase 11 (Frontend)
                                 │
                                 ↓
                      Phase 12 (Logging)
                                 │
                                 ↓
                      Phase 13 (Streams) [Optional]
```

Phase 0 can run in parallel with Phase 1-2.
Phases 4-7 can run in parallel after Phase 3.
