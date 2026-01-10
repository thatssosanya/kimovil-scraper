# Device Image Migration Plan

## Overview

Migrate ~6,500 device images from Kimovil CDN to Yandex Object Storage, enabling:
- Self-hosted images with CDN delivery
- Future image processing pipeline integration
- Yandex Market image extraction for new devices

## Current State

### imageExtractor Project (`~/projects/imageExtractor`)
- **6,461 total images** from Kimovil
  - 500 upscaled/optimized to AVIF (`data/optimized/kimovil/specs/{slug}/0-hq.avif`)
  - 5,961 downloaded but unprocessed (`data/original/`)
- SQLite database tracks all images with metadata
- Reads from scraper's `entity_data_raw` for source URLs

### Scraper App (`apps/scraper`)
- Images stored as URLs in `entity_data_raw` JSON (kimovil specs → `images[]`)
- `WidgetDataService` reads `images[0]` for widget display
- Currently uses Kimovil CDN URLs (`cdn.kimovil.com/...`)
- New devices via widget debug have **no images**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Image Migration Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  imageExtractor/                    Yandex Object Storage                │
│  ┌──────────────────┐              ┌─────────────────────────┐          │
│  │ data/optimized/  │─── upload ──▶│ optimized/{source}/     │          │
│  │ data/original/   │─── upload ──▶│   specs/{slug}/0-hq.avif│          │
│  └──────────────────┘              │ original/{source}/      │          │
│                                    │   specs/{slug}/0.{ext}  │          │
│                                    └──────────┬──────────────┘          │
│                                               │                          │
│  apps/scraper/                                │ CDN URL                  │
│  ┌────────────────────────────────────────────▼──────────────────────┐  │
│  │ device_images table                                                │  │
│  │ ┌────────────┬────────┬─────────┬───────────┬──────────────────┐  │  │
│  │ │ device_id  │ source │ variant │ cdn_url   │ original_url     │  │  │
│  │ ├────────────┼────────┼─────────┼───────────┼──────────────────┤  │  │
│  │ │ dev-abc123 │kimovil │optimized│cdn.../... │cdn.kimovil.com...│  │  │
│  │ └────────────┴────────┴─────────┴───────────┴──────────────────┘  │  │
│  │                                                                    │  │
│  │ WidgetDataService                                                  │  │
│  │ ┌──────────────────────────────────────────────────────────────┐  │  │
│  │ │ specs.image = device_images.cdn_url ?? entity_data.images[0] │  │  │
│  │ └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Yandex Cloud Setup (Manual)

### Prerequisites
1. Yandex Cloud account with billing enabled
2. Access to [console.yandex.cloud](https://console.yandex.cloud/)

### Steps

#### 1. Create Service Account
```
Console → IAM → Service Accounts → Create
- Name: cod-storage-writer
- Roles: storage.editor
```

#### 2. Create Static Access Key
```
Service Account → Create new key → Static access key
Save:
- key_id: <ACCESS_KEY_ID>
- secret: <SECRET_ACCESS_KEY>
```

#### 3. Create Bucket
```
Console → Object Storage → Create bucket
- Name: cod-device-images
- Default storage class: Standard
- Public access: Public (or configure CDN)
- Region: ru-central1
```

#### 4. Configure CDN (Optional but recommended)
```
Console → Cloud CDN → Create CDN resource
- Origin: cod-device-images.storage.yandexcloud.net
- Custom domain: cdn.click-or-die.ru (requires DNS CNAME)
```

### Environment Variables
Add to `apps/scraper/.env`:
```env
# Yandex Object Storage
YA_S3_BUCKET=cod-device-images
YA_S3_ENDPOINT=https://storage.yandexcloud.net
YA_S3_REGION=ru-central1
YA_S3_ACCESS_KEY=<key_id>
YA_S3_SECRET_KEY=<secret>
CDN_BASE_URL=https://storage.yandexcloud.net/cod-device-images
# Or if using CDN: CDN_BASE_URL=https://cdn.click-or-die.ru
```

---

## Phase 1: Schema Changes

### New Tables

#### `device_images` - Normalized image storage
```sql
CREATE TABLE IF NOT EXISTS device_images (
  device_id    TEXT NOT NULL REFERENCES devices(id),
  source       TEXT NOT NULL,                  -- 'kimovil', 'yandex_market'
  kind         TEXT NOT NULL,                  -- 'primary', 'gallery'
  image_index  INTEGER NOT NULL DEFAULT 0,
  variant      TEXT NOT NULL DEFAULT 'optimized', -- 'original' | 'optimized'
  storage_key  TEXT NOT NULL,                  -- S3 object key
  cdn_url      TEXT NOT NULL,                  -- Public CDN URL
  original_url TEXT,                           -- Original source URL
  width        INTEGER,
  height       INTEGER,
  format       TEXT,                           -- 'avif', 'jpg', 'png'
  status       TEXT NOT NULL DEFAULT 'uploaded'
               CHECK (status IN ('pending', 'uploaded', 'error')),
  last_error   TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (device_id, source, kind, image_index, variant)
);

CREATE INDEX IF NOT EXISTS idx_device_images_device ON device_images(device_id);
CREATE INDEX IF NOT EXISTS idx_device_images_status ON device_images(status);
```

#### `entity_data_raw_backup` - Rollback safety
```sql
CREATE TABLE IF NOT EXISTS entity_data_raw_backup (
  device_id    TEXT NOT NULL,
  source       TEXT NOT NULL,
  data_kind    TEXT NOT NULL,
  data         TEXT NOT NULL,
  backed_up_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (device_id, source, data_kind)
);
```

---

## Phase 2: StorageService (Effect Layer)

### Package Installation
```bash
cd apps/scraper
npm install @effect-aws/client-s3 @aws-sdk/client-s3
```

### Service Interface
```typescript
// apps/scraper/src/services/storage.ts
import { S3 } from "@effect-aws/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { Effect, Layer, Context, Data } from "effect";

export class StorageError extends Data.TaggedError("StorageError")<{
  message: string;
  key?: string;
  cause?: unknown;
}> {}

export interface StorageService {
  readonly putObject: (input: {
    key: string;
    contentType: string;
    body: Buffer;
  }) => Effect.Effect<void, StorageError>;
  readonly publicUrl: (key: string) => string;
}

export const StorageService = Context.GenericTag<StorageService>("StorageService");

// Yandex S3 Layer
export const YandexS3Layer = S3.baseLayer(() => new S3Client({
  region: process.env.YA_S3_REGION ?? "ru-central1",
  endpoint: process.env.YA_S3_ENDPOINT ?? "https://storage.yandexcloud.net",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.YA_S3_ACCESS_KEY!,
    secretAccessKey: process.env.YA_S3_SECRET_KEY!,
  },
}));
```

---

## Phase 3: ImageMigrationService

### Features
- **Resumable**: Skips already-uploaded images (`status='uploaded'`)
- **Retries**: Exponential backoff for transient S3 failures
- **Progress**: Logs progress every N images
- **Idempotent**: Deterministic S3 keys, upsert to `device_images`

### Key Layout
```
optimized/kimovil/specs/{slug}/0-hq.avif   ← From data/optimized/
original/kimovil/specs/{slug}/0.{ext}      ← From data/original/
```

### Algorithm
```
FOR each image in imageExtractor DB:
  1. Resolve device_id from devices.slug
  2. Check device_images for existing upload (skip if status='uploaded')
  3. Read file from local path
  4. Upload to S3 with retry (up to 3 attempts, exponential backoff)
  5. Upsert device_images row with cdn_url
  6. Log progress
```

---

## Phase 4: Migration Script

### Execution Order
1. **Upload optimized images first** (500 AVIF files)
2. **Upload original images** (5,961 files, various formats)

### CLI
```bash
cd apps/scraper
npx tsx scripts/migrate-images.ts --phase optimized --dry-run
npx tsx scripts/migrate-images.ts --phase optimized
npx tsx scripts/migrate-images.ts --phase original --concurrency 8
```

---

## Phase 5: Update entity_data_raw URLs

### Per-Device Transaction
```
FOR each device with entity_data_raw (kimovil specs):
  BEGIN TRANSACTION
    1. INSERT OR IGNORE into entity_data_raw_backup
    2. Parse specs JSON
    3. For each images[i], lookup cdn_url from device_images
    4. Replace URL if found
    5. UPDATE entity_data_raw with new JSON
  COMMIT
```

### Rollback
```sql
-- Restore original URLs from backup
UPDATE entity_data_raw 
SET data = (SELECT data FROM entity_data_raw_backup WHERE ...)
WHERE ...;
```

---

## Phase 6: Update WidgetDataService

### Current Query
```sql
SELECT d.*, edr.data as specs_data
FROM devices d
LEFT JOIN entity_data_raw edr ON ...
WHERE d.slug = ?
```

### New Query (with device_images fallback)
```sql
SELECT 
  d.*,
  edr.data as specs_data,
  di.cdn_url as primary_image
FROM devices d
LEFT JOIN entity_data_raw edr 
  ON edr.device_id = d.id 
  AND edr.source = 'kimovil' 
  AND edr.data_kind = 'specs'
LEFT JOIN device_images di
  ON di.device_id = d.id
  AND di.kind = 'primary'
  AND di.variant = 'optimized'
  AND di.status = 'uploaded'
WHERE d.slug = ?
```

### Image Resolution Order
1. `device_images.cdn_url` (our CDN)
2. `entity_data_raw.images[0]` (Kimovil fallback)
3. `null` (no image)

---

## Phase 7: Yandex Image Extraction (Future)

### Add to `extractor.ts`
```typescript
export function extractYandexImage(html: string): string | null {
  // 1. Try LD+JSON Product.image
  // 2. Try og:image meta tag
  // 3. Try product gallery selectors
}
```

### Integration
- Extract during `yandex.scrape` WebSocket handler
- Save to `device_images` with `source='yandex_market'`
- Widget will pick up via same fallback logic

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| S3 upload failures | Exponential retry + status tracking for resume |
| Corrupted uploads | Verify file size/hash after upload |
| Broken URLs in prod | Backup table for instant rollback |
| CDN misconfiguration | Test with staging bucket first |
| Slug mismatch between DBs | Resolve device_id from scraper DB, log mismatches |

---

## Success Criteria

- [ ] All 500 optimized AVIF files uploaded to Yandex S3
- [ ] All 5,961 original files uploaded to Yandex S3
- [ ] `device_images` table populated with correct cdn_urls
- [ ] `entity_data_raw` URLs updated to CDN URLs
- [ ] Widget displays images from our CDN
- [ ] Backup table contains original Kimovil URLs
- [ ] No broken images in production

---

## Beads Issue Tracking

Epic: `cod-xxx` - Device Image Migration to Yandex S3

Subtasks:
1. Schema changes (device_images, backup table)
2. StorageService with @effect-aws/client-s3
3. ImageMigrationService (upload logic)
4. Migration script (CLI runner)
5. Update entity_data_raw URLs
6. Update WidgetDataService
7. Yandex image extraction (future)
