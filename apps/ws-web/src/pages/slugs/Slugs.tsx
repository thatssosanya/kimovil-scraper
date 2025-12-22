import { createSignal, onMount, onCleanup, createMemo, Show } from "solid-js";
import type { FilterType } from "./types";
import { useSlugsApi } from "./hooks/useSlugsApi";
import { useBulkJobs } from "./hooks/useBulkJobs";
import { Header } from "../../components/Header";
import { StatsPanel } from "./components/StatsPanel";
import { SearchBar } from "./components/SearchBar";
import { BulkStartPanel } from "./components/BulkStartPanel";
import { JobsSection } from "./components/jobs/JobsSection";
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

  onMount(() => {
    api.fetchDevices("", "all", limit());
    api.fetchStats();
    bulkJobs.init();
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

  // Devices with raw data (for bulk clear)
  const hasRawDataCount = createMemo(() => {
    const sel = selected();
    const status = api.scrapeStatus();
    let count = 0;
    for (const slug of sel) {
      if (status[slug]?.hasRawData) count++;
    }
    return count;
  });

  // Devices with AI data (for bulk clear)
  const hasAiDataCount = createMemo(() => {
    const sel = selected();
    const status = api.scrapeStatus();
    let count = 0;
    for (const slug of sel) {
      if (status[slug]?.hasAiData) count++;
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

  const handleClearRawBulk = async () => {
    const slugsToClear = Array.from(selected()).filter(
      (slug) => api.scrapeStatus()[slug]?.hasRawData,
    );
    if (slugsToClear.length === 0) return;
    if (!confirm(`Clear raw data for ${slugsToClear.length} items?`)) return;
    await api.clearRawBulk(slugsToClear);
  };

  const handleClearAiBulk = async () => {
    const slugsToClear = Array.from(selected()).filter(
      (slug) => api.scrapeStatus()[slug]?.hasAiData,
    );
    if (slugsToClear.length === 0) return;
    if (!confirm(`Clear AI data for ${slugsToClear.length} items?`)) return;
    await api.clearAiBulk(slugsToClear);
  };

  const handleClearRawData = async (slug: string) => {
    if (!confirm(`Clear raw data for "${slug}"?`)) return;
    await api.clearRawData(slug);
  };

  const handleClearAiData = async (slug: string) => {
    if (!confirm(`Clear AI data for "${slug}"?`)) return;
    await api.clearAiData(slug);
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
    <div class="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <Header 
        currentPage="database" 
        status={bulkJobs.wsConnected() ? "Connected" : "Disconnected"}
      />
      <div class="max-w-7xl mx-auto space-y-8 p-6 md:px-12 md:py-6">

        {/* Collapsible Jobs Section */}
        <div 
          class={`
            relative group/jobs rounded-2xl overflow-hidden transition-all duration-500
            bg-gradient-to-b from-slate-900/90 to-slate-900/70 backdrop-blur-xl
            border border-slate-700/40
            ${jobsExpanded() ? "shadow-2xl shadow-indigo-500/5" : "shadow-lg shadow-slate-950/50"}
            ${bulkJobs.allJobs.filter(j => j.job.status === "running").length > 0 ? "ring-1 ring-indigo-500/20" : ""}
          `}
        >
          {/* Subtle gradient overlay for depth */}
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] via-transparent to-cyan-500/[0.02] pointer-events-none" />
          
          {/* Active job ambient glow */}
          <Show when={bulkJobs.allJobs.filter(j => j.job.status === "running").length > 0}>
            <div class="absolute -inset-px bg-gradient-to-r from-indigo-500/10 via-cyan-500/5 to-indigo-500/10 rounded-2xl blur-xl opacity-50 animate-pulse pointer-events-none" />
          </Show>
          
          <button
            onClick={() => setJobsExpanded((v) => !v)}
            class="relative w-full flex items-center justify-between px-5 py-4 cursor-pointer transition-all duration-300 hover:bg-slate-800/20"
          >
            <div class="flex items-center gap-4">
              {/* Icon with gradient background */}
              <div class={`
                relative p-2.5 rounded-xl transition-all duration-300
                ${jobsExpanded() 
                  ? "bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 shadow-lg shadow-indigo-500/10" 
                  : "bg-slate-800/60 group-hover/jobs:bg-slate-800/80"
                }
              `}>
                <svg 
                  class={`w-5 h-5 transition-colors duration-300 ${jobsExpanded() ? "text-indigo-300" : "text-slate-400 group-hover/jobs:text-slate-300"}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  stroke-width="1.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              
              <div class="flex flex-col items-start">
                <div class="flex items-center gap-3">
                  <span class={`text-sm font-semibold tracking-wide transition-colors duration-300 ${jobsExpanded() ? "text-white" : "text-slate-200 group-hover/jobs:text-white"}`}>
                    Bulk Jobs
                  </span>
                  <Show when={bulkJobs.allJobs.filter(j => j.job.status === "running").length > 0}>
                    <span class="relative flex items-center gap-1.5 bg-gradient-to-r from-indigo-500/15 to-cyan-500/15 text-indigo-300 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-indigo-400/20">
                      <span class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
                      </span>
                      {bulkJobs.allJobs.filter(j => j.job.status === "running").length} running
                    </span>
                  </Show>
                  <Show when={bulkJobs.allJobs.filter(j => j.job.status === "paused").length > 0}>
                    <span class="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-amber-500/20">
                      {bulkJobs.allJobs.filter(j => j.job.status === "paused").length} paused
                    </span>
                  </Show>
                </div>
                <span class="text-[11px] text-slate-500 font-medium mt-0.5">
                  {bulkJobs.allJobs.length === 0 
                    ? "No active jobs" 
                    : `${bulkJobs.allJobs.length} job${bulkJobs.allJobs.length !== 1 ? "s" : ""} total`
                  }
                </span>
              </div>
            </div>
            
            {/* Expand indicator */}
            <div class={`
              flex items-center gap-2 transition-all duration-300
              ${jobsExpanded() ? "opacity-60" : "opacity-40 group-hover/jobs:opacity-70"}
            `}>
              <span class="text-[10px] uppercase tracking-widest text-slate-500 font-semibold hidden sm:block">
                {jobsExpanded() ? "Collapse" : "Expand"}
              </span>
              <div class={`
                p-1.5 rounded-lg transition-all duration-300
                ${jobsExpanded() ? "bg-slate-700/50 rotate-180" : "bg-slate-800/50 group-hover/jobs:bg-slate-700/50"}
              `}>
                <svg
                  class="w-4 h-4 text-slate-400 transition-transform duration-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </button>
          
          <Show when={jobsExpanded()}>
            <div class="relative px-5 pb-5 pt-4 space-y-5 border-t border-slate-700/30 animate-in slide-in-from-top-2 fade-in duration-300">
              {/* Decorative line accent */}
              <div class="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
              
              <BulkStartPanel
                wsConnected={bulkJobs.wsConnected()}
                bulkJobLoading={bulkJobs.bulkJobLoading()}
                onStartJob={bulkJobs.startBulkJob}
              />
              <JobsSection
                allJobs={bulkJobs.allJobs}
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
          onClearRawData={handleClearRawData}
          onClearAiData={handleClearAiData}
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
          hasRawCount={hasRawDataCount()}
          hasAiCount={hasAiDataCount()}
          bulkLoading={bulkJobs.bulkLoading()}
          verifyLoading={api.verifyLoading()}
          clearLoading={api.clearLoading()}
          clearRawLoading={api.clearRawLoading()}
          clearAiLoading={api.clearAiLoading()}
          onQueueScrape={handleQueueScrape}
          onQueueExtract={handleQueueExtract}
          onQueueAi={handleQueueAi}
          onVerify={handleVerifyBulk}
          onClear={handleClearBulk}
          onClearRaw={handleClearRawBulk}
          onClearAi={handleClearAiBulk}
          onCancel={() => setSelected(new Set<string>())}
        />

        <PhoneDataModal
          slug={modalSlug()}
          status={modalSlug() ? api.scrapeStatus()[modalSlug()!] ?? null : null}
          onClose={closeModal}
          fetchHtml={api.openPreview}
          fetchRawData={api.fetchPhoneDataRaw}
          fetchAiData={api.fetchPhoneDataAi}
          fetchPrices={api.fetchPrices}
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
