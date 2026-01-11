import { createSignal, createMemo, Show, For, onMount, createEffect } from "solid-js";
import { Header } from "../../components/Header";
import {
  type AnalyticsEnv,
  getAnalyticsEnv,
  setAnalyticsEnv,
} from "../../api/analytics";
import { MiniStatCard, type SparklinePoint } from "../../components/SparklineChart";
import { MappingModal } from "../widgets/modal/MappingModal";
import { getMappingById, getMappingByRawModel } from "../../api/widgetMappings";
import type { WidgetMapping } from "../widgets/WidgetDebug.types";

const ANALYTICS_LOCAL = import.meta.env.VITE_ANALYTICS_URL ?? "http://localhost:1489";
const ANALYTICS_PROD = import.meta.env.VITE_ANALYTICS_PROD_URL ?? "https://api.click-or-die.ru";
const ANALYTICS_API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY ?? "";
const SCRAPER_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:1488";

const getAnalyticsBase = (env: AnalyticsEnv) => (env === "prod" ? ANALYTICS_PROD : ANALYTICS_LOCAL);

const getAnalyticsHeaders = (env: AnalyticsEnv): HeadersInit => {
  if (env === "prod" && ANALYTICS_API_KEY) {
    return { Authorization: `Bearer ${ANALYTICS_API_KEY}` };
  }
  return {};
};

interface PostInfo {
  postId: number;
  title: string;
  url: string;
}

interface PostBreakdown {
  post_id: number;
  impressions: number;
  clicks: number;
  unique_visitors: number;
  title?: string;
  url?: string;
}

interface WidgetStat {
  mapping_id: number | null;
  post_id: number | null;
  device_slug: string | null;
  raw_model: string | null;
  impressions: number;
  clicks: number;
  unique_visitors: number;
  unique_sessions: number;
}

interface AggregatedWidgetStat {
  device_slug: string | null;
  mapping_id: number | null;
  raw_model: string | null;
  impressions: number;
  clicks: number;
  unique_visitors: number;
  unique_sessions: number;
}

interface TimeseriesPoint {
  bucket: string;
  count: number;
  unique_visitors: number;
}

function aggregateByDeviceSlug(stats: WidgetStat[]): AggregatedWidgetStat[] {
  const bySlug = new Map<string, AggregatedWidgetStat>();
  
  for (const stat of stats) {
    const key = stat.device_slug ?? "__empty__";
    const existing = bySlug.get(key);
    
    if (existing) {
      existing.impressions += stat.impressions;
      existing.clicks += stat.clicks;
      existing.unique_visitors += stat.unique_visitors;
      existing.unique_sessions += stat.unique_sessions;
      if (!existing.raw_model && stat.raw_model) {
        existing.raw_model = stat.raw_model;
      }
    } else {
      bySlug.set(key, {
        device_slug: stat.device_slug,
        mapping_id: stat.mapping_id,
        raw_model: stat.raw_model,
        impressions: stat.impressions,
        clicks: stat.clicks,
        unique_visitors: stat.unique_visitors,
        unique_sessions: stat.unique_sessions,
      });
    }
  }
  
  return Array.from(bySlug.values());
}

function aggregateByRawModel(stats: WidgetStat[]): AggregatedWidgetStat[] {
  const byRaw = new Map<string, AggregatedWidgetStat>();
  
  for (const stat of stats) {
    const key = stat.raw_model ?? "__empty__";
    const existing = byRaw.get(key);
    
    if (existing) {
      existing.impressions += stat.impressions;
      existing.clicks += stat.clicks;
      existing.unique_visitors += stat.unique_visitors;
      existing.unique_sessions += stat.unique_sessions;
    } else {
      byRaw.set(key, {
        device_slug: stat.device_slug,
        mapping_id: stat.mapping_id,
        raw_model: stat.raw_model,
        impressions: stat.impressions,
        clicks: stat.clicks,
        unique_visitors: stat.unique_visitors,
        unique_sessions: stat.unique_sessions,
      });
    }
  }
  
  return Array.from(byRaw.values());
}

type PeriodOption = "1h" | "1d" | "7d" | "30d" | "90d";
type TabOption = "top" | "empty";

const PERIODS: { id: PeriodOption; label: string; hours: number }[] = [
  { id: "1h", label: "1h", hours: 1 },
  { id: "1d", label: "24h", hours: 24 },
  { id: "7d", label: "7d", hours: 24 * 7 },
  { id: "30d", label: "30d", hours: 24 * 30 },
  { id: "90d", label: "90d", hours: 24 * 90 },
];

const TABS: { id: TabOption; label: string }[] = [
  { id: "top", label: "Mapped Widgets" },
  { id: "empty", label: "Unmapped" },
];

function StatCard(props: { label: string; value: string | number; color?: "emerald" | "amber" | "indigo" | "cyan" }) {
  const colorClasses = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
    cyan: "text-cyan-600 dark:text-cyan-400",
  };

  return (
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4">
      <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide">
        {props.label}
      </div>
      <div
        class={`text-2xl font-bold mt-1 tabular-nums ${props.color ? colorClasses[props.color] : "text-zinc-900 dark:text-white"}`}
      >
        {typeof props.value === "number" ? props.value.toLocaleString() : props.value}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [stats, setStats] = createSignal<WidgetStat[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [period, setPeriod] = createSignal<PeriodOption>("1d");
  const [tab, setTab] = createSignal<TabOption>("top");
  const [selectedDevice, setSelectedDevice] = createSignal<string | null>(null);
  const [postBreakdown, setPostBreakdown] = createSignal<PostBreakdown[]>([]);
  const [breakdownLoading, setBreakdownLoading] = createSignal(false);
  const [analyticsEnv, setAnalyticsEnvState] = createSignal<AnalyticsEnv>(getAnalyticsEnv());
  const [impressionsTimeseries, setImpressionsTimeseries] = createSignal<TimeseriesPoint[]>([]);
  const [clicksTimeseries, setClicksTimeseries] = createSignal<TimeseriesPoint[]>([]);
  const [timeseriesLoading, setTimeseriesLoading] = createSignal(false);
  const [priceCounts, setPriceCounts] = createSignal<Record<string, number>>({});
  const [selectedMapping, setSelectedMapping] = createSignal<WidgetMapping | null>(null);
  const [mappingLoading, setMappingLoading] = createSignal(false);

  const handleEnvChange = (env: AnalyticsEnv) => {
    setAnalyticsEnv(env);
    setAnalyticsEnvState(env);
    setSelectedDevice(null);
    setPostBreakdown([]);
    fetchStats();
    fetchTimeseries();
  };

  const fetchPriceCounts = async (slugs: string[]) => {
    if (slugs.length === 0) {
      setPriceCounts({});
      return;
    }

    try {
      const map: Record<string, number> = {};
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
        const batch = slugs.slice(i, i + BATCH_SIZE);
        const res = await fetch(`${SCRAPER_BASE}/api/v2/devices/bulk-status?slugs=${batch.join(",")}&source=kimovil`, {
          credentials: "include",
        });
        if (!res.ok) continue;

        const json = (await res.json()) as Record<string, { priceCount?: number }>;
        for (const [slug, data] of Object.entries(json)) {
          if (data.priceCount != null) map[slug] = data.priceCount;
        }
      }
      
      setPriceCounts(map);
    } catch (e) {
      console.error("Failed to fetch price counts:", e);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const hours = PERIODS.find((p) => p.id === period())?.hours ?? 24;
      const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      const env = analyticsEnv();
      const res = await fetch(`${getAnalyticsBase(env)}/v1/stats/widgets?from=${from}&to=${to}&limit=1000`, {
        headers: getAnalyticsHeaders(env),
      });
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

      const json = await res.json();
      const data = json.data ?? [];
      setStats(data);

      // Fetch price counts for unique device slugs
      const slugs: string[] = Array.from(
        new Set(
          data
            .map((s: WidgetStat) => s.device_slug)
            .filter((slug: string | null): slug is string => !!slug)
        )
      );
      void fetchPriceCounts(slugs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeseries = async () => {
    setTimeseriesLoading(true);
    try {
      const hours = PERIODS.find((p) => p.id === period())?.hours ?? 24;
      const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();
      
      const interval = hours <= 1 ? "fifteen_minutes" : hours <= 24 ? "fifteen_minutes" : hours <= 24 * 7 ? "hour" : "day";
      const mappedParam = tab() === "top" ? "&mapped=true" : "&mapped=false";

      const env = analyticsEnv();
      const baseUrl = getAnalyticsBase(env);
      const headers = getAnalyticsHeaders(env);

      const [impressionsRes, clicksRes] = await Promise.all([
        fetch(
          `${baseUrl}/v1/stats/timeseries?from=${from}&to=${to}&interval=${interval}&event_type=widget_impression${mappedParam}`,
          { headers }
        ),
        fetch(
          `${baseUrl}/v1/stats/timeseries?from=${from}&to=${to}&interval=${interval}&event_type=widget_click${mappedParam}`,
          { headers }
        ),
      ]);

      if (impressionsRes.ok) {
        const json = await impressionsRes.json();
        setImpressionsTimeseries(json.data ?? []);
      }

      if (clicksRes.ok) {
        const json = await clicksRes.json();
        setClicksTimeseries(json.data ?? []);
      }
    } catch (e) {
      console.error("Failed to fetch timeseries:", e);
    } finally {
      setTimeseriesLoading(false);
    }
  };

  onMount(() => {
    // Effects will trigger fetchStats and fetchTimeseries on mount
  });

  createEffect(() => {
    period();
    fetchStats();
  });

  createEffect(() => {
    period();
    tab();
    fetchTimeseries();
  });

  const aggregatedStats = createMemo(() => {
    const all = stats();
    if (tab() === "empty") {
      const filtered = all.filter((s) => s.mapping_id == null);
      return aggregateByRawModel(filtered).sort((a, b) => b.impressions - a.impressions);
    }
    const filtered = all.filter((s) => s.mapping_id != null);
    return aggregateByDeviceSlug(filtered).sort((a, b) => b.impressions - a.impressions);
  });

  const totalImpressions = createMemo(() => aggregatedStats().reduce((sum, s) => sum + s.impressions, 0));
  const totalClicks = createMemo(() => aggregatedStats().reduce((sum, s) => sum + s.clicks, 0));
  const emptyCount = createMemo(() => {
    const filtered = stats().filter((s) => s.mapping_id == null);
    return aggregateByRawModel(filtered).length;
  });
  const mappedCount = createMemo(() => {
    const filtered = stats().filter((s) => s.mapping_id != null);
    return aggregateByDeviceSlug(filtered).length;
  });
  const ctr = createMemo(() =>
    totalImpressions() > 0 ? ((totalClicks() / totalImpressions()) * 100).toFixed(1) + "%" : "0%"
  );

  const impressionsChartData = createMemo((): SparklinePoint[] =>
    impressionsTimeseries().map((p) => ({ bucket: p.bucket, value: p.count }))
  );

  const clicksChartData = createMemo((): SparklinePoint[] =>
    clicksTimeseries().map((p) => ({ bucket: p.bucket, value: p.count }))
  );

  const ctrChartData = createMemo((): SparklinePoint[] => {
    const imps = impressionsTimeseries();
    const clicks = clicksTimeseries();
    
    const clicksByBucket = new Map(clicks.map((c) => [c.bucket, c.count]));
    
    return imps.map((imp) => {
      const clickCount = clicksByBucket.get(imp.bucket) ?? 0;
      const ctrValue = imp.count > 0 ? (clickCount / imp.count) * 100 : 0;
      return { bucket: imp.bucket, value: ctrValue };
    });
  });

  const calculateTrend = (data: SparklinePoint[]): { value: number; label: string } | undefined => {
    if (data.length < 2) return undefined;
    
    const mid = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, mid);
    const secondHalf = data.slice(mid);
    
    const firstAvg = firstHalf.reduce((s, p) => s + p.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, p) => s + p.value, 0) / secondHalf.length;
    
    if (firstAvg === 0) return undefined;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    return { value: change, label: "vs previous period" };
  };

  const handlePeriodChange = (newPeriod: PeriodOption) => {
    setPeriod(newPeriod);
    setSelectedDevice(null);
    setPostBreakdown([]);
  };

  const fetchPostBreakdown = async (deviceSlug: string) => {
    setBreakdownLoading(true);
    try {
      const hours = PERIODS.find((p) => p.id === period())?.hours ?? 24;
      const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      const env = analyticsEnv();
      const res = await fetch(
        `${getAnalyticsBase(env)}/v1/stats/widgets?from=${from}&to=${to}&device_slug=${encodeURIComponent(deviceSlug)}&limit=50`,
        { headers: getAnalyticsHeaders(env) }
      );
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

      const json = await res.json();
      const data = (json.data ?? []) as WidgetStat[];

      const byPost = data.reduce(
        (acc, row) => {
          const pid = row.post_id ?? 0;
          if (!acc[pid]) {
            acc[pid] = { post_id: pid, impressions: 0, clicks: 0, unique_visitors: 0 };
          }
          acc[pid].impressions += row.impressions;
          acc[pid].clicks += row.clicks;
          acc[pid].unique_visitors += row.unique_visitors;
          return acc;
        },
        {} as Record<number, PostBreakdown>
      );

      const breakdown = Object.values(byPost).sort((a, b) => b.impressions - a.impressions);

      const postIds = breakdown.map((p) => p.post_id).filter((id) => id > 0);
      if (postIds.length > 0) {
        try {
          const postsRes = await fetch(
            `${SCRAPER_BASE}/api/widget-mappings/posts/by-ids?ids=${postIds.join(",")}`,
            { credentials: "include" }
          );
          if (postsRes.ok) {
            const postsData = await postsRes.json();
            const postsMap = new Map<number, PostInfo>(
              (postsData.posts ?? []).map((p: PostInfo) => [p.postId, p])
            );
            breakdown.forEach((b) => {
              const info = postsMap.get(b.post_id);
              if (info) {
                b.title = info.title;
                b.url = info.url;
              }
            });
          }
        } catch {
          // Ignore post title fetch errors
        }
      }

      setPostBreakdown(breakdown);
    } catch (e) {
      console.error("Failed to fetch breakdown:", e);
      setPostBreakdown([]);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleRowClick = (stat: AggregatedWidgetStat) => {
    const slug = stat.device_slug;
    if (!slug) return;

    if (selectedDevice() === slug) {
      setSelectedDevice(null);
      setPostBreakdown([]);
    } else {
      setSelectedDevice(slug);
      fetchPostBreakdown(slug);
    }
  };

  const openMappingModal = async (mappingId: number) => {
    setMappingLoading(true);
    try {
      const mapping = await getMappingById(mappingId);
      if (mapping) {
        setSelectedMapping(mapping);
      } else {
        console.warn(`Mapping #${mappingId} not found`);
      }
    } catch (e) {
      console.error("Failed to fetch mapping:", e);
    } finally {
      setMappingLoading(false);
    }
  };

  const openMappingByRawModel = async (rawModel: string | null) => {
    if (!rawModel) return;
    setMappingLoading(true);
    try {
      const mapping = await getMappingByRawModel(rawModel);
      if (mapping) {
        setSelectedMapping(mapping);
      } else {
        console.warn("No mapping found for raw_model:", rawModel);
      }
    } catch (e) {
      console.error("Failed to fetch mapping by raw_model:", e);
    } finally {
      setMappingLoading(false);
    }
  };

  const closeMappingModal = () => {
    setSelectedMapping(null);
  };

  const handleMappingUpdated = () => {
    fetchStats();
    closeMappingModal();
  };

  return (
    <div class="min-h-screen bg-zinc-100 dark:bg-slate-950">
      <Header currentPage="analytics" />

      <div class="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">Widget Analytics</h1>
          <p class="text-sm text-zinc-500 dark:text-slate-400 mt-1">
            Track performance and identify optimization opportunities
          </p>
        </div>

        {/* Stats Row with Charts */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MiniStatCard
            label="Impressions"
            value={totalImpressions()}
            color="indigo"
            data={impressionsChartData()}
            loading={timeseriesLoading()}
            trend={calculateTrend(impressionsChartData())}
          />
          <MiniStatCard
            label="Clicks"
            value={totalClicks()}
            color="cyan"
            data={clicksChartData()}
            loading={timeseriesLoading()}
            trend={calculateTrend(clicksChartData())}
          />
          <MiniStatCard
            label="CTR"
            value={ctr()}
            color="emerald"
            data={ctrChartData()}
            loading={timeseriesLoading()}
            trend={calculateTrend(ctrChartData())}
            formatValue={(v) => `${v.toFixed(2)}%`}
          />
          <StatCard label="Unmapped" value={emptyCount()} color="amber" />
        </div>

        {/* Filters Bar */}
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4 mb-6">
          <div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Tabs */}
            <div class="flex gap-1 bg-zinc-100 dark:bg-slate-800 rounded-lg p-1">
              <For each={TABS}>
                {(t) => (
                  <button
                    onClick={() => setTab(t.id)}
                    class={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      tab() === t.id
                        ? "bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    {t.label}
                    <span class="ml-1.5 text-zinc-400 dark:text-slate-500">
                      {t.id === "top" ? mappedCount() : emptyCount()}
                    </span>
                  </button>
                )}
              </For>
            </div>

            <div class="flex items-center gap-4">
              {/* Environment Selector */}
              <div class="flex gap-0.5 bg-zinc-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => handleEnvChange("local")}
                  class={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                    analyticsEnv() === "local"
                      ? "bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300"
                  }`}
                >
                  Local
                </button>
                <button
                  onClick={() => handleEnvChange("prod")}
                  class={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                    analyticsEnv() === "prod"
                      ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/25"
                      : "text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300"
                  }`}
                >
                  Prod
                </button>
              </div>

              {/* Period Selector */}
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5 text-zinc-500 dark:text-slate-400">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div class="flex gap-0.5 bg-zinc-100 dark:bg-slate-800 rounded-lg p-0.5">
                  <For each={PERIODS}>
                    {(opt) => (
                      <button
                        onClick={() => handlePeriodChange(opt.id)}
                        class={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                          period() === opt.id
                            ? "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                            : "text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Refresh */}
              <button
                onClick={fetchStats}
                disabled={loading()}
                class="px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
              >
                {loading() ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-4 text-rose-600 dark:text-rose-400">
            {error()}
          </div>
        </Show>

        {/* Loading */}
        <Show when={loading()}>
          <div class="flex items-center justify-center py-12 gap-3">
            <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span class="text-zinc-500 dark:text-slate-400">Loading analytics...</span>
          </div>
        </Show>

        {/* Table */}
        <Show when={!loading()}>
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-zinc-50 dark:bg-slate-800/50 border-b border-zinc-200 dark:border-slate-800">
                    <th class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 w-12">#</th>
                    <th class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400">Widget</th>
                    <th class="px-4 py-3 text-right font-medium text-zinc-500 dark:text-slate-400">Impressions</th>
                    <th class="px-4 py-3 text-right font-medium text-zinc-500 dark:text-slate-400">Clicks</th>
                    <th class="px-4 py-3 text-right font-medium text-zinc-500 dark:text-slate-400">CTR</th>
                    <th class="px-4 py-3 text-right font-medium text-zinc-500 dark:text-slate-400">Visitors</th>
                    <th class="px-4 py-3 text-right font-medium text-zinc-500 dark:text-slate-400">Prices</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-slate-800">
                  <For
                    each={aggregatedStats()}
                    fallback={
                      <tr>
                        <td colspan="7" class="px-4 py-12 text-center text-zinc-400 dark:text-slate-500">
                          No data for this period
                        </td>
                      </tr>
                    }
                  >
                    {(stat, idx) => (
                      <>
                        <tr
                          class={`cursor-pointer transition-colors ${
                            selectedDevice() === stat.device_slug
                              ? "bg-indigo-50 dark:bg-indigo-900/10"
                              : "hover:bg-zinc-50 dark:hover:bg-slate-800/50"
                          }`}
                          onClick={() => handleRowClick(stat)}
                        >
                          <td class="px-4 py-3">
                            <span class="inline-flex items-center justify-center w-6 h-6 bg-zinc-100 dark:bg-slate-800 rounded text-xs font-medium text-zinc-600 dark:text-slate-300">
                              {idx() + 1}
                            </span>
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex items-center gap-2">
                              <svg
                                class={`w-4 h-4 flex-shrink-0 transition-transform duration-150 ${
                                  selectedDevice() === stat.device_slug
                                    ? "text-indigo-500 rotate-90"
                                    : "text-zinc-400 dark:text-slate-600"
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <div class="min-w-0">
                                <div
                                  class="font-mono text-xs text-zinc-900 dark:text-white truncate max-w-md"
                                  title={stat.raw_model ?? stat.device_slug ?? ""}
                                >
                                  {stat.raw_model || stat.device_slug || "Unknown"}
                                </div>
                                <Show when={stat.mapping_id}>
                                  <div class="flex items-center gap-1.5 mt-0.5">
                                    <span class="text-[10px] text-zinc-400 dark:text-slate-500">
                                      ID #{stat.mapping_id}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openMappingModal(stat.mapping_id!);
                                      }}
                                      class="p-0.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                                      title="Edit mapping"
                                    >
                                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                  </div>
                                </Show>
                                <Show when={!stat.mapping_id}>
                                  <div class="flex items-center gap-1.5 mt-0.5">
                                    <span class="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                          fill-rule="evenodd"
                                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                          clip-rule="evenodd"
                                        />
                                      </svg>
                                      Unmapped
                                    </span>
                                    <Show when={stat.raw_model}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openMappingByRawModel(stat.raw_model);
                                        }}
                                        class="p-0.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
                                        title="Map this widget"
                                      >
                                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                    </Show>
                                  </div>
                                </Show>
                              </div>
                            </div>
                          </td>
                          <td class="px-4 py-3 text-right">
                            <span class="font-medium text-zinc-900 dark:text-white tabular-nums">
                              {stat.impressions.toLocaleString()}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-right">
                            <span class="text-zinc-600 dark:text-slate-300 tabular-nums">
                              {stat.clicks.toLocaleString()}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-right">
                            <span
                              class={`inline-flex px-2 py-0.5 rounded text-xs font-medium tabular-nums ${
                                stat.impressions > 0 && stat.clicks / stat.impressions >= 0.05
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                  : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-400"
                              }`}
                            >
                              {stat.impressions > 0 ? ((stat.clicks / stat.impressions) * 100).toFixed(1) : 0}%
                            </span>
                          </td>
                          <td class="px-4 py-3 text-right">
                            <span class="text-zinc-500 dark:text-slate-400 tabular-nums">
                              {stat.unique_visitors.toLocaleString()}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-right">
                            <span class={`tabular-nums ${
                              stat.device_slug && (priceCounts()[stat.device_slug] ?? 0) > 0
                                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                                : "text-zinc-300 dark:text-slate-600"
                            }`}>
                              {stat.device_slug ? (priceCounts()[stat.device_slug] ?? 0).toLocaleString() : "—"}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded breakdown */}
                        <Show when={selectedDevice() === stat.device_slug}>
                          <tr class="bg-zinc-50 dark:bg-slate-800/30">
                            <td colspan="7" class="px-4 py-4">
                              <div class="pl-8">
                                <Show when={breakdownLoading()}>
                                  <div class="flex items-center gap-2 py-2 text-sm text-zinc-500 dark:text-slate-400">
                                    <div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    Loading posts...
                                  </div>
                                </Show>

                                <Show when={!breakdownLoading() && postBreakdown().length === 0}>
                                  <div class="text-sm text-zinc-400 dark:text-slate-500 py-2">
                                    No post data available
                                  </div>
                                </Show>

                                <Show when={!breakdownLoading() && postBreakdown().length > 0}>
                                  <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                                    Posts ({postBreakdown().length})
                                  </div>
                                  <div class="space-y-1">
                                    <For each={postBreakdown()}>
                                      {(post) => (
                                        <div class="flex items-center justify-between py-2 px-3 bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800">
                                          <div class="min-w-0 flex-1">
                                            <Show when={post.post_id === 0}>
                                              <span class="text-sm text-zinc-400 dark:text-slate-500 italic">
                                                Unknown source
                                              </span>
                                            </Show>
                                            <Show when={post.post_id > 0 && post.title}>
                                              <a
                                                href={post.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="text-sm text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate block max-w-lg transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                                title={post.title}
                                              >
                                                {post.title}
                                              </a>
                                            </Show>
                                            <Show when={post.post_id > 0 && !post.title}>
                                              <a
                                                href={`https://click-or-die.ru/?p=${post.post_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="text-sm text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                Post #{post.post_id}
                                              </a>
                                            </Show>
                                            <Show when={post.post_id > 0}>
                                              <div class="text-[10px] text-zinc-400 dark:text-slate-500 mt-0.5">
                                                ID: {post.post_id}
                                              </div>
                                            </Show>
                                          </div>
                                          <div class="flex items-center gap-6 text-sm tabular-nums flex-shrink-0 ml-4">
                                            <div class="text-right">
                                              <div class="font-medium text-zinc-900 dark:text-white">
                                                {post.impressions.toLocaleString()}
                                              </div>
                                              <div class="text-[10px] text-zinc-400 dark:text-slate-500">views</div>
                                            </div>
                                            <div class="text-right">
                                              <div class="text-zinc-600 dark:text-slate-300">{post.clicks}</div>
                                              <div class="text-[10px] text-zinc-400 dark:text-slate-500">clicks</div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </Show>
                              </div>
                            </td>
                          </tr>
                        </Show>
                      </>
                    )}
                  </For>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div class="px-4 py-3 bg-zinc-50 dark:bg-slate-800/50 border-t border-zinc-200 dark:border-slate-800 text-sm text-zinc-500 dark:text-slate-400">
              Showing {aggregatedStats().length} widgets
            </div>
          </div>
        </Show>
      </div>

      {/* Mapping Loading Overlay */}
      <Show when={mappingLoading()}>
        <div class="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>

      {/* Mapping Modal */}
      <MappingModal
        mapping={selectedMapping()}
        onClose={closeMappingModal}
        onMappingUpdated={handleMappingUpdated}
        onNavigate={() => {}}
      />
    </div>
  );
}
