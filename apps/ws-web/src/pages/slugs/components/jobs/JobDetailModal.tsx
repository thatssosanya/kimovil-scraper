import { createSignal, createEffect, Show, For, on, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { JobTypeBadge, JobActions, JobWorkersSelect } from "./index";
import {
  type JobEntry,
  type DisplayStatus,
  progressPercent,
  statusPillClass,
  statusLabel,
} from "./jobViewHelpers";
import type { JobOutcome, OutcomeStats, DiscoveryMetadata } from "../../types";

interface JobItem {
  id: number;
  externalId: string;
  deviceId: string;
  deviceName: string;
  deviceSlug: string;
  status: "pending" | "running" | "done" | "error";
  errorMessage: string | null;
  completedAt: number | null;
  attempt: number;
  outcome?: JobOutcome | null;
  outcomeMessage?: string | null;
}

interface JobSummary {
  job: {
    id: string;
    jobType: string;
    mode: string;
    aiMode: string | null;
    status: string;
    filter: string | null;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    errorMessage: string | null;
    totalCount: number | null;
    queuedCount: number | null;
    batchRequestId: string | null;
    batchStatus: string | null;
    source: string;
    dataKind: string;
    metadata: DiscoveryMetadata | null;
  };
  stats: {
    total: number;
    pending: number;
    running: number;
    done: number;
    error: number;
    timeout?: {
      count: number;
      nextRetryAt: number | null;
      nextRetryExternalId: string | null;
    };
    outcomes?: OutcomeStats;
  };
  items: JobItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

type FilterTab = "all" | "done" | "error" | "pending" | "running";

interface JobDetailModalProps {
  job: JobEntry;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onSetWorkers: (count: number) => void;
  formatTimeRemaining: (timestamp: number | null) => string;
}

export function JobDetailModal(props: JobDetailModalProps) {
  const [summary, setSummary] = createSignal<JobSummary | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [activeFilter, setActiveFilter] = createSignal<FilterTab>("all");
  const [loadingMore, setLoadingMore] = createSignal(false);

  const displayStatus = (): DisplayStatus => props.job.job.status;
  const percentComplete = () => progressPercent(props.job.stats);
  const hasErrors = () => props.job.stats.error > 0;
  const completed = () => props.job.stats.done + props.job.stats.error;

  // Lock body scroll when modal is open
  createEffect(() => {
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.body.style.overflow = "";
    });
  });

  const fetchSummary = async (filter: FilterTab, offset = 0, append = false) => {
    const statusParam = filter === "all" ? "" : `&status=${filter}`;
    const url = `http://localhost:1488/api/jobs/${props.job.job.id}/summary?limit=50&offset=${offset}${statusParam}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        console.error("Failed to fetch job summary:", data.error);
        return;
      }

      if (append && summary()) {
        setSummary({
          ...data,
          items: [...summary()!.items, ...data.items],
        });
      } else {
        setSummary(data);
      }
    } catch (err) {
      console.error("Failed to fetch job summary:", err);
    }
  };

  createEffect(
    on(
      () => props.job.job.id,
      async () => {
        setLoading(true);
        setActiveFilter("all");
        await fetchSummary("all");
        setLoading(false);
      },
    ),
  );

  createEffect(
    on(activeFilter, async (filter) => {
      if (!loading()) {
        setLoading(true);
        await fetchSummary(filter);
        setLoading(false);
      }
    }),
  );

  const handleLoadMore = async () => {
    if (!summary() || loadingMore()) return;
    const currentOffset = summary()!.items.length;
    setLoadingMore(true);
    await fetchSummary(activeFilter(), currentOffset, true);
    setLoadingMore(false);
  };

  const hasMoreItems = () => {
    if (!summary()) return false;
    return summary()!.items.length < summary()!.pagination.total;
  };

  const barColor = () => {
    const s = displayStatus();
    if (s === "error") return "bg-rose-500";
    if (s === "done") return "bg-emerald-500";
    return "bg-gradient-to-r from-indigo-500 to-cyan-400";
  };

  const getOutcomeIcon = (outcome: JobOutcome | null | undefined) => {
    switch (outcome) {
      case "success":
        return (
          <div class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case "not_found":
        return (
          <div class="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 8v4m0 4h.01" />
            </svg>
          </div>
        );
      case "no_offers":
        return (
          <div class="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        );
      case "no_data":
        return (
          <div class="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case "skipped":
        return (
          <div class="w-6 h-6 rounded-full bg-zinc-300/30 dark:bg-slate-700/50 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-zinc-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </div>
        );
      default:
        return (
          <div class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
    }
  };

  const getItemStatusIcon = (status: string, outcome?: JobOutcome | null) => {
    switch (status) {
      case "done":
        return getOutcomeIcon(outcome);
      case "error":
        return (
          <div class="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case "running":
        return (
          <div class="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
            <div class="w-2 h-2 rounded-full bg-indigo-400" />
          </div>
        );
      default:
        return (
          <div class="w-6 h-6 rounded-full bg-zinc-200 dark:bg-slate-700 flex items-center justify-center">
            <div class="w-2 h-2 rounded-full bg-zinc-400 dark:bg-slate-500" />
          </div>
        );
    }
  };

  const getOutcomeLabel = (outcome: JobOutcome | null | undefined): string => {
    switch (outcome) {
      case "success": return "Completed";
      case "not_found": return "Not found";
      case "no_offers": return "No offers";
      case "no_data": return "No data";
      case "skipped": return "Skipped";
      default: return "Done";
    }
  };

  const filterTabs: { id: FilterTab; label: string; count: () => number; color: string }[] = [
    { id: "all", label: "All", count: () => props.job.stats.total, color: "zinc" },
    { id: "done", label: "Done", count: () => props.job.stats.done, color: "emerald" },
    { id: "error", label: "Errors", count: () => props.job.stats.error, color: "rose" },
    { id: "pending", label: "Pending", count: () => props.job.stats.pending, color: "zinc" },
    { id: "running", label: "Running", count: () => props.job.stats.running, color: "indigo" },
  ];

  return (
    <Portal>
      <div
        class="fixed inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
      >
        <div
          class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl h-[calc(100vh-2rem)] max-h-[800px] flex flex-col shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div class="flex-shrink-0 border-b border-zinc-100 dark:border-slate-800">
          <div class="px-6 py-5">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <h2 class="text-lg font-semibold text-zinc-900 dark:text-white truncate">
                    Job {props.job.job.id.slice(0, 8)}
                  </h2>
                  <span
                    class={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${statusPillClass(displayStatus(), hasErrors())}`}
                  >
                    {statusLabel(displayStatus(), hasErrors())}
                  </span>
                  <JobTypeBadge
                    jobType={props.job.job.jobType ?? "scrape"}
                    batchStatus={props.job.job.batchStatus ?? undefined}
                    source={props.job.job.source}
                    dataKind={props.job.job.dataKind}
                  />
                </div>
                <div class="flex items-center gap-4 text-xs text-zinc-500 dark:text-slate-500">
                  <span>Created: {new Date(props.job.job.createdAt * 1000).toLocaleString()}</span>
                  <Show when={props.job.job.startedAt}>
                    <span>Started: {new Date(props.job.job.startedAt! * 1000).toLocaleTimeString()}</span>
                  </Show>
                  <Show when={props.job.job.completedAt}>
                    <span>Completed: {new Date(props.job.job.completedAt! * 1000).toLocaleTimeString()}</span>
                  </Show>
                </div>
              </div>
              <button
                class="p-2 text-zinc-400 dark:text-slate-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                onClick={props.onClose}
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div class="px-6 pb-4">
            <div class="flex justify-between text-xs mb-2">
              <span class="text-zinc-500 dark:text-slate-400 font-medium">
                {completed()} / {props.job.stats.total} items processed
              </span>
              <span class="text-indigo-600 dark:text-indigo-400 font-bold">{percentComplete()}%</span>
            </div>
            <div class="h-2.5 bg-zinc-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                class={`h-full transition-all duration-500 ease-out ${barColor()}`}
                style={{ width: `${percentComplete()}%` }}
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div class="px-6 pb-4">
            <div class="grid grid-cols-5 gap-2">
              <div class="bg-zinc-50 dark:bg-slate-800/50 p-3 rounded-xl text-center">
                <div class="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-slate-500 font-bold mb-1">Pending</div>
                <div class="text-xl font-mono font-semibold text-zinc-600 dark:text-slate-300">{props.job.stats.pending}</div>
              </div>
              <div class="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl text-center">
                <div class="text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-400 font-bold mb-1">Running</div>
                <div class="text-xl font-mono font-semibold text-indigo-600 dark:text-indigo-300">{props.job.stats.running}</div>
              </div>
              <div class="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl text-center group relative">
                <div class="text-[10px] uppercase tracking-wider text-emerald-500 dark:text-emerald-400 font-bold mb-1">Done</div>
                <div class="text-xl font-mono font-semibold text-emerald-600 dark:text-emerald-300">{props.job.stats.done}</div>
                <Show when={summary()?.stats?.outcomes && (summary()!.stats.outcomes!.not_found > 0 || summary()!.stats.outcomes!.no_offers > 0 || summary()!.stats.outcomes!.skipped > 0)}>
                  <div class="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 hidden group-hover:block">
                    <div class="bg-slate-900 dark:bg-slate-800 text-white rounded-lg px-3 py-2 text-xs shadow-xl border border-slate-700/50 whitespace-nowrap">
                      <div class="flex flex-col gap-1">
                        <Show when={summary()!.stats.outcomes!.success > 0}>
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>{summary()!.stats.outcomes!.success} success</span>
                          </div>
                        </Show>
                        <Show when={summary()!.stats.outcomes!.not_found > 0}>
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-amber-400" />
                            <span>{summary()!.stats.outcomes!.not_found} not found</span>
                          </div>
                        </Show>
                        <Show when={summary()!.stats.outcomes!.no_offers > 0}>
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-amber-400" />
                            <span>{summary()!.stats.outcomes!.no_offers} no offers</span>
                          </div>
                        </Show>
                        <Show when={summary()!.stats.outcomes!.skipped > 0}>
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-zinc-400" />
                            <span>{summary()!.stats.outcomes!.skipped} skipped</span>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>
                </Show>
              </div>
              <div class="bg-rose-50 dark:bg-rose-500/10 p-3 rounded-xl text-center">
                <div class="text-[10px] uppercase tracking-wider text-rose-500 dark:text-rose-400 font-bold mb-1">Errors</div>
                <div class="text-xl font-mono font-semibold text-rose-600 dark:text-rose-300">{props.job.stats.error}</div>
              </div>
              <Show when={props.job.stats.timeout?.count}>
                <div class="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl text-center">
                  <div class="text-[10px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold mb-1">Timeout</div>
                  <div class="text-xl font-mono font-semibold text-amber-600 dark:text-amber-300">
                    {props.job.stats.timeout!.count}
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Filter Tabs */}
          <div class="px-6 pb-3">
            <div class="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-slate-800/50 rounded-xl">
              <For each={filterTabs}>
                {(tab) => (
                  <button
                    class={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeFilter() === tab.id
                        ? "bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300"
                    }`}
                    onClick={() => setActiveFilter(tab.id)}
                  >
                    <span>{tab.label}</span>
                    <span class={`ml-1.5 ${activeFilter() === tab.id ? "opacity-100" : "opacity-50"}`}>
                      {tab.count()}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Items List / Discovery Stats */}
        <div class="flex-1 overflow-auto min-h-0">
          <Show when={loading()}>
            <div class="flex items-center justify-center py-16">
              <div class="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          </Show>

          {/* Discovery Stats for discover_latest jobs */}
          <Show when={!loading() && summary() && props.job.job.jobType === "discover_latest" && summary()!.job.metadata?.crawlResult}>
            <div class="p-6">
              <div class="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-2xl p-6 border border-emerald-200/50 dark:border-emerald-500/20">
                <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-4 flex items-center gap-2">
                  <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="7" cy="7" r="4" />
                    <path d="M10 10l4 4" stroke-linecap="round" />
                    <path d="M7 5v4M5 7h4" stroke-linecap="round" opacity="0.6" />
                  </svg>
                  Discovery Results
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div class="text-center">
                    <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {summary()!.job.metadata!.crawlResult.discovered}
                    </div>
                    <div class="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">New Devices</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                      {summary()!.job.metadata!.crawlResult.queued}
                    </div>
                    <div class="text-xs text-cyan-600/70 dark:text-cyan-400/70 mt-1">Queued</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-zinc-500 dark:text-slate-400">
                      {summary()!.job.metadata!.crawlResult.alreadyKnown}
                    </div>
                    <div class="text-xs text-zinc-500/70 dark:text-slate-500 mt-1">Already Known</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-zinc-400 dark:text-slate-500">
                      {summary()!.job.metadata!.crawlResult.alreadyScraped}
                    </div>
                    <div class="text-xs text-zinc-400/70 dark:text-slate-600 mt-1">Already Scraped</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-slate-500 dark:text-slate-400">
                      {summary()!.job.metadata!.crawlResult.pagesScanned}
                    </div>
                    <div class="text-xs text-slate-500/70 dark:text-slate-500 mt-1">Pages Scanned</div>
                  </div>
                </div>

                <Show when={summary()!.job.metadata!.spawnedScrapeJobId}>
                  <div class="mt-6 pt-4 border-t border-emerald-200/50 dark:border-emerald-500/20">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-emerald-700/80 dark:text-emerald-400/80">
                        Spawned scrape job for {summary()!.job.metadata!.crawlResult.queued} devices
                      </span>
                      <span class="font-mono text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded">
                        {summary()!.job.metadata!.spawnedScrapeJobId!.slice(0, 12)}
                      </span>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* Regular items list for non-discovery jobs */}
          <Show when={!loading() && summary() && props.job.job.jobType !== "discover_latest"}>
            <div class="divide-y divide-zinc-100 dark:divide-slate-800">
              <For each={summary()!.items}>
                {(item) => (
                  <div class="px-6 py-3 hover:bg-zinc-50 dark:hover:bg-slate-800/30 transition-colors">
                    <div class="flex items-center gap-4">
                      {getItemStatusIcon(item.status, item.outcome)}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-sm text-zinc-800 dark:text-slate-200 truncate">
                            {item.deviceName}
                          </span>
                          <span class="text-xs text-zinc-400 dark:text-slate-600 font-mono truncate">
                            {item.deviceSlug}
                          </span>
                          <Show when={item.status === "done" && item.outcome && item.outcome !== "success"}>
                            <span class={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.outcome === "not_found" || item.outcome === "no_offers" || item.outcome === "no_data" 
                                ? "bg-amber-500/10 text-amber-500 dark:text-amber-400"
                                : "bg-zinc-200 dark:bg-slate-700 text-zinc-500 dark:text-slate-400"
                            }`}>
                              {getOutcomeLabel(item.outcome)}
                            </span>
                          </Show>
                        </div>
                        <Show when={item.outcomeMessage && item.outcome !== "success"}>
                          <p class="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5 line-clamp-1">
                            {item.outcomeMessage}
                          </p>
                        </Show>
                        <Show when={item.errorMessage}>
                          <p class="text-xs text-rose-500 dark:text-rose-400 mt-0.5 line-clamp-1">
                            {item.errorMessage}
                          </p>
                        </Show>
                      </div>
                      <div class="flex-shrink-0 text-right">
                        <Show when={item.completedAt}>
                          <span class="text-xs text-zinc-400 dark:text-slate-500">
                            {new Date(item.completedAt! * 1000).toLocaleTimeString()}
                          </span>
                        </Show>
                        <Show when={item.attempt > 1}>
                          <div class="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5">
                            Attempt {item.attempt}
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <Show when={hasMoreItems()}>
              <div class="px-6 py-4 border-t border-zinc-100 dark:border-slate-800">
                <button
                  class="w-full py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  onClick={handleLoadMore}
                  disabled={loadingMore()}
                >
                  <Show when={loadingMore()} fallback={
                    <>Load more ({summary()!.pagination.total - summary()!.items.length} remaining)</>
                  }>
                    <div class="flex items-center justify-center gap-2">
                      <div class="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                      Loading...
                    </div>
                  </Show>
                </button>
              </div>
            </Show>

            <Show when={summary()!.items.length === 0}>
              <div class="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-slate-500">
                <svg class="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span class="text-sm">No items found</span>
              </div>
            </Show>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-zinc-100 dark:border-slate-800 bg-zinc-50/50 dark:bg-slate-800/30">
          <div class="flex items-center gap-3">
            <span class="text-xs text-zinc-500 dark:text-slate-500 font-medium">Workers:</span>
            <JobWorkersSelect
              workerCount={props.job.job.workerCount || 2}
              status={displayStatus()}
              onChange={props.onSetWorkers}
            />
          </div>
          <div class="flex items-center gap-2">
            <Show when={displayStatus() === "done" && props.job.stats.error > 0}>
              <button
                class="px-4 py-2 text-sm font-medium bg-rose-500 hover:bg-rose-400 text-white rounded-xl transition-colors cursor-pointer"
                onClick={props.onResume}
              >
                Retry Failed ({props.job.stats.error})
              </button>
            </Show>
            <JobActions
              status={displayStatus()}
              errorCount={props.job.stats.error}
              onPause={props.onPause}
              onResume={props.onResume}
            />
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}
