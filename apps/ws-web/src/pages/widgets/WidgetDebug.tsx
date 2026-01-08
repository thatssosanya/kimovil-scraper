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

interface SuggestedMatch {
  deviceId: string;
  slug: string;
  name: string;
  confidence: number;
}

interface DeviceSearchResult {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
}

type SortField = "usageCount" | "rawModel" | "status" | "confidence";
type StatusTab = "all" | "needs_review" | "auto_confirmed" | "confirmed" | "ignored";

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs Review" },
  { id: "auto_confirmed", label: "Auto-confirmed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "ignored", label: "Ignored" },
];

const fetchMappingWithSuggestions = async (rawModel: string) => {
  const res = await fetch(
    `http://localhost:1488/api/widget-mappings/${encodeURIComponent(rawModel)}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ mapping: WidgetMapping | null; suggestions: SuggestedMatch[] }>;
};

const searchDevices = async (query: string) => {
  const res = await fetch(
    `http://localhost:1488/api/widget-mappings/devices/search?q=${encodeURIComponent(query)}&limit=10`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<DeviceSearchResult[]>;
};

const updateMapping = async (
  rawModel: string,
  update: { deviceId?: string | null; status?: MappingStatus }
) => {
  const res = await fetch(
    `http://localhost:1488/api/widget-mappings/${encodeURIComponent(rawModel)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

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
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus | null>(null);
  const [syncing, setSyncing] = createSignal(false);

  // Modal state
  const [modalLoading, setModalLoading] = createSignal(false);
  const [suggestions, setSuggestions] = createSignal<SuggestedMatch[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = createSignal<string | null>(null);
  const [selectedDeviceName, setSelectedDeviceName] = createSignal<string | null>(null);
  const [deviceSearch, setDeviceSearch] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<DeviceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [actionLoading, setActionLoading] = createSignal(false);

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

  const openMappingEditor = async (mapping: WidgetMapping, _listIndex?: number) => {
    setSelectedMapping(mapping);
    setModalLoading(true);
    setSuggestions([]);
    setSelectedDeviceId(mapping.deviceId);
    setSelectedDeviceName(null);
    setDeviceSearch("");
    setSearchResults([]);

    try {
      const data = await fetchMappingWithSuggestions(mapping.rawModel);
      setSuggestions(data.suggestions);
      if (mapping.deviceId) {
        const match = data.suggestions.find((s) => s.deviceId === mapping.deviceId);
        if (match) {
          setSelectedDeviceName(match.name);
        }
      }
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedMapping(null);
    setSuggestions([]);
    setSelectedDeviceId(null);
    setSelectedDeviceName(null);
    setDeviceSearch("");
    setSearchResults([]);
  };

  const advanceToNext = (justReviewedRawModel?: string) => {
    const needsReview = filteredMappings().filter(
      (m) => m.status === "pending" || m.status === "suggested"
    );

    if (needsReview.length === 0) {
      closeModal();
      return;
    }

    // Find the index of the just-reviewed item in the new needs_review list
    // It should not be there anymore (status changed), but if it is, skip past it
    let nextIdx = 0;
    if (justReviewedRawModel) {
      const oldIdx = needsReview.findIndex((m) => m.rawModel === justReviewedRawModel);
      // If not found (expected), start at index 0; if found, go to next
      nextIdx = oldIdx === -1 ? 0 : Math.min(oldIdx, needsReview.length - 1);
    }

    const next = needsReview[nextIdx];
    if (next) {
      openMappingEditor(next, nextIdx);
    } else {
      closeModal();
    }
  };

  const handleConfirm = async () => {
    const mapping = selectedMapping();
    if (!mapping || !selectedDeviceId()) return;

    const rawModel = mapping.rawModel;
    setActionLoading(true);
    try {
      await updateMapping(rawModel, {
        deviceId: selectedDeviceId(),
        status: "confirmed",
      });
      await fetchMappings();
      advanceToNext(rawModel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setActionLoading(false);
    }
  };

  const handleIgnore = async () => {
    const mapping = selectedMapping();
    if (!mapping) return;

    const rawModel = mapping.rawModel;
    setActionLoading(true);
    try {
      await updateMapping(rawModel, { status: "ignored" });
      await fetchMappings();
      advanceToNext(rawModel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setActionLoading(false);
    }
  };

  const selectSuggestion = (suggestion: SuggestedMatch) => {
    setSelectedDeviceId(suggestion.deviceId);
    setSelectedDeviceName(suggestion.name);
  };

  const selectSearchResult = (result: DeviceSearchResult) => {
    setSelectedDeviceId(result.id);
    setSelectedDeviceName(result.name);
    setSearchResults([]);
    setDeviceSearch("");
  };

  const clearSelection = () => {
    setSelectedDeviceId(null);
    setSelectedDeviceName(null);
  };

  let searchTimeout: ReturnType<typeof setTimeout>;
  const handleDeviceSearch = (query: string) => {
    setDeviceSearch(query);
    clearTimeout(searchTimeout);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    searchTimeout = setTimeout(async () => {
      try {
        const results = await searchDevices(query);
        setSearchResults(results);
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
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
    const d = new Date(ts * 1000);
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

        {/* Filters */}
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4 mb-6">
          <div class="flex flex-col md:flex-row gap-4 items-start md:items-center">
            {/* Search */}
            <input
              type="text"
              placeholder="Search models..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              class="flex-1 px-3 py-2 text-sm bg-zinc-100 dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-slate-400"
            />

            {/* Status Tabs */}
            <div class="flex gap-1 bg-zinc-100 dark:bg-slate-800 rounded-lg p-1">
              <For each={STATUS_TABS}>
                {(tab) => (
                  <button
                    onClick={() => setStatusTab(tab.id)}
                    class={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      statusTab() === tab.id
                        ? "bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
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
                    {(mapping, idx) => (
                      <tr
                        class="hover:bg-zinc-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => openMappingEditor(mapping, idx())}
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

        {/* Mapping Editor Modal */}
        <Show when={selectedMapping()}>
          <div
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <div
              class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div class="p-6 border-b border-zinc-200 dark:border-slate-800 flex-shrink-0">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <h2 class="text-lg font-semibold text-zinc-900 dark:text-white truncate">
                      {selectedMapping()!.rawModel}
                    </h2>
                    <Show when={selectedMapping()!.normalizedModel}>
                      <p class="text-sm text-zinc-500 dark:text-slate-400 mt-0.5 truncate">
                        {selectedMapping()!.normalizedModel}
                      </p>
                    </Show>
                    <div class="flex items-center gap-3 mt-2">
                      <StatusBadge status={selectedMapping()!.status} />
                      <span class="text-xs text-zinc-500 dark:text-slate-400">
                        Used {selectedMapping()!.usageCount} times
                      </span>
                      <span class="text-xs text-zinc-500 dark:text-slate-400">
                        First seen: {formatDate(selectedMapping()!.firstSeenAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    class="p-2 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-zinc-500 flex-shrink-0"
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
              </div>

              {/* Content */}
              <div class="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Loading state */}
                <Show when={modalLoading()}>
                  <div class="flex items-center justify-center py-8 gap-3">
                    <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span class="text-zinc-500 dark:text-slate-400">Loading suggestions...</span>
                  </div>
                </Show>

                <Show when={!modalLoading()}>
                  {/* Selected Device */}
                  <Show when={selectedDeviceId()}>
                    <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">
                            Selected Device
                          </div>
                          <div class="font-medium text-zinc-900 dark:text-white">
                            {selectedDeviceName() ?? selectedDeviceId()}
                          </div>
                          <div class="text-xs text-zinc-500 dark:text-slate-400 font-mono mt-0.5">
                            {selectedDeviceId()}
                          </div>
                        </div>
                        <button
                          onClick={clearSelection}
                          class="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-slate-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </Show>

                  {/* Suggested Matches */}
                  <Show when={suggestions().length > 0}>
                    <div>
                      <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                        Suggested Matches
                      </div>
                      <div class="space-y-2">
                        <For each={suggestions().slice(0, 5)}>
                          {(suggestion, idx) => (
                            <button
                              onClick={() => selectSuggestion(suggestion)}
                              class={`w-full text-left p-3 rounded-xl border transition-colors ${
                                selectedDeviceId() === suggestion.deviceId
                                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                                  : "border-zinc-200 dark:border-slate-800 hover:border-zinc-300 dark:hover:border-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3 min-w-0">
                                  <div
                                    class={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                      selectedDeviceId() === suggestion.deviceId
                                        ? "border-indigo-500 bg-indigo-500"
                                        : "border-zinc-300 dark:border-slate-600"
                                    }`}
                                  >
                                    <Show when={selectedDeviceId() === suggestion.deviceId}>
                                      <div class="w-1.5 h-1.5 bg-white rounded-full" />
                                    </Show>
                                  </div>
                                  <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                      <span class="font-medium text-zinc-900 dark:text-white truncate">
                                        {suggestion.name}
                                      </span>
                                      <Show when={idx() === 0 && suggestion.confidence >= 0.97}>
                                        <span class="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs font-medium">
                                          Recommended
                                        </span>
                                      </Show>
                                    </div>
                                    <div class="text-xs text-zinc-500 dark:text-slate-400 font-mono truncate">
                                      {suggestion.slug}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  class={`px-2 py-0.5 rounded text-xs font-medium ${
                                    suggestion.confidence >= 0.9
                                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                  }`}
                                >
                                  {Math.round(suggestion.confidence * 100)}%
                                </span>
                              </div>
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  {/* Device Search */}
                  <div>
                    <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                      Search Devices
                    </div>
                    <div class="relative">
                      <input
                        type="text"
                        placeholder="Search by name, slug, or brand..."
                        value={deviceSearch()}
                        onInput={(e) => handleDeviceSearch(e.currentTarget.value)}
                        class="w-full px-3 py-2 text-sm bg-zinc-100 dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-slate-400"
                      />
                      <Show when={searchLoading()}>
                        <div class="absolute right-3 top-1/2 -translate-y-1/2">
                          <div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      </Show>
                    </div>

                    {/* Search Results */}
                    <Show when={searchResults().length > 0}>
                      <div class="mt-2 border border-zinc-200 dark:border-slate-800 rounded-lg overflow-hidden">
                        <For each={searchResults()}>
                          {(result) => (
                            <button
                              onClick={() => selectSearchResult(result)}
                              class="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-slate-800/50 transition-colors border-b last:border-b-0 border-zinc-100 dark:border-slate-800"
                            >
                              <div class="flex items-center justify-between">
                                <div class="min-w-0">
                                  <div class="font-medium text-zinc-900 dark:text-white text-sm truncate">
                                    {result.name}
                                  </div>
                                  <div class="text-xs text-zinc-500 dark:text-slate-400 font-mono truncate">
                                    {result.slug}
                                  </div>
                                </div>
                                <Show when={result.brand}>
                                  <span class="text-xs text-zinc-500 dark:text-slate-400 flex-shrink-0 ml-2">
                                    {result.brand}
                                  </span>
                                </Show>
                              </div>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>

              {/* Footer Actions */}
              <div class="p-6 border-t border-zinc-200 dark:border-slate-800 flex-shrink-0">
                <div class="flex items-center justify-end gap-3">
                  <button
                    onClick={closeModal}
                    disabled={actionLoading()}
                    class="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-slate-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleIgnore}
                    disabled={actionLoading()}
                    class="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Show when={actionLoading()}>
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </Show>
                    Ignore
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={actionLoading() || !selectedDeviceId()}
                    class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Show when={actionLoading()}>
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </Show>
                    Confirm & Lock
                  </button>
                </div>
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
