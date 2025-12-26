import { createSignal, createEffect, Show, on } from "solid-js";
import { TabBar, type TabId } from "./TabBar";
import { JsonViewer } from "./JsonViewer";
import { PricesTab } from "./prices";
import type { PhoneDataRaw, PhoneDataAi, ScrapeStatus, PriceOffer, DeviceSource } from "../types";

interface PhoneDataModalProps {
  slug: string | null;
  status: ScrapeStatus | null;
  initialTab?: TabId;
  onClose: () => void;
  fetchHtml: (slug: string) => Promise<{ html: string | null }>;
  fetchRawData: (slug: string) => Promise<PhoneDataRaw | null>;
  fetchAiData: (slug: string) => Promise<PhoneDataAi | null>;
  onProcessRaw?: (slug: string) => Promise<{ success: boolean; error?: string }>;
  onProcessAi?: (slug: string) => Promise<{ success: boolean; error?: string }>;
  onStatusChange?: () => void;
  fetchAllQuotes?: (slug: string, source?: string, externalId?: string) => Promise<PriceOffer[]>;
  fetchDeviceSources?: (slug: string, source?: string) => Promise<DeviceSource[]>;
  onLinkPriceRu?: (slug: string) => Promise<void>;
  onGetPriceRuPrices?: (slug: string) => Promise<void>;
}

interface ProcessButtonProps {
  loading: boolean;
  onClick: () => void;
  variant: "raw" | "ai";
}

function ProcessButton(props: ProcessButtonProps) {
  const config = {
    raw: {
      label: "Extract Data",
      loadingLabel: "Extracting...",
      description: "Parse HTML and extract structured data",
      icon: (
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      ),
      colors: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30 hover:bg-cyan-500/20",
      spinnerColor: "border-cyan-500",
    },
    ai: {
      label: "Process with AI",
      loadingLabel: "Processing...",
      description: "Normalize and translate using AI",
      icon: (
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      ),
      colors: "bg-violet-500/10 text-violet-400 ring-violet-500/30 hover:bg-violet-500/20",
      spinnerColor: "border-violet-500",
    },
  };

  const cfg = config[props.variant];

  return (
    <button
      onClick={props.onClick}
      disabled={props.loading}
      class={`
        flex flex-col items-center gap-3 p-6 rounded-xl ring-1 transition-all duration-200 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${cfg.colors}
      `}
    >
      <Show when={!props.loading}>
        <div class="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-slate-800/50 flex items-center justify-center">
          {cfg.icon}
        </div>
        <div class="text-center">
          <div class="font-semibold">{cfg.label}</div>
          <div class="text-xs text-zinc-500 dark:text-slate-500 mt-1">{cfg.description}</div>
        </div>
      </Show>
      <Show when={props.loading}>
        <div class={`w-8 h-8 border-2 ${cfg.spinnerColor} border-t-transparent rounded-full animate-spin`} />
        <span class="text-sm">{cfg.loadingLabel}</span>
      </Show>
    </button>
  );
}

function EmptyStateWithAction(props: {
  title: string;
  description: string;
  canProcess: boolean;
  children?: any;
}) {
  return (
    <div class="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh]">
      <div class="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-slate-800/50 flex items-center justify-center mb-4">
        <svg class="h-8 w-8 text-zinc-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 class="text-base font-medium text-zinc-700 dark:text-slate-300 mb-1">{props.title}</h3>
      <p class="text-sm text-zinc-500 dark:text-slate-500 text-center max-w-xs mb-6">{props.description}</p>
      <Show when={props.canProcess}>
        {props.children}
      </Show>
    </div>
  );
}

export function PhoneDataModal(props: PhoneDataModalProps) {
  const [activeTab, setActiveTab] = createSignal<TabId>("html");

  // Cached data
  const [html, setHtml] = createSignal<string | null>(null);
  const [rawData, setRawData] = createSignal<PhoneDataRaw | null>(null);
  const [aiData, setAiData] = createSignal<PhoneDataAi | null>(null);

  // Loading states
  const [htmlLoading, setHtmlLoading] = createSignal(false);
  const [rawLoading, setRawLoading] = createSignal(false);
  const [aiLoading, setAiLoading] = createSignal(false);

  // Processing states
  const [rawProcessing, setRawProcessing] = createSignal(false);
  const [aiProcessing, setAiProcessing] = createSignal(false);

  // Error states
  const [rawError, setRawError] = createSignal<string | null>(null);
  const [aiError, setAiError] = createSignal<string | null>(null);

  // Track what's been fetched
  const [htmlFetched, setHtmlFetched] = createSignal(false);
  const [rawFetched, setRawFetched] = createSignal(false);
  const [aiFetched, setAiFetched] = createSignal(false);

  // Price state
  const [quotes, setQuotes] = createSignal<PriceOffer[]>([]);
  const [pricesLoading, setPricesLoading] = createSignal(false);
  const [pricesFetched, setPricesFetched] = createSignal(false);

  // Device sources state
  const [deviceSources, setDeviceSources] = createSignal<DeviceSource[]>([]);

  // Yandex link state
  const [yandexUrl, setYandexUrl] = createSignal("");
  const [yandexLinking, setYandexLinking] = createSignal(false);
  const [yandexScraping, setYandexScraping] = createSignal(false);
  const [yandexError, setYandexError] = createSignal<string | null>(null);
  const [scrapeProgress, setScrapeProgress] = createSignal(0);

  // Reset state when slug changes
  createEffect(
    on(
      () => props.slug,
      () => {
        setHtml(null);
        setRawData(null);
        setAiData(null);
        setHtmlFetched(false);
        setRawFetched(false);
        setAiFetched(false);
        setRawError(null);
        setAiError(null);
        setQuotes([]);
        setPricesFetched(false);
        setDeviceSources([]);
        setYandexUrl("");
        setYandexError(null);
        setScrapeProgress(0);
      },
    ),
  );

  // Set active tab when initialTab changes (including on first open)
  createEffect(
    on(
      () => props.initialTab,
      (tab) => {
        if (props.slug) {
          setActiveTab(tab ?? "html");
        }
      },
    ),
  );

  // Fetch data on tab change
  createEffect(
    on([() => props.slug, activeTab] as const, async ([slug, tab]) => {
      if (!slug) return;

      if (tab === "html" && !htmlFetched()) {
        setHtmlLoading(true);
        const result = await props.fetchHtml(slug);
        setHtml(result.html);
        setHtmlFetched(true);
        setHtmlLoading(false);
      }

      if ((tab === "raw" || tab === "compare") && !rawFetched()) {
        setRawLoading(true);
        const data = await props.fetchRawData(slug);
        setRawData(data);
        setRawFetched(true);
        setRawLoading(false);
      }

      if ((tab === "ai" || tab === "compare") && !aiFetched()) {
        setAiLoading(true);
        const data = await props.fetchAiData(slug);
        setAiData(data);
        setAiFetched(true);
        setAiLoading(false);
      }
    }),
  );

  // Fetch quotes and device sources on tab change
  createEffect(
    on([() => props.slug, activeTab] as const, async ([slug, tab]) => {
      if (!slug || tab !== "prices" || pricesFetched()) return;

      setPricesLoading(true);

      const [quotesData, sources] = await Promise.all([
        props.fetchAllQuotes 
          ? props.fetchAllQuotes(slug) 
          : Promise.resolve([]),
        props.fetchDeviceSources
          ? props.fetchDeviceSources(slug)
          : Promise.resolve([]),
      ]);

      setQuotes(quotesData);
      setDeviceSources(sources);
      setPricesFetched(true);
      setPricesLoading(false);
    }),
  );
  
  const refreshQuotes = async () => {
    if (!props.slug || !props.fetchAllQuotes) return;
    const quotesData = await props.fetchAllQuotes(props.slug);
    setQuotes(quotesData);
  };

  // WebSocket request helper for Yandex operations
  const sendWsRequest = (method: string, params: Record<string, unknown>): Promise<{ success?: boolean; error?: string }> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket("ws://localhost:1488/ws");
      const requestId = crypto.randomUUID();

      ws.onopen = () => {
        ws.send(JSON.stringify({ id: requestId, method, params }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === requestId) {
          if (data.error) {
            reject(new Error(data.error.message));
          } else if (data.result) {
            resolve(data.result);
            ws.close();
          }
        }
        if (data.event?.type === "progress") {
          setScrapeProgress(data.event.percent || 0);
        }
      };

      ws.onerror = () => reject(new Error("WebSocket error"));
      ws.onclose = () => {};
    });
  };

  const handleScrapeYandex = async (linkId?: string) => {
    if (!props.slug) return;
    setYandexScraping(true);
    setYandexError(null);
    setScrapeProgress(0);

    try {
      let urlToScrape = "";
      if (linkId) {
        const source = deviceSources().find(s => s.externalId === linkId);
        if (source?.url) {
          urlToScrape = source.url;
        } else {
          const quote = quotes().find(q => (q.externalId || q.url) === linkId);
          urlToScrape = quote?.url || "";
        }
      } else {
        urlToScrape = yandexUrl() || deviceSources()[0]?.url || quotes()[0]?.url || "";
      }
      
      if (!urlToScrape) {
        setYandexError("No URL found for this link");
        setYandexScraping(false);
        return;
      }
      
      const result = await sendWsRequest("yandex.scrape", {
        url: urlToScrape,
        deviceId: props.slug,
      });
      if (result.success) {
        await refreshQuotes();
      } else {
        setYandexError(result.error || "Failed to scrape");
      }
    } catch (error) {
      setYandexError(error instanceof Error ? error.message : "Failed to scrape");
    } finally {
      setYandexScraping(false);
      setScrapeProgress(0);
    }
  };

  const handleLinkYandex = async (url: string) => {
    if (!props.slug || !url) return;
    setYandexLinking(true);
    setYandexError(null);
    setYandexUrl(url);

    try {
      const result = await sendWsRequest("yandex.link", {
        deviceId: props.slug,
        url: url,
      });
      if (result.success) {
        await handleScrapeYandex();
      } else {
        setYandexError(result.error || "Failed to link");
      }
    } catch (error) {
      setYandexError(error instanceof Error ? error.message : "Failed to link");
    } finally {
      setYandexLinking(false);
    }
  };

  const handleProcessRaw = async () => {
    if (!props.slug || !props.onProcessRaw) return;
    setRawProcessing(true);
    setRawError(null);
    const result = await props.onProcessRaw(props.slug);
    if (result.success) {
      setRawFetched(false);
      setRawLoading(true);
      const data = await props.fetchRawData(props.slug);
      setRawData(data);
      setRawFetched(true);
      setRawLoading(false);
      props.onStatusChange?.();
    } else {
      setRawError(result.error || "Processing failed");
    }
    setRawProcessing(false);
  };

  const handleProcessAi = async () => {
    if (!props.slug || !props.onProcessAi) return;
    setAiProcessing(true);
    setAiError(null);
    const result = await props.onProcessAi(props.slug);
    if (result.success) {
      setAiFetched(false);
      setAiLoading(true);
      const data = await props.fetchAiData(props.slug);
      setAiData(data);
      setAiFetched(true);
      setAiLoading(false);
      props.onStatusChange?.();
    } else {
      setAiError(result.error || "Processing failed");
    }
    setAiProcessing(false);
  };

  // Tab availability: "available" means data exists, "enabled" means clickable
  // Raw tab: clickable if HTML exists (can extract), shows dot if raw data exists
  // AI tab: clickable if raw data exists (can process), shows dot if AI data exists
  const tabs = () => [
    {
      id: "html" as TabId,
      label: "HTML",
      icon: "html" as const,
      available: props.status?.hasHtml ?? false,
      enabled: true, // always enabled
    },
    {
      id: "raw" as TabId,
      label: "Raw Data",
      icon: "code" as const,
      available: props.status?.hasRawData ?? false,
      enabled: props.status?.hasHtml ?? false, // enabled if HTML exists
    },
    {
      id: "ai" as TabId,
      label: "AI Data",
      icon: "sparkle" as const,
      available: props.status?.hasAiData ?? false,
      enabled: props.status?.hasRawData ?? false, // enabled if raw data exists
    },
    {
      id: "compare" as TabId,
      label: "Compare",
      icon: "compare" as const,
      available: (props.status?.hasRawData && props.status?.hasAiData) ?? false,
      enabled: (props.status?.hasRawData && props.status?.hasAiData) ?? false,
    },
    {
      id: "prices" as TabId,
      label: "Prices",
      icon: "prices" as const,
      available: quotes().length > 0,
      enabled: true,
    },
  ];

  // Check if processing is possible
  const canProcessRaw = () => props.status?.hasHtml && !props.status?.hasRawData && !!props.onProcessRaw;
  const canProcessAi = () => props.status?.hasRawData && !props.status?.hasAiData && !!props.onProcessAi;

  return (
    <Show when={props.slug}>
      <div
        class="fixed inset-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
      >
        <div class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl shadow-zinc-300/50 dark:shadow-black/50">
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-slate-800">
            <div class="flex items-center gap-6">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                </div>
                <span class="font-mono text-sm text-zinc-700 dark:text-slate-300 bg-zinc-100 dark:bg-slate-800/50 px-2 py-1 rounded">
                  {props.slug}
                </span>
              </div>
              <TabBar
                tabs={tabs()}
                activeTab={activeTab()}
                onTabChange={setActiveTab}
              />
            </div>
            <button
              class="p-2 text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              onClick={props.onClose}
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div class="flex-1 overflow-hidden relative min-h-[70vh]">
            {/* HTML Tab */}
            <Show when={activeTab() === "html"}>
              <div class="absolute inset-0 overflow-auto">
                <Show when={htmlLoading()}>
                  <div class="flex items-center justify-center py-24">
                    <div class="w-10 h-10 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
                  </div>
                </Show>
                <Show when={!htmlLoading() && html()}>
                  <iframe
                    srcdoc={html()!}
                    class="w-full h-full bg-white"
                    sandbox="allow-same-origin"
                  />
                </Show>
                <Show when={!htmlLoading() && !html()}>
                  <EmptyStateWithAction
                    title="No HTML data"
                    description="This device hasn't been scraped yet"
                    canProcess={false}
                  />
                </Show>
              </div>
            </Show>

            {/* Raw Data Tab */}
            <Show when={activeTab() === "raw"}>
              <div class="absolute inset-0 overflow-hidden">
                <Show when={rawLoading()}>
                  <div class="flex items-center justify-center py-24">
                    <div class="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                </Show>
                <Show when={!rawLoading() && rawData()}>
                  <JsonViewer
                    data={rawData()}
                    loading={rawLoading()}
                    emptyMessage="No raw data available"
                    onRefresh={props.status?.hasHtml && props.onProcessRaw ? handleProcessRaw : undefined}
                    refreshing={rawProcessing()}
                    refreshLabel={rawProcessing() ? "Extracting..." : "Re-extract"}
                    refreshColor="cyan"
                  />
                </Show>
                <Show when={!rawLoading() && !rawData()}>
                  <EmptyStateWithAction
                    title="No raw data"
                    description={canProcessRaw() ? "HTML is available - you can extract structured data from it" : "Raw data hasn't been extracted yet"}
                    canProcess={!!canProcessRaw()}
                  >
                    <ProcessButton
                      variant="raw"
                      loading={rawProcessing()}
                      onClick={handleProcessRaw}
                    />
                    <Show when={rawError()}>
                      <div class="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm max-w-sm">
                        <div class="font-medium">Processing failed</div>
                        <div class="text-rose-400/70 mt-1">{rawError()}</div>
                      </div>
                    </Show>
                  </EmptyStateWithAction>
                </Show>
              </div>
            </Show>

            {/* AI Data Tab */}
            <Show when={activeTab() === "ai"}>
              <div class="absolute inset-0 overflow-hidden">
                <Show when={aiLoading()}>
                  <div class="flex items-center justify-center py-24">
                    <div class="w-10 h-10 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                  </div>
                </Show>
                <Show when={!aiLoading() && aiData()}>
                  <JsonViewer
                    data={aiData()}
                    loading={aiLoading()}
                    emptyMessage="No AI-processed data available"
                    onRefresh={props.status?.hasRawData && props.onProcessAi ? handleProcessAi : undefined}
                    refreshing={aiProcessing()}
                    refreshLabel={aiProcessing() ? "Processing..." : "Re-process"}
                    refreshColor="violet"
                  />
                </Show>
                <Show when={!aiLoading() && !aiData()}>
                  <EmptyStateWithAction
                    title="No AI data"
                    description={canProcessAi() ? "Raw data is available - you can normalize it using AI" : "This data hasn't been processed by AI yet"}
                    canProcess={!!canProcessAi()}
                  >
                    <ProcessButton
                      variant="ai"
                      loading={aiProcessing()}
                      onClick={handleProcessAi}
                    />
                    <Show when={aiError()}>
                      <div class="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm max-w-sm">
                        <div class="font-medium">Processing failed</div>
                        <div class="text-rose-400/70 mt-1">{aiError()}</div>
                      </div>
                    </Show>
                  </EmptyStateWithAction>
                </Show>
              </div>
            </Show>

            {/* Compare Tab */}
            <Show when={activeTab() === "compare"}>
              <div class="absolute inset-0 grid grid-cols-2 divide-x divide-zinc-200 dark:divide-slate-800 overflow-hidden">
                <div class="relative overflow-hidden">
                  <div class="absolute top-3 left-3 z-10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 rounded ring-1 ring-cyan-500/30">
                    Raw Data
                  </div>
                  <JsonViewer
                    data={rawData()}
                    loading={rawLoading()}
                    emptyMessage="No raw data"
                  />
                </div>
                <div class="relative overflow-hidden">
                  <div class="absolute top-3 left-3 z-10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-violet-500/10 text-violet-500 dark:text-violet-400 rounded ring-1 ring-violet-500/30">
                    AI Data
                  </div>
                  <JsonViewer
                    data={aiData()}
                    loading={aiLoading()}
                    emptyMessage="No AI data"
                  />
                </div>
              </div>
            </Show>

            {/* Prices Tab */}
            <Show when={activeTab() === "prices"}>
              <PricesTab
                slug={props.slug!}
                quotes={quotes()}
                deviceSources={deviceSources()}
                loading={pricesLoading()}
                error={yandexError()}
                onLink={handleLinkYandex}
                onScrape={handleScrapeYandex}
                onRefreshQuotes={refreshQuotes}
                scraping={yandexScraping() || yandexLinking()}
                scrapeProgress={scrapeProgress()}
                hasPriceRuLink={props.status?.hasPriceRuLink}
                onLinkPriceRu={props.onLinkPriceRu ? () => props.onLinkPriceRu!(props.slug!) : undefined}
                onGetPriceRuPrices={props.onGetPriceRuPrices ? () => props.onGetPriceRuPrices!(props.slug!) : undefined}
              />
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
