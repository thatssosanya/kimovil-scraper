# Scraper Job Architecture Improvements

## Current Issues

### 1. ✅ FIXED: Data Format Mismatch
- **Problem**: Scraper sends arrays, catalogue expected strings
- **Solution**: Updated `PhoneData` interface and added `joinArray()` adapter in `phoneDataToDeviceSpecs()`

### 2. Fire-and-Forget Pattern (TODO)
**Problem**: `void service.getClient().search(...)` means catalogue has no way to know if request reached scraper.

**Current flow**:
```
catalogue: startScrape → set step="searching" → void search() → hope for events
```

**Proposed flow**:
```
catalogue: startScrape → set step="searching", dispatchedAt=now → await search() with ack timeout → if no ack, mark interrupted
```

### 3. In-Memory Closure Correlation (TODO)
**Problem**: `deviceId` is only known via closure in `.then()` handler. Lost on restart.

**Solution options**:
1. **Use deviceId as WS request ID** - Parse it from `event.id`
2. **Store scraperRequestId in DB** - `search:{deviceId}:{attempt}`
3. **Pass deviceId in params** - Scraper echoes it back in events

### 4. No Reconciliation on Reconnect (TODO)
**Problem**: When WebSocket reconnects, active jobs aren't re-dispatched.

**Proposed solution**:
```typescript
// In ScraperWSService after successful reconnect:
async reconcileActiveJobs() {
  const activeJobs = await jobStore.getActiveJobs();
  for (const job of activeJobs) {
    if (isStale(job)) {
      await jobStore.markAsInterrupted(job.deviceId);
    } else {
      await redispatch(job);
    }
  }
}
```

## Proposed Schema Changes

Add to `scrapeJob` table:
```sql
ALTER TABLE scrape_job ADD COLUMN scraper_request_id TEXT;
ALTER TABLE scrape_job ADD COLUMN dispatched_at TEXT;
ALTER TABLE scrape_job ADD COLUMN acknowledged_at TEXT;
```

## Implementation Priority

1. **High**: Add reconciliation on WS reconnect (prevents stuck jobs)
2. **Medium**: Add request correlation via request ID
3. **Low**: Add dispatch acknowledgment timeout

## Quick Win: Reconciliation Hook

```typescript
// apps/catalogue/src/server/services/scraper-ws/index.ts

async initialize(maxRetries = 10, retryDelayMs = 2000): Promise<void> {
  // ... existing retry logic ...
  
  // After successful connection, reconcile active jobs
  await this.reconcileActiveJobs();
}

private async reconcileActiveJobs(): Promise<void> {
  const { jobManager } = await import("@/src/server/services/job-manager");
  const activeJobs = await jobManager.getActiveJobs();
  
  for (const job of activeJobs) {
    const staleTimeout = JOB_TIMEOUTS[job.step as keyof typeof JOB_TIMEOUTS];
    const isStale = Date.now() - job.updatedAt.getTime() > staleTimeout;
    
    if (isStale) {
      await jobManager.updateJob(job.deviceId, {
        step: "interrupted",
        error: "Connection recovered but job timed out",
      });
    }
    // Note: We don't re-dispatch automatically to avoid duplicate work
    // User can retry manually
  }
}
```

## Alternative: Scraper-Owned Jobs

Instead of catalogue owning job state, scraper could own it:
- Catalogue sends "createJob" to scraper
- Scraper stores job in its DB with catalogue's deviceId
- Scraper sends events that catalogue just forwards to UI
- On restart, scraper knows about its own jobs

**Pros**: Single source of truth, naturally restart-proof
**Cons**: More coupling, requires scraper changes, harder to extend to other scrapers
