import type { DataKind } from "./device";

// Entity data stored in entity_data_raw and entity_data tables
export interface EntityDataRaw {
  deviceId: string;
  source: string;
  dataKind: DataKind;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// Final entity data (entity_data table - note: no source, merged across sources)
export interface EntityData {
  deviceId: string;
  dataKind: DataKind;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// Price quote from price_quotes table
export interface PriceQuote {
  id: number;
  deviceId: string;
  source: string;
  externalId: string;
  sku: string | null;
  price: number;
  currency: string;
  shopName: string | null;
  shopUrl: string | null;
  inStock: boolean | null;
  scrapedAt: number;
  createdAt: number;
}
