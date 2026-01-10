import { createSignal, createMemo, Show, onMount, createEffect, onCleanup, on } from "solid-js";
import { Header } from "../../components/Header";
import {
  type WidgetMapping,
  type SyncStatus,
  type SortField,
  type StatusTab,
  type PeriodOption,
  PERIOD_OPTIONS,
} from "./WidgetDebug.types";
import * as api from "../../api/widgetMappings";
import * as analyticsApi from "../../api/analytics";
import { SyncStatusCard } from "./components/SyncStatusCard";
import { StatsRow } from "./components/StatsRow";
import { FiltersBar } from "./components/FiltersBar";
import { MappingsTable } from "./components/MappingsTable";
import { MappingModal } from "./modal/MappingModal";

const getPeriodTimestamps = (period: PeriodOption): { seenAfter?: number; seenBefore?: number } => {
  const option = PERIOD_OPTIONS.find((p) => p.id === period);
  if (!option || option.days === null) return {};

  const now = Math.floor(Date.now() / 1000);
  const seenAfter = now - option.days * 24 * 60 * 60;
  return { seenAfter, seenBefore: now };
};

const parseStatusTab = (value: string | null): StatusTab => {
  const allowed: StatusTab[] = ["all", "needs_review", "auto_confirmed", "confirmed", "ignored"];
  return allowed.includes(value as StatusTab) ? (value as StatusTab) : "all";
};

const parsePeriod = (value: string | null): PeriodOption => {
  const allowed: PeriodOption[] = ["all", "1d", "7d", "30d", "90d"];
  return allowed.includes(value as PeriodOption) ? (value as PeriodOption) : "all";
};

const parseSortField = (value: string | null): SortField => {
  const allowed: SortField[] = ["usageCount", "rawModel", "status", "confidence"];
  return allowed.includes(value as SortField) ? (value as SortField) : "usageCount";
};

const parseOrder = (value: string | null): boolean => {
  return value !== "asc";
};

function updateQuery(paramsUpdater: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search);
  paramsUpdater(params);
  const search = params.toString();
  const url = `${window.location.pathname}${search ? "?" + search : ""}`;
  history.replaceState(null, "", url);
}

export default function WidgetDebug() {
  const [mappings, setMappings] = createSignal<WidgetMapping[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");
  const [sortField, setSortField] = createSignal<SortField>("usageCount");
  const [sortDesc, setSortDesc] = createSignal(true);
  const [statusTab, setStatusTab] = createSignal<StatusTab>("all");
  const [selectedRawModel, setSelectedRawModel] = createSignal<string | null>(null);
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus | null>(null);
  const [syncing, setSyncing] = createSignal(false);
  const [period, setPeriod] = createSignal<PeriodOption>("all");
  const [initializing, setInitializing] = createSignal(true);

  const selectedMapping = createMemo(() => mappings().find((m) => m.rawModel === selectedRawModel()) ?? null);

  const fetchMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const tab = statusTab();
      const periodTs = getPeriodTimestamps(period());
      const json = await api.getMappings({
        limit: 1000,
        status: tab === "all" ? undefined : tab,
        seenAfter: periodTs.seenAfter,
        seenBefore: periodTs.seenBefore,
      });
      
      // Fetch analytics data for mappings
      const mappingIds = json.mappings
        .map((m) => m.id)
        .filter((id): id is number => id != null);
      
      const analyticsData = await analyticsApi.getMappingStats(mappingIds);
      const analyticsMap = new Map(analyticsData.map((a) => [a.mappingId, a]));
      
      // Merge analytics into mappings
      const mappingsWithAnalytics = json.mappings.map((m) => {
        const stats = analyticsMap.get(m.id);
        return {
          ...m,
          impressions: stats?.impressions,
          clicks: stats?.clicks,
        };
      });
      
      setMappings(mappingsWithAnalytics);
      setTotal(json.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const json = await api.getSyncStatus();
      setSyncStatus(json);
    } catch (e) {
      console.error("Failed to fetch sync status:", e);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.triggerSync();
      await fetchSyncStatus();
      await fetchMappings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const openMappingEditor = (mapping: WidgetMapping) => {
    setSelectedRawModel(mapping.rawModel);
  };

  const closeModal = () => {
    setSelectedRawModel(null);
  };

  const handleMappingUpdated = () => {
    fetchMappings();
  };

  const navigateMapping = (direction: -1 | 1) => {
    const currentRawModel = selectedRawModel();
    if (!currentRawModel) return;

    const list = mappings();
    const currentIdx = list.findIndex((m) => m.rawModel === currentRawModel);
    if (currentIdx === -1) return;

    const newIdx = currentIdx + direction;
    if (newIdx >= 0 && newIdx < list.length) {
      setSelectedRawModel(list[newIdx].rawModel);
    }
  };

  onMount(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setStatusTab(parseStatusTab(params.get("status")));
      setPeriod(parsePeriod(params.get("period")));
      setSearch(params.get("q") ?? "");
      setSortField(parseSortField(params.get("sort")));
      setSortDesc(parseOrder(params.get("order")));
      setSelectedRawModel(params.get("mapping"));
    };

    window.addEventListener("popstate", handlePopState);
    onCleanup(() => window.removeEventListener("popstate", handlePopState));

    const params = new URLSearchParams(window.location.search);
    setStatusTab(parseStatusTab(params.get("status")));
    setPeriod(parsePeriod(params.get("period")));
    setSearch(params.get("q") ?? "");
    setSortField(parseSortField(params.get("sort")));
    setSortDesc(parseOrder(params.get("order")));

    const mappingParam = params.get("mapping");
    if (mappingParam) {
      setSelectedRawModel(mappingParam);
    }

    setInitializing(false);
    fetchMappings();
    fetchSyncStatus();
  });

  createEffect(
    on([statusTab, period], () => {
      fetchMappings();
    }, { defer: true })
  );

  createEffect(() => {
    const status = statusTab();
    const periodVal = period();
    const qVal = search();
    const sort = sortField();
    const desc = sortDesc();
    const mapping = selectedRawModel();

    if (initializing()) return;

    updateQuery((params) => {
      status === "all" ? params.delete("status") : params.set("status", status);
      periodVal === "all" ? params.delete("period") : params.set("period", periodVal);
      qVal ? params.set("q", qVal) : params.delete("q");
      sort === "usageCount" ? params.delete("sort") : params.set("sort", sort);
      desc ? params.delete("order") : params.set("order", "asc");
      mapping ? params.set("mapping", mapping) : params.delete("mapping");
    });
  });

  const filteredMappings = createMemo(() => {
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
  });

  const toggleSort = (field: SortField) => {
    if (sortField() === field) {
      setSortDesc(!sortDesc());
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const needsReviewCount = createMemo(() =>
    mappings().filter((m) => m.status === "pending" || m.status === "suggested").length
  );
  const confirmedCount = createMemo(() =>
    mappings().filter((m) => m.status === "confirmed" || m.status === "auto_confirmed").length
  );

  return (
    <div class="min-h-screen bg-zinc-100 dark:bg-slate-950">
      <Header currentPage="widget-debug" />

      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">Widget Debug</h1>
          <p class="text-sm text-zinc-500 dark:text-slate-400 mt-1">
            Analyze WordPress widget models and match them to device slugs
          </p>
        </div>

        <SyncStatusCard syncStatus={syncStatus()} syncing={syncing()} onSync={handleSync} />

        <StatsRow total={total()} needsReviewCount={needsReviewCount()} confirmedCount={confirmedCount()} />

        <FiltersBar
          search={search()}
          onSearchChange={setSearch}
          statusTab={statusTab()}
          onStatusTabChange={setStatusTab}
          period={period()}
          onPeriodChange={setPeriod}
          loading={loading()}
          syncing={syncing()}
          onRefresh={fetchMappings}
        />

        <Show when={error()}>
          <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-4 text-rose-600 dark:text-rose-400">
            {error()}
          </div>
        </Show>

        <Show when={loading() || syncing()}>
          <div class="flex items-center justify-center py-12 gap-3">
            <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span class="text-zinc-500 dark:text-slate-400">
              {syncing() ? "Syncing from WordPress..." : "Loading..."}
            </span>
          </div>
        </Show>

        <Show when={!loading() && !syncing()}>
          <MappingsTable
            mappings={filteredMappings()}
            sortField={sortField()}
            sortDesc={sortDesc()}
            onSortChange={toggleSort}
            onRowClick={openMappingEditor}
            total={total()}
          />
        </Show>

        <MappingModal
          mapping={selectedMapping()}
          onClose={closeModal}
          onMappingUpdated={handleMappingUpdated}
          onNavigate={navigateMapping}
        />
      </div>
    </div>
  );
}
