import { createSignal, onMount, onCleanup, createMemo } from "solid-js";
import type { FilterType } from "./types";
import { useSlugsApi } from "./hooks/useSlugsApi";
import { useBulkJobs } from "./hooks/useBulkJobs";
import { StatsPanel } from "./components/StatsPanel";
import { SearchBar } from "./components/SearchBar";
import { BulkStartPanel } from "./components/BulkStartPanel";
import { JobsSection } from "./components/JobsSection";
import { DevicesTable } from "./components/DevicesTable";
import { SelectionBar } from "./components/SelectionBar";
import { PhoneDataModal } from "./components/PhoneDataModal";
import { ErrorItemsModal } from "./components/ErrorItemsModal";

interface ErrorItem {
  slug: string;
  error: string | null;
  errorCode: string | null;
  attempt: number;
  updatedAt: number;
}

type LimitOption = 10 | 100 | 500 | 1000 | 10000;

export default function Slugs() {
  const [search, setSearch] = createSignal("");
  const [filter, setFilter] = createSignal<FilterType>("all");
  const [limit, setLimit] = createSignal<LimitOption>(500);
  const [selected, setSelected] = createSignal<Set<string>>(new Set<string>());
  const [jobsExpanded, setJobsExpanded] = createSignal(false);
  const [modalSlug, setModalSlug] = createSignal<string | null>(null);
  const [errorItems, setErrorItems] = createSignal<ErrorItem[]>([]);
  const [errorItemsJobId, setErrorItemsJobId] = createSignal<string | null>(null);
  const [errorItemsLoading, setErrorItemsLoading] = createSignal(false);

  const api = useSlugsApi();
  const bulkJobs = useBulkJobs({
    onScrapeStatusUpdate: (slug, status) => {
      api.setScrapeStatus((prev) => ({
        ...prev,
        [slug]: { ...(prev[slug] || {}), ...status } as any,
      }));
    },
    onJobComplete: () => {
      api.fetchDevices(search(), filter(), limit());
    },
  });

  let intervalId: ReturnType<typeof setInterval>;

  onMount(() => {
    api.fetchDevices("", "all", limit());
    api.fetchStats();
    api.fetchQueueStatuses();
    bulkJobs.init();
    intervalId = setInterval(() => {
      api.fetchQueueStatuses();
      const devs = api.devices();
      const sel = selected();
      // Fetch status for both displayed devices and selected ones
      const slugsToFetch = new Set(devs.map((d) => d.slug));
      for (const slug of sel) slugsToFetch.add(slug);
      if (slugsToFetch.size > 0) {
        api.fetchScrapeStatus(Array.from(slugsToFetch));
      }
    }, 2000);
  });

  onCleanup(() => {
    clearInterval(intervalId);
  });

  const selectedCount = createMemo(() => selected().size);
  const allSelected = createMemo(() => {
    const devs = api.devices();
    return devs.length > 0 && selected().size === devs.length;
  });

  const unscrapedSelectedCount = createMemo(() => {
    const sel = selected();
    const status = api.scrapeStatus();
    let count = 0;
    for (const slug of sel) {
      if (!status[slug]?.hasHtml) count++;
    }
    return count;
  });

  const scrapedSelectedCount = createMemo(() => {
    const sel = selected();
    const status = api.scrapeStatus();
    let count = 0;
    for (const slug of sel) {
      if (status[slug]?.hasHtml) count++;
    }
    return count;
  });

  // Devices with HTML but no raw data
  const needsExtractionCount = createMemo(() => {
    const sel = selected();
    const status = api.scrapeStatus();
    let count = 0;
    for (const slug of sel) {
      const s = status[slug];
      if (s?.hasHtml && !s?.hasRawData) count++;
    }
    return count;
  });

  // Devices with raw data but no AI data
  const needsAiCount = createMemo(() => {
    const sel = selected();
    const status = api.scrapeStatus();
    let count = 0;
    for (const slug of sel) {
      const s = status[slug];
      if (s?.hasRawData && !s?.hasAiData) count++;
    }
    return count;
  });

  const handleSearch = () => {
    api.fetchDevices(search(), filter(), limit());
    setSelected(new Set<string>());
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    api.fetchDevices(search(), newFilter, limit());
    setSelected(new Set<string>());
  };

  const handleLimitChange = (newLimit: LimitOption) => {
    setLimit(newLimit);
    api.fetchDevices(search(), filter(), newLimit);
    setSelected(new Set<string>());
  };

  const handleClear = () => {
    setSearch("");
    setFilter("all");
    api.fetchDevices("", "all", limit());
    setSelected(new Set<string>());
  };

  const toggleSelect = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected()) {
      setSelected(new Set<string>());
    } else {
      const newSelected = new Set<string>(api.devices().map((d) => d.slug));
      setSelected(newSelected);
      // Fetch scrape status for all newly selected
      api.fetchScrapeStatus(Array.from(newSelected));
    }
  };

  const handleQueueScrape = async () => {
    const status = api.scrapeStatus();
    const slugsToQueue = Array.from(selected()).filter(
      (slug) => !status[slug]?.hasHtml,
    );
    await bulkJobs.queueBulk(slugsToQueue, "scrape");
    setSelected(new Set<string>());
  };

  const handleQueueExtract = async () => {
    const status = api.scrapeStatus();
    const slugsToQueue = Array.from(selected()).filter(
      (slug) => status[slug]?.hasHtml && !status[slug]?.hasRawData,
    );
    await bulkJobs.queueBulk(slugsToQueue, "process_raw");
    setSelected(new Set<string>());
  };

  const handleQueueAi = async () => {
    const status = api.scrapeStatus();
    const slugsToQueue = Array.from(selected()).filter(
      (slug) => status[slug]?.hasRawData && !status[slug]?.hasAiData,
    );
    await bulkJobs.queueBulk(slugsToQueue, "process_ai");
    setSelected(new Set<string>());
  };

  const handleVerifyBulk = async () => {
    await api.verifyBulk(Array.from(selected()));
    api.fetchDevices(search(), filter(), limit());
  };

  const handleClearBulk = async () => {
    const cleared = await api.clearBulk(Array.from(selected()));
    if (cleared) setSelected(new Set<string>());
  };

  const openModal = (slug: string) => {
    setModalSlug(slug);
  };

  const closeModal = () => {
    setModalSlug(null);
  };

  const showErrorItems = async (jobId: string) => {
    setErrorItemsJobId(jobId);
    setErrorItemsLoading(true);
    setErrorItems([]);
    try {
      const res = await fetch(`http://localhost:1488/api/bulk/${jobId}/errors?limit=200`);
      const data = await res.json();
      setErrorItems(data.items || []);
    } catch (e) {
      console.error("Failed to fetch error items:", e);
    } finally {
      setErrorItemsLoading(false);
    }
  };

  const closeErrorItems = () => {
    setErrorItemsJobId(null);
    setErrorItems([]);
  };

  return (
    <div class="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans selection:bg-indigo-500/30">
      <div class="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              Device Database
            </h1>
            <p class="text-slate-400 mt-1">Manage and scrape device slugs</p>
          </div>
          <a
            href="/"
            class="group flex items-center gap-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-lg transition-all border border-slate-800 hover:border-slate-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 group-hover:-translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Scraper
          </a>
        </div>

        {/* Collapsible Jobs Section */}
        <div class="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setJobsExpanded((v) => !v)}
            class="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
          >
            <div class="flex items-center gap-3">
              <div class="p-1.5 bg-indigo-500/10 rounded-lg">
                <svg class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <span class="text-sm font-medium text-slate-200">Bulk Jobs</span>
              <Show when={bulkJobs.allJobs().filter(j => j.status === "running").length > 0}>
                <span class="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded-full border border-indigo-500/20 animate-pulse">
                  {bulkJobs.allJobs().filter(j => j.status === "running").length} running
                </span>
              </Show>
            </div>
            <svg
              class={`w-5 h-5 text-slate-400 transition-transform duration-200 ${jobsExpanded() ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <Show when={jobsExpanded()}>
            <div class="px-4 pb-4 space-y-4 border-t border-slate-800/50">
              <BulkStartPanel
                wsConnected={bulkJobs.wsConnected()}
                bulkJobLoading={bulkJobs.bulkJobLoading()}
                onStartJob={bulkJobs.startBulkJob}
              />
              <JobsSection
                allJobs={bulkJobs.allJobs()}
                selectedJobId={bulkJobs.selectedJobId()}
                selectedJob={bulkJobs.selectedJob()}
                jobsExpanded={true}
                onToggleExpanded={() => {}}
                onSelectJob={bulkJobs.selectJob}
                onDeselectJob={bulkJobs.deselectJob}
                onPause={bulkJobs.pauseJob}
                onResume={bulkJobs.resumeJob}
                onSetWorkers={bulkJobs.setJobWorkers}
                onShowErrors={showErrorItems}
                formatTimeRemaining={bulkJobs.formatTimeRemaining}
              />
            </div>
          </Show>
        </div>

        <StatsPanel
          stats={api.stats()}
          scrapeStats={api.scrapeStats()}
          activeFilter={filter()}
          onFilterChange={handleFilterChange}
        />

        <SearchBar
          search={search()}
          filter={filter()}
          loading={api.loading()}
          scrapeStats={api.scrapeStats()}
          total={api.total()}
          onSearchChange={setSearch}
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
          onClear={handleClear}
        />

        <DevicesTable
          devices={api.devices()}
          selected={selected()}
          scrapeStatus={api.scrapeStatus()}
          queueStatus={api.queueStatus()}
          queueLoading={api.queueLoading()}
          loading={api.loading()}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onQueueScrape={api.queueScrape}
          onOpenModal={openModal}
          onClearData={api.clearScrapeData}
          allSelected={allSelected()}
          filtered={api.filtered()}
          total={api.total()}
          limit={limit()}
          onLimitChange={handleLimitChange}
        />

        <SelectionBar
          selectedCount={selectedCount()}
          scrapedCount={scrapedSelectedCount()}
          unscrapedCount={unscrapedSelectedCount()}
          needsExtractionCount={needsExtractionCount()}
          needsAiCount={needsAiCount()}
          bulkLoading={bulkJobs.bulkLoading()}
          verifyLoading={api.verifyLoading()}
          clearLoading={api.clearLoading()}
          onQueueScrape={handleQueueScrape}
          onQueueExtract={handleQueueExtract}
          onQueueAi={handleQueueAi}
          onVerify={handleVerifyBulk}
          onClear={handleClearBulk}
          onCancel={() => setSelected(new Set<string>())}
        />

        <PhoneDataModal
          slug={modalSlug()}
          status={modalSlug() ? api.scrapeStatus()[modalSlug()!] ?? null : null}
          onClose={closeModal}
          fetchHtml={api.openPreview}
          fetchRawData={api.fetchPhoneDataRaw}
          fetchAiData={api.fetchPhoneDataAi}
          onProcessRaw={api.processRaw}
          onProcessAi={api.processAi}
          onStatusChange={() => {
            const slug = modalSlug();
            if (slug) {
              api.fetchScrapeStatus([slug]);
            }
          }}
        />

        <ErrorItemsModal
          jobId={errorItemsJobId()}
          items={errorItems()}
          loading={errorItemsLoading()}
          onClose={closeErrorItems}
          onRetry={(jobId) => {
            closeErrorItems();
            bulkJobs.resumeJob(jobId);
          }}
        />
      </div>
    </div>
  );
}
