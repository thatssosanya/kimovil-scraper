import { createSignal, Show, onMount, createEffect } from "solid-js";
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
  const [period, setPeriod] = createSignal<PeriodOption>("all");

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
    setSelectedMapping(mapping);
  };

  const closeModal = () => {
    setSelectedMapping(null);
  };

  const handleMappingUpdated = () => {
    fetchMappings();
  };

  onMount(() => {
    fetchMappings();
    fetchSyncStatus();
  });

  createEffect(() => {
    statusTab();
    period();
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

  const needsReviewCount = () =>
    mappings().filter((m) => m.status === "pending" || m.status === "suggested").length;
  const confirmedCount = () =>
    mappings().filter((m) => m.status === "confirmed" || m.status === "auto_confirmed").length;

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
        />
      </div>
    </div>
  );
}
