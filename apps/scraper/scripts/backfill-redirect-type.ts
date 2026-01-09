#!/usr/bin/env npx tsx
/**
 * Backfill redirect_type for existing Price.ru price_quotes
 * 
 * Uses entity_data_raw to extract redirectTarget and updates price_quotes by offer_id.
 */

import Database from "better-sqlite3";

interface RawPriceData {
  query: string;
  search: {
    items: Array<{
      id: number;
      name: string;
      redirectTarget: "to_merchant" | "to_price";
    }>;
  };
}

const db = new Database("scraper-cache.sqlite");

const rawRows = db.prepare(`
  SELECT device_id, data 
  FROM entity_data_raw 
  WHERE source = 'price_ru' AND data_kind = 'prices'
`).all() as Array<{ device_id: string; data: string }>;

console.log(`Found ${rawRows.length} raw data entries to process`);

let updatedCount = 0;
let skippedCount = 0;

const updateStmt = db.prepare(`
  UPDATE price_quotes 
  SET redirect_type = ? 
  WHERE source = 'price_ru' AND offer_id = ? AND redirect_type IS NULL
`);

for (const row of rawRows) {
  try {
    const data = JSON.parse(row.data) as RawPriceData;
    
    for (const item of data.search.items) {
      const result = updateStmt.run(item.redirectTarget, String(item.id));
      if (result.changes > 0) {
        updatedCount += result.changes;
      } else {
        skippedCount++;
      }
    }
  } catch (e) {
    console.error(`Failed to parse data for device ${row.device_id}:`, e);
  }
}

console.log(`Updated ${updatedCount} price_quotes`);
console.log(`Skipped ${skippedCount} (already set or not found)`);

// Verify
const remaining = db.prepare(`
  SELECT COUNT(*) as cnt FROM price_quotes 
  WHERE source = 'price_ru' AND redirect_type IS NULL
`).get() as { cnt: number };

console.log(`Remaining NULL redirect_type: ${remaining.cnt}`);

db.close();
