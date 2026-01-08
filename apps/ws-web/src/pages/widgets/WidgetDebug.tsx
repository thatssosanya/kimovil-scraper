import { createSignal, Show, For, onMount, createEffect } from "solid-js";
import { Header } from "../../components/Header";

interface WidgetModel {
  raw: string;
  normalized: string;
  brand: string | null;
  count: number;
  postIds: number[];
  firstSeen: string;
  lastSeen: string;
  matchedSlug: string | null;
  matchConfidence: number | null;
}

interface WidgetStats {
  totalModels: number;
  uniqueModels: number;
  postsWithWidgets: number;
  matchedCount: number;
  unmatchedCount: number;
}

interface WidgetDataResponse {
  stats: WidgetStats;
  models: WidgetModel[];
  period: PeriodParam;
}

interface SyncStatus {
  lastSyncedAt: string | null;
  lastModifiedGmt: string | null;
  postsCount: number;
  widgetsCount: number;
}

type PeriodParam = "1m" | "3m" | "6m" | "all";
type SortField = "count" | "raw" | "brand" | "matchConfidence";
type FilterMode = "all" | "matched" | "unmatched" | "ambiguous";

const PERIOD_OPTIONS: { id: PeriodParam; label: string }[] = [
  { id: "1m", label: "1 month" },
  { id: "3m", label: "3 months" },
  { id: "6m", label: "6 months" },
  { id: "all", label: "All time" },
];

export default function WidgetDebug() {
  const [data, setData] = createSignal<WidgetDataResponse | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");
  const [sortField, setSortField] = createSignal<SortField>("count");
  const [sortDesc, setSortDesc] = createSignal(true);
  const [filterMode, setFilterMode] = createSignal<FilterMode>("all");
  const [selectedModel, setSelectedModel] = createSignal<WidgetModel | null>(null);
  const [period, setPeriod] = createSignal<PeriodParam>("3m");
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus | null>(null);
  const [syncing, setSyncing] = createSignal(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:1488/api/widget-debug/models?period=${period()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch("http://localhost:1488/api/widget-debug/sync-status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSyncStatus(json);
    } catch (e) {
      console.error("Failed to fetch sync status:", e);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("http://localhost:1488/api/widget-debug/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchSyncStatus();
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  onMount(() => {
    fetchData();
    fetchSyncStatus();
  });

  createEffect(() => {
    period();
    fetchData();
  });

  const filteredModels = () => {
    const d = data();
    if (!d) return [];
    
    let models = [...d.models];
    
    const q = search().toLowerCase();
    if (q) {
      models = models.filter(m => 
        m.raw.toLowerCase().includes(q) || 
        m.normalized.toLowerCase().includes(q) ||
        m.brand?.toLowerCase().includes(q)
      );
    }
    
    const mode = filterMode();
    if (mode === "matched") {
      models = models.filter(m => m.matchedSlug !== null);
    } else if (mode === "unmatched") {
      models = models.filter(m => m.matchedSlug === null);
    } else if (mode === "ambiguous") {
      models = models.filter(m => m.matchConfidence !== null && m.matchConfidence < 0.9);
    }
    
    const field = sortField();
    const desc = sortDesc();
    models.sort((a, b) => {
      let cmp = 0;
      if (field === "count") cmp = a.count - b.count;
      else if (field === "raw") cmp = a.raw.localeCompare(b.raw);
      else if (field === "brand") cmp = (a.brand || "").localeCompare(b.brand || "");
      else if (field === "matchConfidence") cmp = (a.matchConfidence ?? -1) - (b.matchConfidence ?? -1);
      return desc ? -cmp : cmp;
    });
    
    return models;
  };

  const toggleSort = (field: SortField) => {
    if (sortField() === field) {
      setSortDesc(!sortDesc());
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const SortIcon = (props: { field: SortField }) => (
    <Show when={sortField() === props.field}>
      <span class="ml-1 text-indigo-500">
        {sortDesc() ? "↓" : "↑"}
      </span>
    </Show>
  );

  return (
    <div class="min-h-screen bg-zinc-100 dark:bg-slate-950">
      <Header currentPage="widgets" />
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">Widget Debug</h1>
          <p class="text-sm text-zinc-500 dark:text-slate-400 mt-1">
            Analyze WordPress widget models and match them to device slugs
          </p>
        </div>

        {/* Sync Status Card */}
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4 mb-6">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="flex flex-wrap gap-6 text-sm">
              <div>
                <span class="text-zinc-500 dark:text-slate-400">Last synced:</span>
                <span class="ml-2 font-medium text-zinc-900 dark:text-white">
                  {formatDate(syncStatus()?.lastSyncedAt ?? null)}
                </span>
              </div>
              <div>
                <span class="text-zinc-500 dark:text-slate-400">Posts cached:</span>
                <span class="ml-2 font-medium text-zinc-900 dark:text-white">
                  {syncStatus()?.postsCount?.toLocaleString() ?? "—"}
                </span>
              </div>
              <div>
                <span class="text-zinc-500 dark:text-slate-400">Widgets cached:</span>
                <span class="ml-2 font-medium text-zinc-900 dark:text-white">
                  {syncStatus()?.widgetsCount?.toLocaleString() ?? "—"}
                </span>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing()}
              class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Show when={syncing()}>
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </Show>
              {syncing() ? "Syncing..." : "Sync from WordPress"}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <Show when={data()}>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Total Uses" value={data()!.stats.totalModels} />
            <StatCard label="Unique Models" value={data()!.stats.uniqueModels} />
            <StatCard label="Posts" value={data()!.stats.postsWithWidgets} />
            <StatCard 
              label="Matched" 
              value={data()!.stats.matchedCount} 
              color="emerald"
            />
            <StatCard 
              label="Unmatched" 
              value={data()!.stats.unmatchedCount} 
              color="rose"
            />
          </div>
        </Show>

        {/* Controls */}
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4 mb-4">
          <div class="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div class="flex-1">
              <input
                type="text"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder="Search models..."
                class="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
              />
            </div>
            
            {/* Period selector */}
            <div class="flex gap-1">
              <For each={PERIOD_OPTIONS}>
                {(opt) => (
                  <button
                    onClick={() => setPeriod(opt.id)}
                    class={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      period() === opt.id
                        ? "bg-violet-500 text-white"
                        : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                )}
              </For>
            </div>
            
            {/* Filter buttons */}
            <div class="flex gap-2">
              <For each={[
                { id: "all", label: "All" },
                { id: "matched", label: "Matched" },
                { id: "unmatched", label: "Unmatched" },
                { id: "ambiguous", label: "Ambiguous" },
              ] as const}>
                {(item) => (
                  <button
                    onClick={() => setFilterMode(item.id)}
                    class={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      filterMode() === item.id
                        ? "bg-indigo-500 text-white"
                        : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {item.label}
                  </button>
                )}
              </For>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchData}
              disabled={loading() || syncing()}
              class="px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
            >
              {loading() ? "Loading..." : syncing() ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-4 text-rose-600 dark:text-rose-400">
            {error()}
          </div>
        </Show>

        {/* Loading */}
        <Show when={loading() || syncing()}>
          <div class="flex items-center justify-center py-12 gap-3">
            <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span class="text-zinc-500 dark:text-slate-400">
              {syncing() ? "Syncing from WordPress..." : "Loading..."}
            </span>
          </div>
        </Show>

        {/* Table */}
        <Show when={!loading() && !syncing() && data()}>
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-zinc-50 dark:bg-slate-800/50 border-b border-zinc-200 dark:border-slate-800">
                    <th 
                      class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => toggleSort("count")}
                    >
                      Count <SortIcon field="count" />
                    </th>
                    <th 
                      class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => toggleSort("brand")}
                    >
                      Brand <SortIcon field="brand" />
                    </th>
                    <th 
                      class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => toggleSort("raw")}
                    >
                      Raw Model <SortIcon field="raw" />
                    </th>
                    <th class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400">
                      Normalized
                    </th>
                    <th 
                      class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => toggleSort("matchConfidence")}
                    >
                      Match <SortIcon field="matchConfidence" />
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-slate-800">
                  <For each={filteredModels()}>
                    {(model) => (
                      <tr 
                        class="hover:bg-zinc-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedModel(model)}
                      >
                        <td class="px-4 py-3">
                          <span class="inline-flex items-center justify-center w-8 h-6 bg-zinc-100 dark:bg-slate-800 rounded text-xs font-medium text-zinc-600 dark:text-slate-300">
                            {model.count}
                          </span>
                        </td>
                        <td class="px-4 py-3">
                          <Show when={model.brand} fallback={
                            <span class="text-zinc-400 dark:text-slate-600">—</span>
                          }>
                            <span class="inline-flex px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-medium">
                              {model.brand}
                            </span>
                          </Show>
                        </td>
                        <td class="px-4 py-3 max-w-xs">
                          <div class="truncate text-zinc-900 dark:text-white font-mono text-xs" title={model.raw}>
                            {model.raw}
                          </div>
                        </td>
                        <td class="px-4 py-3 max-w-xs">
                          <div class="truncate text-zinc-500 dark:text-slate-400 font-mono text-xs" title={model.normalized}>
                            {model.normalized}
                          </div>
                        </td>
                        <td class="px-4 py-3">
                          <Show when={model.matchedSlug} fallback={
                            <span class="inline-flex px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded text-xs">
                              No match
                            </span>
                          }>
                            <div class="flex items-center gap-2">
                              <span class={`inline-flex px-2 py-0.5 rounded text-xs ${
                                (model.matchConfidence ?? 0) >= 0.9
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                              }`}>
                                {Math.round((model.matchConfidence ?? 0) * 100)}%
                              </span>
                              <span class="text-xs text-zinc-500 dark:text-slate-400 truncate max-w-[120px]" title={model.matchedSlug!}>
                                {model.matchedSlug}
                              </span>
                            </div>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            
            {/* Table footer */}
            <div class="px-4 py-3 bg-zinc-50 dark:bg-slate-800/50 border-t border-zinc-200 dark:border-slate-800 text-sm text-zinc-500 dark:text-slate-400">
              Showing {filteredModels().length} of {data()?.models.length ?? 0} models
            </div>
          </div>
        </Show>

        {/* Detail Modal */}
        <Show when={selectedModel()}>
          <div 
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedModel(null)}
          >
            <div 
              class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div class="p-6 border-b border-zinc-200 dark:border-slate-800 flex items-center justify-between">
                <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">Model Details</h2>
                <button 
                  onClick={() => setSelectedModel(null)}
                  class="p-2 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-zinc-500"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                <DetailRow label="Raw Model" value={selectedModel()!.raw} mono />
                <DetailRow label="Normalized" value={selectedModel()!.normalized} mono />
                <DetailRow label="Brand" value={selectedModel()!.brand || "Unknown"} />
                <DetailRow label="Usage Count" value={String(selectedModel()!.count)} />
                <DetailRow label="First Seen" value={formatDate(selectedModel()!.firstSeen)} />
                <DetailRow label="Last Seen" value={formatDate(selectedModel()!.lastSeen)} />
                <DetailRow 
                  label="Matched Slug" 
                  value={selectedModel()!.matchedSlug || "No match"} 
                  mono 
                  highlight={!selectedModel()!.matchedSlug ? "rose" : "emerald"}
                />
                <DetailRow 
                  label="Confidence" 
                  value={selectedModel()!.matchConfidence !== null ? `${Math.round(selectedModel()!.matchConfidence! * 100)}%` : "N/A"} 
                />
                <div>
                  <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Used in Posts
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <For each={selectedModel()!.postIds.slice(0, 10)}>
                      {(id) => (
                        <a 
                          href={`https://click-or-die.ru/?p=${id}`}
                          target="_blank"
                          class="px-2 py-1 bg-zinc-100 dark:bg-slate-800 rounded text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:bg-zinc-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          #{id}
                        </a>
                      )}
                    </For>
                    <Show when={selectedModel()!.postIds.length > 10}>
                      <span class="px-2 py-1 text-xs text-zinc-500">
                        +{selectedModel()!.postIds.length - 10} more
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

function StatCard(props: { label: string; value: number; color?: "emerald" | "rose" }) {
  const colorClasses = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose: "text-rose-600 dark:text-rose-400",
  };
  
  return (
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4">
      <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide">
        {props.label}
      </div>
      <div class={`text-2xl font-bold mt-1 ${props.color ? colorClasses[props.color] : "text-zinc-900 dark:text-white"}`}>
        {props.value.toLocaleString()}
      </div>
    </div>
  );
}

function DetailRow(props: { label: string; value: string; mono?: boolean; highlight?: "emerald" | "rose" }) {
  return (
    <div>
      <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {props.label}
      </div>
      <div class={`text-sm text-zinc-900 dark:text-white break-all ${props.mono ? "font-mono" : ""} ${
        props.highlight === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
        props.highlight === "rose" ? "text-rose-600 dark:text-rose-400" : ""
      }`}>
        {props.value}
      </div>
    </div>
  );
}
