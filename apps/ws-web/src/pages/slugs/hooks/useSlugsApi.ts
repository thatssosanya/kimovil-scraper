import { createSignal } from "solid-js";
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
} from "../types";

export function useSlugsApi() {
  const [devices, setDevices] = createSignal<Device[]>([]);
  const [total, setTotal] = createSignal(0);
  const [filtered, setFiltered] = createSignal(0);
  const [scrapeStats, setScrapeStats] = createSignal<ScrapeStats | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [queueStatus, setQueueStatus] = createSignal<Record<string, QueueItem>>(
    {},
  );
  const [scrapeStatus, setScrapeStatus] = createSignal<
    Record<string, ScrapeStatus>
  >({});
  const [queueLoading, setQueueLoading] = createSignal<Record<string, boolean>>(
    {},
  );
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
      setQueueStatus(statusMap);
    } catch (error) {
      console.error("Failed to fetch queue statuses:", error);
    }
  };

  const fetchScrapeStatus = async (slugs: string[]) => {
    if (slugs.length === 0) return;
    // Batch into chunks to avoid URL length limits
    const BATCH_SIZE = 200;
    const batches: string[][] = [];
    for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
      batches.push(slugs.slice(i, i + BATCH_SIZE));
    }
    try {
      const results = await Promise.all(
        batches.map(async (batch) => {
          const res = await fetch(
            `http://localhost:1488/api/scrape/status?slugs=${batch.join(",")}`,
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
        `http://localhost:1488/api/scrape/html/${encodeURIComponent(slug)}`,
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
    for (const slug of slugsToClear) {
      try {
        await fetch(
          `http://localhost:1488/api/scrape/html/${encodeURIComponent(slug)}`,
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
        console.error(`Failed to clear ${slug}:`, error);
      }
    }
    setClearLoading(false);
    return true;
  };

  const openPreview = async (
    slug: string,
  ): Promise<{ html: string | null; error?: string }> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/scrape/html/${encodeURIComponent(slug)}`,
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
        `http://localhost:1488/api/phone-data/raw/${encodeURIComponent(slug)}`,
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
        `http://localhost:1488/api/phone-data/${encodeURIComponent(slug)}`,
      );
      const data: PhoneDataResponse<PhoneDataAi> = await res.json();
      return data.data;
    } catch (error) {
      console.error("Failed to fetch AI phone data:", error);
      return null;
    }
  };

  // Process raw data from cached HTML
  const processRaw = async (slug: string): Promise<boolean> => {
    try {
      const res = await fetch("http://localhost:1488/api/process/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.success) {
        // Update scrape status to reflect new raw data
        setScrapeStatus((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], hasRawData: true },
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to process raw data:", error);
      return false;
    }
  };

  // Process AI normalization from raw data
  const processAi = async (slug: string): Promise<boolean> => {
    try {
      const res = await fetch("http://localhost:1488/api/process/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.success) {
        // Update scrape status to reflect new AI data
        setScrapeStatus((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], hasAiData: true },
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to process AI data:", error);
      return false;
    }
  };

  // Clear raw data (phone_data_raw)
  const clearRawData = async (slug: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/phone-data/raw/${encodeURIComponent(slug)}`,
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

  // Clear AI data (phone_data)
  const clearAiData = async (slug: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `http://localhost:1488/api/phone-data/${encodeURIComponent(slug)}`,
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

  // Bulk clear raw data
  const clearRawBulk = async (slugs: string[]): Promise<number> => {
    const status = scrapeStatus();
    const slugsToClear = slugs.filter((slug) => status[slug]?.hasRawData);

    if (slugsToClear.length === 0) return 0;

    setClearRawLoading(true);
    let clearedCount = 0;
    for (const slug of slugsToClear) {
      const success = await clearRawData(slug);
      if (success) clearedCount++;
    }
    setClearRawLoading(false);
    return clearedCount;
  };

  // Bulk clear AI data
  const clearAiBulk = async (slugs: string[]): Promise<number> => {
    const status = scrapeStatus();
    const slugsToClear = slugs.filter((slug) => status[slug]?.hasAiData);

    if (slugsToClear.length === 0) return 0;

    setClearAiLoading(true);
    let clearedCount = 0;
    for (const slug of slugsToClear) {
      const success = await clearAiData(slug);
      if (success) clearedCount++;
    }
    setClearAiLoading(false);
    return clearedCount;
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
  };
}
