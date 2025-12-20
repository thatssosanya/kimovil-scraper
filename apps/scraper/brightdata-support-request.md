# Scraping Browser CDP Connection Timeout

## Issue
CDP WebSocket connections to Scraping Browser hang indefinitely after successful authentication. No browser is provisioned.

## Account Details
- **Customer ID:** `hl_16d88626`
- **Affected Zones:** `cata_2025`, `catalogue_scraper` (both `browser_api` type)
- **Whitelisted IP:** `95.90.211.52` (confirmed via API)

## Observed Behavior

| Scenario | Result |
|----------|--------|
| No auth | 401 Unauthorized (immediate) |
| Wrong password | 407 Auth Failed (immediate) |
| Correct credentials | Hangs until timeout (40-120s) |

Connection never completes - stays at WebSocket handshake stage.

## Endpoint Tested
```
wss://brd-customer-hl_16d88626-zone-cata_2025:ddi199dfkhcp@brd.superproxy.io:9222
```

## Test Code (Playwright)
```javascript
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP(
  'wss://brd-customer-hl_16d88626-zone-cata_2025:ddi199dfkhcp@brd.superproxy.io:9222',
  { timeout: 40000 }
);
// Result: TimeoutError after 40s, never connects
```

## What We Verified
1. Zone exists and is active (confirmed via `/zone?zone=cata_2025`)
2. Password matches API response
3. IP `95.90.211.52` is in whitelist
4. Account has recent usage (~$0.04 this month)
5. TLS handshake succeeds (verified via curl)
6. Same issue on both zones with correct credentials

## Environment
- Playwright 1.57.0
- macOS / Bun runtime
- Date: 2025-12-19

## Expected
Browser should provision and return CDP endpoint within ~10-30s.

## Actual
Connection hangs at WebSocket stage, times out with no response.
