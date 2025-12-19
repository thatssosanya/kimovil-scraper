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
import { HtmlPreviewModal } from "./components/HtmlPreviewModal";

export default function Slugs() {
  const [search, setSearch] = createSignal("");
  const [filter, setFilter] = createSignal<FilterType>("all");
  const [selected, setSelected] = createSignal<Set<string>>(new Set<string>());
  const [jobsExpanded, setJobsExpanded] = createSignal(false);
  const [previewSlug, setPreviewSlug] = createSignal<string | null>(null);
  const [previewHtml, setPreviewHtml] = createSignal<string | null>(null);
  const [previewLoading, setPreviewLoading] = createSignal(false);

  const api = useSlugsApi();
  const bulkJobs = useBulkJobs({
    onScrapeStatusUpdate: (slug, status) => {
      api.setScrapeStatus((prev) => ({
        ...prev,
        [slug]: { ...(prev[slug] || {}), ...status } as any,
      }));
    },
    onJobComplete: () => {
      api.fetchDevices(search(), filter());
    },
  });

  let intervalId: ReturnType<typeof setInterval>;

  onMount(() => {
    api.fetchDevices();
    api.fetchStats();
    api.fetchQueueStatuses();
    bulkJobs.init();
    intervalId = setInterval(() => {
      api.fetchQueueStatuses();
      const devs = api.devices();
      if (devs.length > 0) {
        api.fetchScrapeStatus(devs.map((d) => d.slug));
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

  const handleSearch = () => {
    api.fetchDevices(search(), filter());
    setSelected(new Set<string>());
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    api.fetchDevices(search(), newFilter);
    setSelected(new Set<string>());
  };

  const handleClear = () => {
    setSearch("");
    setFilter("all");
    api.fetchDevices();
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
      setSelected(new Set<string>(api.devices().map((d) => d.slug)));
    }
  };

  const handleQueueBulk = async () => {
    const status = api.scrapeStatus();
    const slugsToQueue = Array.from(selected()).filter(
      (slug) => !status[slug]?.hasHtml,
    );
    await bulkJobs.queueBulk(slugsToQueue);
    setSelected(new Set<string>());
  };

  const handleVerifyBulk = async () => {
    await api.verifyBulk(Array.from(selected()));
    api.fetchDevices(search(), filter());
  };

  const handleClearBulk = async () => {
    const cleared = await api.clearBulk(Array.from(selected()));
    if (cleared) setSelected(new Set<string>());
  };

  const openPreview = async (slug: string) => {
    setPreviewSlug(slug);
    setPreviewLoading(true);
    setPreviewHtml(null);
    const result = await api.openPreview(slug);
    setPreviewHtml(result.html);
    setPreviewLoading(false);
  };

  const closePreview = () => {
    setPreviewSlug(null);
    setPreviewHtml(null);
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

        <StatsPanel stats={api.stats()} scrapeStats={api.scrapeStats()} />

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

        <BulkStartPanel
          wsConnected={bulkJobs.wsConnected()}
          bulkJobLoading={bulkJobs.bulkJobLoading()}
          onStartJob={bulkJobs.startBulkJob}
        />

        <JobsSection
          allJobs={bulkJobs.allJobs()}
          selectedJobId={bulkJobs.selectedJobId()}
          selectedJob={bulkJobs.selectedJob()}
          jobsExpanded={jobsExpanded()}
          onToggleExpanded={() => setJobsExpanded((v) => !v)}
          onSelectJob={bulkJobs.selectJob}
          onDeselectJob={bulkJobs.deselectJob}
          onPause={bulkJobs.pauseJob}
          onResume={bulkJobs.resumeJob}
          onSetWorkers={bulkJobs.setJobWorkers}
          formatTimeRemaining={bulkJobs.formatTimeRemaining}
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
          onOpenPreview={openPreview}
          onClearData={api.clearScrapeData}
          allSelected={allSelected()}
          filtered={api.filtered()}
          total={api.total()}
        />

        <SelectionBar
          selectedCount={selectedCount()}
          scrapedCount={scrapedSelectedCount()}
          unscrapedCount={unscrapedSelectedCount()}
          bulkLoading={bulkJobs.bulkLoading()}
          verifyLoading={api.verifyLoading()}
          clearLoading={api.clearLoading()}
          onQueueBulk={handleQueueBulk}
          onVerify={handleVerifyBulk}
          onClear={handleClearBulk}
          onCancel={() => setSelected(new Set<string>())}
        />

        <HtmlPreviewModal
          slug={previewSlug()}
          html={previewHtml()}
          loading={previewLoading()}
          onClose={closePreview}
        />
      </div>
    </div>
  );
}
