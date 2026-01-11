import type {
  MappingContext,
  MappingStatus,
  MappingsResponse,
  DeviceSearchResult,
  SyncStatus,
  PriceInfo,
  ScrapeResult,
  CatalogueLink,
  WidgetMapping,
} from "../pages/widgets/WidgetDebug.types";

export const API_BASE = "http://localhost:1488";

export interface MappingUpdate {
  deviceId?: string | null;
  status?: MappingStatus;
}

export interface GetMappingsParams {
  limit?: number;
  status?: string;
  seenAfter?: number;
  seenBefore?: number;
}

export interface CreateDevicePayload {
  slug: string;
  name: string;
  brand: string | null;
}

export interface CreatedDevice {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
}

export async function getMappingContext(rawModel: string): Promise<MappingContext> {
  const res = await fetch(
    `${API_BASE}/api/widget-mappings/${encodeURIComponent(rawModel)}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchDevices(query: string, limit = 10): Promise<DeviceSearchResult[]> {
  const res = await fetch(
    `${API_BASE}/api/widget-mappings/devices/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateMapping(
  rawModel: string,
  update: MappingUpdate
): Promise<unknown> {
  const res = await fetch(
    `${API_BASE}/api/widget-mappings/${encodeURIComponent(rawModel)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
      credentials: "include",
    }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getMappingById(id: number): Promise<WidgetMapping | null> {
  const res = await fetch(`${API_BASE}/api/widget-mappings/by-id/${id}`, {
    credentials: "include",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getMappingByRawModel(rawModel: string, source = "wordpress"): Promise<WidgetMapping | null> {
  const params = new URLSearchParams({ raw_model: rawModel, source });
  const res = await fetch(`${API_BASE}/api/widget-mappings/by-raw-model?${params}`, {
    credentials: "include",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getMappings(params: GetMappingsParams = {}): Promise<MappingsResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.status) searchParams.set("status", params.status);
  if (params.seenAfter) searchParams.set("seenAfter", String(params.seenAfter));
  if (params.seenBefore) searchParams.set("seenBefore", String(params.seenBefore));
  
  const queryString = searchParams.toString();
  const url = `${API_BASE}/api/widget-mappings${queryString ? `?${queryString}` : ""}`;
  
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const res = await fetch(`${API_BASE}/api/widget-debug/sync-status`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function triggerSync(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/widget-debug/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function getPriceInfo(deviceId: string): Promise<PriceInfo> {
  const res = await fetch(`${API_BASE}/api/widget-mappings/prices/${deviceId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function scrapePriceRu(deviceId: string): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/api/widget-mappings/scrape/price-ru/${deviceId}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function scrapeYandex(deviceId: string, url: string): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/api/widget-mappings/scrape/yandex/${deviceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getCatalogueLinks(slug: string): Promise<CatalogueLink[]> {
  const res = await fetch(
    `${API_BASE}/api/widget-mappings/catalogue-links/${encodeURIComponent(slug)}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.links;
}

export async function createDevice(payload: CreateDevicePayload): Promise<CreatedDevice> {
  const res = await fetch(`${API_BASE}/api/widget-mappings/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getWidgetHtml(slug: string, bustCache = false): Promise<string | null> {
  if (bustCache) {
    await invalidateWidgetCache(slug);
  }
  const cacheBuster = bustCache ? `&_t=${Date.now()}` : "";
  const res = await fetch(
    `${API_BASE}/widget/v1/price/${encodeURIComponent(slug)}?theme=dark${cacheBuster}`,
    bustCache ? { cache: "no-store" } : undefined
  );
  if (!res.ok) return null;
  const html = await res.text();
  return html || null;
}

export async function invalidateWidgetCache(slug: string): Promise<void> {
  await fetch(`${API_BASE}/widget/v1/invalidate/${encodeURIComponent(slug)}`, {
    method: "POST",
  }).catch(() => {});
}

export async function excludePriceQuote(
  deviceId: string,
  source: string,
  externalId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/api/v2/prices/${deviceId}/exclude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, externalId, reason }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface BulkDeviceStatus {
  hasHtml: boolean;
  hasRawData: boolean;
  hasAiData: boolean;
  isCorrupted: boolean | null;
  corruptionReason: string | null;
  priceSourceCount: number;
  hasPrices: boolean;
  hasPriceRuLink: boolean;
  priceCount: number;
}

export async function getBulkDeviceStatus(
  slugs: string[],
  source = "kimovil"
): Promise<Record<string, BulkDeviceStatus>> {
  if (slugs.length === 0) return {};
  const res = await fetch(
    `${API_BASE}/api/v2/devices/bulk-status?slugs=${slugs.join(",")}&source=${source}`,
    { credentials: "include" }
  );
  if (!res.ok) return {};
  return res.json();
}
