import { createSignal, onMount, Show } from "solid-js";
import type { FilterType } from "./types";
import type { TabId } from "./components/TabBar";
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
import { DevicesTableProvider, useSelection, useRowData, useSlugsApi, type LimitOption } from "./context/devices-table.context";

interface ErrorItem {
  slug: string;
  error: string | null;
  errorCode: string | null;
  attempt: number;
  updatedAt: number;
}

function SlugsContent(props: {
  search: () => string;
  setSearch: (s: string) => void;
  filter: () => FilterType;
  setFilter: (f: FilterType) => void;
  limit: () => LimitOption;
  setLimit: (l: LimitOption) => void;
  modalSlug: () => string | null;
  modalInitialTab: () => TabId | undefined;
  setModalSlug: (s: string | null, tab?: TabId) => void;
  api: ReturnType<typeof useSlugsApi>;
  bulkJobs: ReturnType<typeof useBulkJobs>;
}) {
  const [jobsExpanded, setJobsExpanded] = createSignal(false);
  const [errorItems, setErrorItems] = createSignal<ErrorItem[]>([]);
  const [errorItemsJobId, setErrorItemsJobId] = createSignal<string | null>(null);
  const [errorItemsLoading, setErrorItemsLoading] = createSignal(false);

  const selection = useSelection();
  const rowData = useRowData();

  const handleSearch = () => {
    props.api.fetchDevices(props.search(), props.filter(), props.limit());
  };

  const handleFilterChange = (newFilter: FilterType) => {
    props.setFilter(newFilter);
    props.api.fetchDevices(props.search(), newFilter, props.limit());
  };

  const handleClear = () => {
    props.setSearch("");
    props.setFilter("all");
    props.api.fetchDevices("", "all", props.limit());
  };

  const handleQueueScrape = async () => {
    const status = rowData.scrapeStatus();
    const slugsToQueue = selection.selectedSlugs().filter(
      (slug) => !status[slug]?.hasHtml,
    );
    await props.bulkJobs.queueBulk(slugsToQueue, "scrape");
    selection.clearSelection();
  };

  const handleQueueExtract = async () => {
    const status = rowData.scrapeStatus();
    const slugsToQueue = selection.selectedSlugs().filter(
      (slug) => status[slug]?.hasHtml && !status[slug]?.hasRawData,
    );
    await props.bulkJobs.queueBulk(slugsToQueue, "process_raw");
    selection.clearSelection();
  };

  const handleQueueAi = async () => {
    const status = rowData.scrapeStatus();
    const slugsToQueue = selection.selectedSlugs().filter(
      (slug) => status[slug]?.hasRawData && !status[slug]?.hasAiData,
    );
    await props.bulkJobs.queueBulk(slugsToQueue, "process_ai");
    selection.clearSelection();
  };

  const closeModal = () => {
    props.setModalSlug(null, undefined);
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
    <>
      {/* Collapsible Jobs Section */}
      <div 
        class={`
          relative group/jobs rounded-2xl overflow-hidden transition-all duration-500
          bg-gradient-to-b from-white/90 to-white/70 dark:from-slate-900/90 dark:to-slate-900/70 backdrop-blur-xl
          border border-zinc-200 dark:border-slate-700/40
          ${jobsExpanded() ? "shadow-2xl shadow-indigo-500/5" : "shadow-lg shadow-zinc-200/50 dark:shadow-slate-950/50"}
          ${props.bulkJobs.allJobs.filter(j => j.job.status === "running").length > 0 ? "ring-1 ring-indigo-500/20" : ""}
        `}
      >
        <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] via-transparent to-cyan-500/[0.02] pointer-events-none" />
        
        <Show when={props.bulkJobs.allJobs.filter(j => j.job.status === "running").length > 0}>
          <div class="absolute -inset-px bg-gradient-to-r from-indigo-500/10 via-cyan-500/5 to-indigo-500/10 rounded-2xl blur-xl opacity-50 animate-pulse pointer-events-none" />
        </Show>
        
        <button
          onClick={() => setJobsExpanded((v) => !v)}
          class="relative w-full flex items-center justify-between px-5 py-4 cursor-pointer transition-all duration-300 hover:bg-zinc-100/50 dark:hover:bg-slate-800/20"
        >
          <div class="flex items-center gap-4">
            <div class={`
              relative p-2.5 rounded-xl transition-all duration-300
              ${jobsExpanded() 
                ? "bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 shadow-lg shadow-indigo-500/10" 
                : "bg-zinc-100 dark:bg-slate-800/60 group-hover/jobs:bg-zinc-200 dark:group-hover/jobs:bg-slate-800/80"
              }
            `}>
              <svg 
                class={`w-5 h-5 transition-colors duration-300 ${jobsExpanded() ? "text-indigo-500 dark:text-indigo-300" : "text-zinc-500 dark:text-slate-400 group-hover/jobs:text-zinc-600 dark:group-hover/jobs:text-slate-300"}`} 
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
                <span class={`text-sm font-semibold tracking-wide transition-colors duration-300 ${jobsExpanded() ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-slate-200 group-hover/jobs:text-zinc-900 dark:group-hover/jobs:text-white"}`}>
                  Bulk Jobs
                </span>
                <Show when={props.bulkJobs.allJobs.filter(j => j.job.status === "running").length > 0}>
                  <span class="relative flex items-center gap-1.5 bg-gradient-to-r from-indigo-500/15 to-cyan-500/15 text-indigo-300 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-indigo-400/20">
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
                    </span>
                    {props.bulkJobs.allJobs.filter(j => j.job.status === "running").length} running
                  </span>
                </Show>
                <Show when={props.bulkJobs.allJobs.filter(j => j.job.status === "paused").length > 0}>
                  <span class="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-amber-500/20">
                    {props.bulkJobs.allJobs.filter(j => j.job.status === "paused").length} paused
                  </span>
                </Show>
              </div>
              <span class="text-[11px] text-zinc-500 dark:text-slate-500 font-medium mt-0.5">
                {props.bulkJobs.allJobs.length === 0 
                  ? "No active jobs" 
                  : `${props.bulkJobs.allJobs.length} job${props.bulkJobs.allJobs.length !== 1 ? "s" : ""} total`
                }
              </span>
            </div>
          </div>
          
          <div class={`
            flex items-center gap-2 transition-all duration-300
            ${jobsExpanded() ? "opacity-60" : "opacity-40 group-hover/jobs:opacity-70"}
          `}>
            <span class="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-slate-500 font-semibold hidden sm:block">
              {jobsExpanded() ? "Collapse" : "Expand"}
            </span>
            <div class={`
              p-1.5 rounded-lg transition-all duration-300
              ${jobsExpanded() ? "bg-zinc-200 dark:bg-slate-700/50 rotate-180" : "bg-zinc-100 dark:bg-slate-800/50 group-hover/jobs:bg-zinc-200 dark:group-hover/jobs:bg-slate-700/50"}
            `}>
              <svg
                class="w-4 h-4 text-zinc-500 dark:text-slate-400 transition-transform duration-300"
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
          <div class="relative px-5 pb-5 pt-4 space-y-5 border-t border-zinc-200 dark:border-slate-700/30 animate-in slide-in-from-top-2 fade-in duration-300">
            <div class="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
            
            <BulkStartPanel
              wsConnected={props.bulkJobs.wsConnected()}
              bulkJobLoading={props.bulkJobs.bulkJobLoading()}
              onStartJob={props.bulkJobs.startBulkJob}
            />
            <JobsSection
              allJobs={props.bulkJobs.allJobs}
              selectedJobId={props.bulkJobs.selectedJobId()}
              selectedJob={props.bulkJobs.selectedJob()}
              jobsExpanded={true}
              onToggleExpanded={() => {}}
              onSelectJob={props.bulkJobs.selectJob}
              onDeselectJob={props.bulkJobs.deselectJob}
              onPause={props.bulkJobs.pauseJob}
              onResume={props.bulkJobs.resumeJob}
              onSetWorkers={props.bulkJobs.setJobWorkers}
              onShowErrors={showErrorItems}
              formatTimeRemaining={props.bulkJobs.formatTimeRemaining}
            />
          </div>
        </Show>
      </div>

      <StatsPanel
        stats={props.api.stats()}
        scrapeStats={props.api.scrapeStats()}
        activeFilter={props.filter()}
        onFilterChange={handleFilterChange}
      />

      <SearchBar
        search={props.search()}
        filter={props.filter()}
        loading={props.api.loading()}
        scrapeStats={props.api.scrapeStats()}
        total={props.api.total()}
        onSearchChange={props.setSearch}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      <DevicesTable />

      <SelectionBar
        bulkLoading={props.bulkJobs.bulkLoading()}
        onQueueScrape={handleQueueScrape}
        onQueueExtract={handleQueueExtract}
        onQueueAi={handleQueueAi}
      />

      <PhoneDataModal
        slug={props.modalSlug()}
        status={props.modalSlug() ? props.api.scrapeStatus()[props.modalSlug()!] ?? null : null}
        initialTab={props.modalInitialTab()}
        onClose={closeModal}
        fetchHtml={props.api.openPreview}
        fetchRawData={props.api.fetchPhoneDataRaw}
        fetchAiData={props.api.fetchPhoneDataAi}
        fetchAllQuotes={props.api.fetchAllQuotes}
        fetchDeviceSources={props.api.fetchDeviceSources}
        onProcessRaw={props.api.processRaw}
        onProcessAi={props.api.processAi}
        onStatusChange={() => {
          const slug = props.modalSlug();
          if (slug) {
            props.api.fetchScrapeStatus([slug]);
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
          props.bulkJobs.resumeJob(jobId);
        }}
      />
    </>
  );
}

export default function Slugs() {
  const [search, setSearch] = createSignal("");
  const [filter, setFilter] = createSignal<FilterType>("all");
  const [limit, setLimit] = createSignal<LimitOption>(500);
  const [modalSlug, setModalSlug] = createSignal<string | null>(null);
  const [modalInitialTab, setModalInitialTab] = createSignal<TabId | undefined>(undefined);

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

  const openModal = (slug: string, initialTab?: TabId) => {
    setModalSlug(slug);
    setModalInitialTab(initialTab);
  };
  
  const setModalSlugWithTab = (slug: string | null, tab?: TabId) => {
    setModalSlug(slug);
    setModalInitialTab(tab);
  };

  return (
    <div class="min-h-screen bg-zinc-50 dark:bg-slate-950 text-zinc-900 dark:text-slate-200 font-sans selection:bg-indigo-500/30">
      <Header 
        currentPage="database" 
        status={bulkJobs.wsConnected() ? "Connected" : "Disconnected"}
      />
      <div class="max-w-7xl mx-auto space-y-8 p-6 md:px-12 md:py-6">
        <DevicesTableProvider
          api={api}
          search={search}
          filter={filter}
          limit={limit}
          setLimit={setLimit}
          onModalOpen={openModal}
        >
          <SlugsContent
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            limit={limit}
            setLimit={setLimit}
            modalSlug={modalSlug}
            modalInitialTab={modalInitialTab}
            setModalSlug={setModalSlugWithTab}
            api={api}
            bulkJobs={bulkJobs}
          />
        </DevicesTableProvider>
      </div>
    </div>
  );
}
