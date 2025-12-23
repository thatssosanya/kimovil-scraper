import { createSignal, createEffect, Show, on, For } from "solid-js";
import { TabBar, type TabId } from "./TabBar";
import { JsonViewer } from "./JsonViewer";
import type { PhoneDataRaw, PhoneDataAi, ScrapeStatus, PriceSummary } from "../types";

interface PhoneDataModalProps {
  slug: string | null;
  status: ScrapeStatus | null;
  onClose: () => void;
  fetchHtml: (slug: string) => Promise<{ html: string | null }>;
  fetchRawData: (slug: string) => Promise<PhoneDataRaw | null>;
  fetchAiData: (slug: string) => Promise<PhoneDataAi | null>;
  onProcessRaw?: (slug: string) => Promise<{ success: boolean; error?: string }>;
  onProcessAi?: (slug: string) => Promise<{ success: boolean; error?: string }>;
  onStatusChange?: () => void;
  fetchPrices?: (deviceId: string) => Promise<PriceSummary | null>;
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
        <div class="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center">
          {cfg.icon}
        </div>
        <div class="text-center">
          <div class="font-semibold">{cfg.label}</div>
          <div class="text-xs text-slate-500 mt-1">{cfg.description}</div>
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
      <div class="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
        <svg class="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 class="text-base font-medium text-slate-300 mb-1">{props.title}</h3>
      <p class="text-sm text-slate-500 text-center max-w-xs mb-6">{props.description}</p>
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
  const [prices, setPrices] = createSignal<PriceSummary | null>(null);
  const [pricesLoading, setPricesLoading] = createSignal(false);
  const [pricesFetched, setPricesFetched] = createSignal(false);

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
        setActiveTab("html");
        setHtml(null);
        setRawData(null);
        setAiData(null);
        setHtmlFetched(false);
        setRawFetched(false);
        setAiFetched(false);
        setRawError(null);
        setAiError(null);
        setPrices(null);
        setPricesFetched(false);
        setYandexUrl("");
        setYandexError(null);
        setScrapeProgress(0);
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

  // Fetch prices on tab change
  createEffect(
    on([() => props.slug, activeTab] as const, async ([slug, tab]) => {
      if (!slug || tab !== "prices" || pricesFetched()) return;
      if (!props.fetchPrices) return;

      setPricesLoading(true);
      const data = await props.fetchPrices(slug);
      setPrices(data);
      setPricesFetched(true);
      setPricesLoading(false);
    }),
  );

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

  const handleScrapeYandex = async () => {
    if (!props.slug) return;
    setYandexScraping(true);
    setYandexError(null);
    setScrapeProgress(0);

    try {
      const result = await sendWsRequest("yandex.scrape", {
        url: yandexUrl() || prices()?.quotes?.[0]?.url || "",
        deviceId: props.slug,
      });
      if (result.success) {
        setPricesFetched(false);
        if (props.fetchPrices) {
          const data = await props.fetchPrices(props.slug);
          setPrices(data);
          setPricesFetched(true);
        }
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

  const handleLinkYandex = async () => {
    if (!props.slug || !yandexUrl()) return;
    setYandexLinking(true);
    setYandexError(null);

    try {
      const result = await sendWsRequest("yandex.link", {
        deviceId: props.slug,
        url: yandexUrl(),
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
      available: (prices()?.quotes?.length ?? 0) > 0,
      enabled: true,
    },
  ];

  // Check if processing is possible
  const canProcessRaw = () => props.status?.hasHtml && !props.status?.hasRawData && !!props.onProcessRaw;
  const canProcessAi = () => props.status?.hasRawData && !props.status?.hasAiData && !!props.onProcessAi;

  return (
    <Show when={props.slug}>
      <div
        class="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
      >
        <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/50">
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div class="flex items-center gap-6">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <svg class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                </div>
                <span class="font-mono text-sm text-slate-300 bg-slate-800/50 px-2 py-1 rounded">
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
              class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
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
              <div class="absolute inset-0 grid grid-cols-2 divide-x divide-slate-800 overflow-hidden">
                <div class="relative overflow-hidden">
                  <div class="absolute top-3 left-3 z-10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 rounded ring-1 ring-cyan-500/30">
                    Raw Data
                  </div>
                  <JsonViewer
                    data={rawData()}
                    loading={rawLoading()}
                    emptyMessage="No raw data"
                  />
                </div>
                <div class="relative overflow-hidden">
                  <div class="absolute top-3 left-3 z-10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-violet-500/10 text-violet-400 rounded ring-1 ring-violet-500/30">
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
              <div class="absolute inset-0 overflow-auto p-6">
                <Show when={pricesLoading()}>
                  <div class="flex items-center justify-center py-24">
                    <div class="w-10 h-10 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
                  </div>
                </Show>

                <Show when={!pricesLoading()}>
                  {/* Error display */}
                  <Show when={yandexError()}>
                    <div class="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                      <div class="font-medium">Error</div>
                      <div class="text-rose-400/70 mt-1">{yandexError()}</div>
                    </div>
                  </Show>

                  {/* Has prices - show offers */}
                  <Show when={prices() && prices()!.quotes.length > 0}>
                    <div class="space-y-4">
                      {/* Summary header */}
                      <div class="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <div>
                          <div class="text-2xl font-bold text-white">
                            ₽{(prices()!.minPrice / 100).toLocaleString()} – ₽{(prices()!.maxPrice / 100).toLocaleString()}
                          </div>
                          <div class="text-sm text-slate-400 mt-1">
                            {prices()!.quotes.length} offers • Updated {new Date(prices()!.updatedAt * 1000).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={handleScrapeYandex}
                          disabled={yandexScraping()}
                          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Show when={yandexScraping()}>
                            <div class="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Refreshing... {scrapeProgress()}%</span>
                          </Show>
                          <Show when={!yandexScraping()}>
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh</span>
                          </Show>
                        </button>
                      </div>

                      {/* Offers list */}
                      <div class="space-y-2">
                        <For each={prices()!.quotes}>
                          {(offer) => (
                            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                              <div class="flex items-center gap-3">
                                <div class={`w-2 h-2 rounded-full ${offer.isAvailable ? "bg-emerald-400" : "bg-slate-500"}`} />
                                <div>
                                  <div class="font-medium text-slate-200">{offer.seller}</div>
                                  <Show when={offer.variantLabel}>
                                    <div class="text-xs text-slate-500">{offer.variantLabel}</div>
                                  </Show>
                                </div>
                              </div>
                              <div class="text-right">
                                <div class="font-bold text-white">₽{(offer.price / 100).toLocaleString()}</div>
                                <Show when={offer.url}>
                                  <a
                                    href={offer.url!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-xs text-amber-400 hover:text-amber-300"
                                  >
                                    View →
                                  </a>
                                </Show>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  {/* No prices yet - show link/scrape UI */}
                  <Show when={!prices() || prices()!.quotes.length === 0}>
                    <div class="flex flex-col items-center justify-center py-16">
                      <div class="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                        <svg class="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 class="text-base font-medium text-slate-300 mb-1">No price data</h3>
                      <p class="text-sm text-slate-500 text-center max-w-xs mb-6">
                        Link a Yandex.Market page to track prices for this device
                      </p>

                      <div class="w-full max-w-md space-y-3">
                        <input
                          type="url"
                          placeholder="https://market.yandex.ru/product/..."
                          value={yandexUrl()}
                          onInput={(e) => setYandexUrl(e.currentTarget.value)}
                          class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                        />
                        <button
                          onClick={handleLinkYandex}
                          disabled={!yandexUrl() || yandexLinking() || yandexScraping()}
                          class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Show when={yandexLinking() || yandexScraping()}>
                            <div class="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                            <span>{yandexLinking() ? "Linking..." : `Scraping... ${scrapeProgress()}%`}</span>
                          </Show>
                          <Show when={!yandexLinking() && !yandexScraping()}>
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span>Link & Scrape Prices</span>
                          </Show>
                        </button>
                      </div>
                    </div>
                  </Show>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
