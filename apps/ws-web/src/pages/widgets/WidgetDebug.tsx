import { createSignal, Show, For, onMount, createEffect } from "solid-js";
import { Header } from "../../components/Header";

type MappingStatus = "pending" | "suggested" | "auto_confirmed" | "confirmed" | "ignored";

interface WidgetMapping {
  id: number;
  source: string;
  rawModel: string;
  normalizedModel: string | null;
  deviceId: string | null;
  confidence: number | null;
  status: MappingStatus;
  usageCount: number;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface MappingsResponse {
  mappings: WidgetMapping[];
  total: number;
}

interface SyncStatus {
  lastSyncedAt: string | null;
  lastModifiedGmt: string | null;
  postsCount: number;
  widgetsCount: number;
}

type PeriodParam = "1m" | "3m" | "6m" | "all";
type SortField = "usageCount" | "rawModel" | "status" | "confidence";
type StatusTab = "all" | "needs_review" | "auto_confirmed" | "confirmed" | "ignored";

const PERIOD_OPTIONS: { id: PeriodParam; label: string }[] = [
  { id: "1m", label: "1 month" },
  { id: "3m", label: "3 months" },
  { id: "6m", label: "6 months" },
  { id: "all", label: "All time" },
];

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs Review" },
  { id: "auto_confirmed", label: "Auto-confirmed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "ignored", label: "Ignored" },
];

export default function WidgetDebug() {
  const [mappings, setMappings] = createSignal<WidgetMapping[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");
  const [sortField, setSortField] = createSignal<SortField>("usageCount");
  const [sortDesc, setSortDesc] = createSignal(true);
  const [statusTab, setStatusTab] = createSignal<StatusTab>("all");
  const [selectedMapping, setSelectedMapping] = createSignal<WidgetMapping | null>(null);
  const [period, setPeriod] = createSignal<PeriodParam>("3m");
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus | null>(null);
  const [syncing, setSyncing] = createSignal(false);

  const fetchMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const tab = statusTab();
      const statusParam = tab === "all" ? "" : `&status=${tab}`;
      const res = await fetch(`http://localhost:1488/api/widget-mappings?limit=1000${statusParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MappingsResponse = await res.json();
      setMappings(json.mappings);
      setTotal(json.total);
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
      await fetchMappings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  onMount(() => {
    fetchMappings();
    fetchSyncStatus();
  });

  createEffect(() => {
    statusTab();
    fetchMappings();
  });

  const filteredMappings = () => {
    let items = [...mappings()];

    const q = search().toLowerCase();
    if (q) {
      items = items.filter(
        (m) =>
          m.rawModel.toLowerCase().includes(q) ||
          m.normalizedModel?.toLowerCase().includes(q) ||
          m.deviceId?.toLowerCase().includes(q)
      );
    }

    const field = sortField();
    const desc = sortDesc();
    items.sort((a, b) => {
      let cmp = 0;
      if (field === "usageCount") cmp = a.usageCount - b.usageCount;
      else if (field === "rawModel") cmp = a.rawModel.localeCompare(b.rawModel);
      else if (field === "status") cmp = a.status.localeCompare(b.status);
      else if (field === "confidence") cmp = (a.confidence ?? -1) - (b.confidence ?? -1);
      return desc ? -cmp : cmp;
    });

    return items;
  };

  const toggleSort = (field: SortField) => {
    if (sortField() === field) {
      setSortDesc(!sortDesc());
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const formatDate = (ts: number | null) => {
    if (ts == null) return "Never";
    const d = new Date(ts * 1000); // Unix seconds to milliseconds
    return d.toLocaleString();
  };

  const formatDateStr = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const SortIcon = (props: { field: SortField }) => (
    <Show when={sortField() === props.field}>
      <span class="ml-1 text-indigo-500">{sortDesc() ? "↓" : "↑"}</span>
    </Show>
  );

  const StatusBadge = (props: { status: MappingStatus }) => {
    const styles: Record<MappingStatus, string> = {
      pending: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
      suggested: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
      auto_confirmed: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
      confirmed: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
      ignored: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 line-through",
    };
    const labels: Record<MappingStatus, string> = {
      pending: "Pending",
      suggested: "Suggested",
      auto_confirmed: "Auto",
      confirmed: "Confirmed",
      ignored: "Ignored",
    };
    return (
      <span class={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${styles[props.status]}`}>
        {labels[props.status]}
      </span>
    );
  };

  const needsReviewCount = () =>
    mappings().filter((m) => m.status === "pending" || m.status === "suggested").length;
  const confirmedCount = () =>
    mappings().filter((m) => m.status === "confirmed" || m.status === "auto_confirmed").length;

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
                  {formatDateStr(syncStatus()?.lastSyncedAt ?? null)}
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
        <div class="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Mappings" value={total()} />
          <StatCard label="Needs Review" value={needsReviewCount()} color="amber" />
          <StatCard label="Confirmed" value={confirmedCount()} color="emerald" />
        </div>

        {/* Status Tab Bar */}
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-2 mb-4">
          <div class="flex gap-1 overflow-x-auto">
            <For each={STATUS_TABS}>
              {(tab) => (
                <button
                  onClick={() => setStatusTab(tab.id)}
                  class={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    statusTab() === tab.id
                      ? "bg-indigo-500 text-white"
                      : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </div>
        </div>

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
            <div class="flex gap-2">
              <For each={PERIOD_OPTIONS}>
                {(opt) => (
                  <button
                    onClick={() => setPeriod(opt.id)}
                    class={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      period() === opt.id
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                        : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                )}
              </For>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchMappings}
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
        <Show when={!loading() && !syncing()}>
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-zinc-50 dark:bg-slate-800/50 border-b border-zinc-200 dark:border-slate-800">
                    <th
                      class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => toggleSort("usageCount")}
                    >
                      Count <SortIcon field="usageCount" />
                    </th>
                    <th
                      class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => toggleSort("status")}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th
                      class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => toggleSort("rawModel")}
                    >
                      Raw Model <SortIcon field="rawModel" />
                    </th>
                    <th class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400">
                      Normalized
                    </th>
                    <th
                      class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => toggleSort("confidence")}
                    >
                      Match <SortIcon field="confidence" />
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-slate-800">
                  <For each={filteredMappings()}>
                    {(mapping) => (
                      <tr
                        class="hover:bg-zinc-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedMapping(mapping)}
                      >
                        <td class="px-4 py-3">
                          <span class="inline-flex items-center justify-center w-8 h-6 bg-zinc-100 dark:bg-slate-800 rounded text-xs font-medium text-zinc-600 dark:text-slate-300">
                            {mapping.usageCount}
                          </span>
                        </td>
                        <td class="px-4 py-3">
                          <StatusBadge status={mapping.status} />
                        </td>
                        <td class="px-4 py-3 max-w-xs">
                          <div
                            class="truncate text-zinc-900 dark:text-white font-mono text-xs"
                            title={mapping.rawModel}
                          >
                            {mapping.rawModel}
                          </div>
                        </td>
                        <td class="px-4 py-3 max-w-xs">
                          <div
                            class="truncate text-zinc-500 dark:text-slate-400 font-mono text-xs"
                            title={mapping.normalizedModel ?? ""}
                          >
                            {mapping.normalizedModel ?? "—"}
                          </div>
                        </td>
                        <td class="px-4 py-3">
                          <Show
                            when={mapping.deviceId}
                            fallback={
                              <span class="inline-flex px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded text-xs">
                                No match
                              </span>
                            }
                          >
                            <div class="flex items-center gap-2">
                              <span
                                class={`inline-flex px-2 py-0.5 rounded text-xs ${
                                  (mapping.confidence ?? 0) >= 0.9
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {Math.round((mapping.confidence ?? 0) * 100)}%
                              </span>
                              <span
                                class="text-xs text-zinc-500 dark:text-slate-400 truncate max-w-[120px]"
                                title={mapping.deviceId!}
                              >
                                {mapping.deviceId}
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
              Showing {filteredMappings().length} of {total()} mappings
            </div>
          </div>
        </Show>

        {/* Detail Modal */}
        <Show when={selectedMapping()}>
          <div
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedMapping(null)}
          >
            <div
              class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div class="p-6 border-b border-zinc-200 dark:border-slate-800 flex items-center justify-between">
                <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">Mapping Details</h2>
                <button
                  onClick={() => setSelectedMapping(null)}
                  class="p-2 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-zinc-500"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div class="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                <DetailRow label="Raw Model" value={selectedMapping()!.rawModel} mono />
                <DetailRow label="Normalized" value={selectedMapping()!.normalizedModel || "—"} mono />
                <DetailRow label="Source" value={selectedMapping()!.source} />
                <div>
                  <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    Status
                  </div>
                  <StatusBadge status={selectedMapping()!.status} />
                </div>
                <DetailRow label="Usage Count" value={String(selectedMapping()!.usageCount)} />
                <DetailRow label="First Seen" value={formatDate(selectedMapping()!.firstSeenAt)} />
                <DetailRow label="Last Seen" value={formatDate(selectedMapping()!.lastSeenAt)} />
                <DetailRow
                  label="Matched Device"
                  value={selectedMapping()!.deviceId || "No match"}
                  mono
                  highlight={!selectedMapping()!.deviceId ? "rose" : "emerald"}
                />
                <DetailRow
                  label="Confidence"
                  value={
                    selectedMapping()!.confidence !== null
                      ? `${Math.round(selectedMapping()!.confidence! * 100)}%`
                      : "N/A"
                  }
                />
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

function StatCard(props: { label: string; value: number; color?: "emerald" | "amber" | "rose" }) {
  const colorClasses = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
  };

  return (
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4">
      <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide">
        {props.label}
      </div>
      <div
        class={`text-2xl font-bold mt-1 ${props.color ? colorClasses[props.color] : "text-zinc-900 dark:text-white"}`}
      >
        {props.value.toLocaleString()}
      </div>
    </div>
  );
}

function DetailRow(props: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "emerald" | "rose";
}) {
  return (
    <div>
      <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {props.label}
      </div>
      <div
        class={`text-sm text-zinc-900 dark:text-white break-all ${props.mono ? "font-mono" : ""} ${
          props.highlight === "emerald"
            ? "text-emerald-600 dark:text-emerald-400"
            : props.highlight === "rose"
              ? "text-rose-600 dark:text-rose-400"
              : ""
        }`}
      >
        {props.value}
      </div>
    </div>
  );
}
