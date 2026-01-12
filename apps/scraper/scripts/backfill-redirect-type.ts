/**
 * Backfill redirect_type in price_quotes from raw entity_data_raw
 * 
 * The raw data structure is:
 * { query, search: { items: [{ id, redirectTarget, ... }] }, fetchedAt }
 * 
 * We match quotes by offer_id (from raw item.id)
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "..", "scraper-cache.sqlite");
const db = new Database(dbPath);

interface RawItem {
  id: number;
  redirectTarget?: string;
}

interface RawData {
  search?: {
    items?: RawItem[];
  };
}

// Get all raw data for price_ru prices
const rawRows = db.prepare(`
  SELECT device_id, data 
  FROM entity_data_raw 
  WHERE source = 'price_ru' AND data_kind = 'prices'
`).all() as { device_id: string; data: string }[];

console.log(`Found ${rawRows.length} raw data records`);

// Build a map: device_id + offer_id -> redirect_target
const redirectMap = new Map<string, string>();

for (const row of rawRows) {
  try {
    const data = JSON.parse(row.data) as RawData;
    const items = data.search?.items ?? [];
    for (const item of items) {
      if (item.id && item.redirectTarget) {
        const key = `${row.device_id}:${item.id}`;
        redirectMap.set(key, item.redirectTarget);
      }
    }
  } catch (e) {
    console.error(`Failed to parse raw data for device ${row.device_id}:`, e);
  }
}

console.log(`Built redirect map with ${redirectMap.size} entries`);

// Get quotes with NULL redirect_type
const nullQuotes = db.prepare(`
  SELECT id, device_id, offer_id 
  FROM price_quotes 
  WHERE source = 'price_ru' AND redirect_type IS NULL AND offer_id IS NOT NULL
`).all() as { id: number; device_id: string; offer_id: string }[];

console.log(`Found ${nullQuotes.length} quotes with NULL redirect_type`);

// Update quotes
const updateStmt = db.prepare(`
  UPDATE price_quotes SET redirect_type = ? WHERE id = ?
`);

let updated = 0;
let notFound = 0;

db.transaction(() => {
  for (const quote of nullQuotes) {
    const key = `${quote.device_id}:${quote.offer_id}`;
    const redirectType = redirectMap.get(key);
    if (redirectType) {
      updateStmt.run(redirectType, quote.id);
      updated++;
    } else {
      notFound++;
    }
  }
})();

console.log(`Updated ${updated} quotes, ${notFound} not found in raw data`);

// Verify
const remaining = db.prepare(`
  SELECT COUNT(*) as count FROM price_quotes WHERE source = 'price_ru' AND redirect_type IS NULL
`).get() as { count: number };

console.log(`Remaining NULL redirect_type: ${remaining.count}`);

db.close();
