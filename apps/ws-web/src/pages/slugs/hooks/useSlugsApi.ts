import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type {
  Device,
  SlugsResponse,
  Stats,
  QueueItem,
  ScrapeStatus,
  ScrapeStats,
  FilterType,
  PhoneDataRaw,
  PhoneDataAi,
  PhoneDataResponse,
  PriceSummary,
  PriceHistory,
  PriceOffer,
  DeviceSource,
} from "../types";

export function useSlugsApi() {
  const [devices, setDevices] = createSignal<Device[]>([]);
  const [total, setTotal] = createSignal(0);
  const [filtered, setFiltered] = createSignal(0);
  const [scrapeStats, setScrapeStats] = createSignal<ScrapeStats | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [stats, setStats] = createSignal<Stats | null>(null);

  const [scrapeStatusStore, setScrapeStatusStore] = createStore<
    Record<string, ScrapeStatus>
  >({});
  const [queueStatusStore, setQueueStatusStore] = createStore<
    Record<string, QueueItem>
  >({});
  const [queueLoadingStore, setQueueLoadingStore] = createStore<
    Record<string, boolean>
  >({});

  const scrapeStatus = () => scrapeStatusStore;
  const queueStatus = () => queueStatusStore;
  const queueLoading = () => queueLoadingStore;

  const setScrapeStatus = (
    fn: (prev: Record<string, ScrapeStatus>) => Record<string, ScrapeStatus>,
  ) => {
    setScrapeStatusStore(reconcile(fn(scrapeStatusStore)));
  };
  const setQueueStatus = (
    fn: (prev: Record<string, QueueItem>) => Record<string, QueueItem>,
  ) => {
    setQueueStatusStore(reconcile(fn(queueStatusStore)));
  };
  const setQueueLoading = (
    fn: (prev: Record<string, boolean>) => Record<string, boolean>,
  ) => {
    setQueueLoadingStore(reconcile(fn(queueLoadingStore)));
  };

  const [verifyLoading, setVerifyLoading] = createSignal(false);
  const [clearLoading, setClearLoading] = createSignal(false);
  const [clearRawLoading, setClearRawLoading] = createSignal(false);
  const [clearAiLoading, setClearAiLoading] = createSignal(false);

  const fetchDevices = async (
    searchQuery: string = "",
    filterType: FilterType = "all",
    limit: number = 500,
  ) => {
    setLoading(true);
    try {
      let url = "http://localhost:1488/api/slugs";
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterType !== "all") params.set("filter", filterType);
      params.set("limit", String(limit));
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data: SlugsResponse = await res.json();
      setDevices(data.devices);
      setTotal(data.total);
      setFiltered(data.filtered);
      setScrapeStats(data.stats);

      if (data.devices.length > 0) {
        fetchScrapeStatus(data.devices.map((d) => d.slug));
      }

      return data.devices;
    } catch (error) {
      console.error("Failed to fetch devices:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("http://localhost:1488/api/slugs/stats");
      const data: Stats = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchQueueStatuses = async () => {
    try {
      const res = await fetch("http://localhost:1488/api/scrape/queue");
      const data = await res.json();
      const statusMap: Record<string, QueueItem> = {};
      for (const item of data.items || []) {
        if (
          !statusMap[item.slug] ||
          item.createdAt > statusMap[item.slug].createdAt
        ) {
          statusMap[item.slug] = item;
        }
      }
      setQueueStatus(() => statusMap);
    } catch (error) {
      console.error("Failed to fetch queue statuses:", error);
    }
  };

  const fetchScrapeStatus = async (slugs: string[]) => {
    if (slugs.length === 0) return;
    const BATCH_SIZE = 200;
    const batches: string[][] = [];
    for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
      batches.push(slugs.slice(i, i + BATCH_SIZE));
    }
    try {
      const results = await Promise.all(
        batches.map(async (batch) => {
          const res = await fetch(
            `http://localhost:1488/api/v2/devices/bulk-status?slugs=${batch.join(",")}&source=kimovil`,
          );
          return res.json() as Promise<Record<string, ScrapeStatus>>;
        }),
      );
      const merged = results.reduce((acc, data) => ({ ...acc, ...data }), {});
      setScrapeStatus((prev) => ({ ...prev, ...merged }));
    } catch (error) {
      console.error("Failed to fetch scrape status:", error);
    }
  };

  const queueScrape = async (slug: string, mode: "fast" | "complex") => {
    setQueueLoading((prev) => ({ ...prev, [slug]: true }));
    try {
      const res = await fetch("http://localhost:1488/api/scrape/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, mode }),
      });
      const item = await res.json();
      if (item.id) {
        setQueueStatus((prev) => ({ ...prev, [slug]: item }));
      }
    } catch (error) {
      console.error("Failed to queue scrape:", error);
    } finally {
      setQueueLoading((prev) => ({ ...prev, [slug]: false }));
    }
  };

  const verifyBulk = async (slugs: string[]) => {
    const status = scrapeStatus();
    const slugsToVerify = slugs.filter((slug) => status[slug]?.hasHtml);

    if (slugsToVerify.length === 0) {
      alert("No selected items have scraped data to verify");
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await fetch("http://localhost:1488/api/scrape/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: slugsToVerify }),
      });
      const data = await res.json();

      if (data.results) {
        setScrapeStatus((prev) => {
          const next = { ...prev };
          for (const [slug, result] of Object.entries(data.results) as [
            string,
            { isCorrupted: boolean; reason: string | null },
          ][]) {
            if (next[slug]) {
              next[slug] = {
                ...next[slug],
                isCorrupted: result.isCorrupted,
                corruptionReason: result.reason,
              };
            }
          }
          return next;
        });
      }

      if (data.summary) {
        alert(
          `Verified ${data.summary.total} items:\n✓ Valid: ${data.summary.valid}\n✗ Corrupted: ${data.summary.corrupted}`,
        );
      }

      return data;
    } catch (error) {
      console.error("Failed to verify:", error);
    } finally {
      setVerifyLoading(false);
    }
  };

  const clearScrapeData = async (slug: string) => {
    if (!confirm(`Clear all scrape data for "${slug}"?`)) return;

    try {
      await fetch(
        `http://localhost:1488/api/v2/devices/${encodeURIComponent(slug)}/sources/kimovil/html`,
        { method: "DELETE" },
      );
      setScrapeStatus((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      setQueueStatus((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    } catch (error) {
      console.error("Failed to clear scrape data:", error);
    }
  };

  const clearBulk = async (slugs: string[]) => {
    const status = scrapeStatus();
    const slugsToClear = slugs.filter((slug) => status[slug]?.hasHtml);

    if (slugsToClear.length === 0) {
      alert("No selected items have scraped data to clear");
      return false;
    }

    if (!confirm(`Clear scrape data for ${slugsToClear.length} items?`))
      return false;

    setClearLoading(true);
    try {
      await fetch("http://localhost:1488/api/v2/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "clear_html",
          slugs: slugsToClear,
          source: "kimovil",
        }),
      });
      for (const slug of slugsToClear) {
        setScrapeStatus((prev) => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
        setQueueStatus((prev) => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
      }
    } catch (error) {
      console.error("Failed to clear bulk:", error);
    }
    setClearLoading(false);
    return true;
  };

  const openPreview = async (
    slug: string,
  ): Promise<{ html: string | null; error?: string }> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/v2/devices/${encodeURIComponent(slug)}/sources/kimovil/html`,
      );
      const data = await res.json();
      return { html: data.html || null };
    } catch (error) {
      console.error("Failed to fetch HTML:", error);
      return { html: null, error: "Failed to fetch HTML" };
    }
  };

  const fetchPhoneDataRaw = async (
    slug: string,
  ): Promise<PhoneDataRaw | null> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/v2/devices/${encodeURIComponent(slug)}/sources/kimovil/raw-data/specs`,
      );
      const data: PhoneDataResponse<PhoneDataRaw> = await res.json();
      return data.data;
    } catch (error) {
      console.error("Failed to fetch raw phone data:", error);
      return null;
    }
  };

  const fetchPhoneDataAi = async (
    slug: string,
  ): Promise<PhoneDataAi | null> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/v2/devices/${encodeURIComponent(slug)}/data/specs`,
      );
      const data: PhoneDataResponse<PhoneDataAi> = await res.json();
      return data.data;
    } catch (error) {
      console.error("Failed to fetch AI phone data:", error);
      return null;
    }
  };

  // Process raw data from cached HTML
  const processRaw = async (
    slug: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("http://localhost:1488/api/process/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.success) {
        setScrapeStatus((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], hasRawData: true },
        }));
        return { success: true };
      }
      return { success: false, error: data.error || "Unknown error" };
    } catch (error) {
      console.error("Failed to process raw data:", error);
      const message = error instanceof Error ? error.message : "Network error";
      return { success: false, error: message };
    }
  };

  // Process AI normalization from raw data
  const processAi = async (
    slug: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("http://localhost:1488/api/process/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.success) {
        setScrapeStatus((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], hasAiData: true },
        }));
        return { success: true };
      }
      return { success: false, error: data.error || "Unknown error" };
    } catch (error) {
      console.error("Failed to process AI data:", error);
      const message = error instanceof Error ? error.message : "Network error";
      return { success: false, error: message };
    }
  };

  const clearRawData = async (slug: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/v2/devices/${encodeURIComponent(slug)}/sources/kimovil/raw-data/specs`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.success) {
        setScrapeStatus((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], hasRawData: false },
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to clear raw data:", error);
      return false;
    }
  };

  const clearAiData = async (slug: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/v2/devices/${encodeURIComponent(slug)}/data/specs`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.success) {
        setScrapeStatus((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], hasAiData: false },
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to clear AI data:", error);
      return false;
    }
  };

  const clearRawBulk = async (slugs: string[]): Promise<number> => {
    const status = scrapeStatus();
    const slugsToClear = slugs.filter((slug) => status[slug]?.hasRawData);

    if (slugsToClear.length === 0) return 0;

    setClearRawLoading(true);
    try {
      await fetch("http://localhost:1488/api/v2/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "clear_raw",
          slugs: slugsToClear,
          source: "kimovil",
          dataKind: "specs",
        }),
      });
      for (const slug of slugsToClear) {
        setScrapeStatus((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], hasRawData: false },
        }));
      }
    } catch (error) {
      console.error("Failed to clear raw bulk:", error);
    }
    setClearRawLoading(false);
    return slugsToClear.length;
  };

  const clearAiBulk = async (slugs: string[]): Promise<number> => {
    const status = scrapeStatus();
    const slugsToClear = slugs.filter((slug) => status[slug]?.hasAiData);

    if (slugsToClear.length === 0) return 0;

    setClearAiLoading(true);
    try {
      await fetch("http://localhost:1488/api/v2/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "clear_processed",
          slugs: slugsToClear,
          source: "kimovil",
          dataKind: "specs",
        }),
      });
      for (const slug of slugsToClear) {
        setScrapeStatus((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], hasAiData: false },
        }));
      }
    } catch (error) {
      console.error("Failed to clear AI bulk:", error);
    }
    setClearAiLoading(false);
    return slugsToClear.length;
  };

  const fetchPrices = async (deviceId: string): Promise<PriceSummary | null> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/prices/${encodeURIComponent(deviceId)}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      return null;
    }
  };

  const fetchPriceHistory = async (
    deviceId: string,
    days: number = 30,
  ): Promise<PriceHistory | null> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/prices/${encodeURIComponent(deviceId)}/history?days=${days}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch price history:", error);
      return null;
    }
  };

  const fetchAllQuotes = async (
    slug: string,
    source?: string,
    externalId?: string,
  ): Promise<PriceOffer[]> => {
    try {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (externalId) params.set("externalId", externalId);
      const res = await fetch(
        `http://localhost:1488/api/prices/${encodeURIComponent(slug)}/quotes?${params}`,
      );
      if (!res.ok) return [];
      return await res.json();
    } catch (error) {
      console.error("Failed to fetch all quotes:", error);
      return [];
    }
  };

  const fetchDeviceSources = async (
    slug: string,
    source?: string,
  ): Promise<DeviceSource[]> => {
    const url = source
      ? `http://localhost:1488/api/device-sources/${encodeURIComponent(slug)}?source=${encodeURIComponent(source)}`
      : `http://localhost:1488/api/device-sources/${encodeURIComponent(slug)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    } catch (error) {
      console.error("Failed to fetch device sources:", error);
      return [];
    }
  };

  return {
    devices,
    total,
    filtered,
    scrapeStats,
    loading,
    stats,
    queueStatus,
    scrapeStatus,
    queueLoading,
    verifyLoading,
    clearLoading,
    clearRawLoading,
    clearAiLoading,
    setScrapeStatus,
    fetchDevices,
    fetchStats,
    fetchQueueStatuses,
    fetchScrapeStatus,
    queueScrape,
    verifyBulk,
    clearScrapeData,
    clearBulk,
    clearRawData,
    clearAiData,
    clearRawBulk,
    clearAiBulk,
    openPreview,
    fetchPhoneDataRaw,
    fetchPhoneDataAi,
    processRaw,
    processAi,
    fetchPrices,
    fetchPriceHistory,
    fetchAllQuotes,
    fetchDeviceSources,
  };
}
