import {
  createSignal,
  onMount,
  onCleanup,
  Show,
  For,
  createEffect,
} from "solid-js";
import { Request } from "@repo/scraper-protocol";
import { Header } from "./components/Header";

interface SearchOption {
  name: string;
  slug: string;
  url: string;
}

interface ScrapeStatus {
  hasHtml: boolean;
  queueStatus: string | null;
  isCorrupted: boolean | null;
  corruptionReason: string | null;
}

interface Stats {
  devices: number;
  pendingPrefixes: number;
}

interface ScrapeStats {
  corrupted: number;
  valid: number;
  scraped: number;
}

function App() {
  const [status, setStatus] = createSignal<string>("Disconnected");
  const [response, setResponse] = createSignal<any>(null);
  const [error, setError] = createSignal<any>(null);
  const [events, setEvents] = createSignal<any[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedSlug, setSelectedSlug] = createSignal<string | null>(null);
  const [phoneData, setPhoneData] = createSignal<any>(null);
  const [scrapeEvents, setScrapeEvents] = createSignal<any[]>([]);
  const [isScraping, setIsScraping] = createSignal(false);
  const [simulatedProgress, setSimulatedProgress] = createSignal(0);
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [scrapeStats, setScrapeStats] = createSignal<ScrapeStats | null>(null);
  const [slugStatus, setSlugStatus] = createSignal<
    Record<string, ScrapeStatus>
  >({});
  let ws: WebSocket | null = null;
  let currentRequestId: string | null = null;
  let progressInterval: ReturnType<typeof setInterval> | null = null;

  const fetchStats = async () => {
    try {
      const [statsRes, slugsRes] = await Promise.all([
        fetch("http://localhost:1488/api/slugs/stats"),
        fetch("http://localhost:1488/api/slugs?limit=1"),
      ]);
      const statsData: Stats = await statsRes.json();
      const slugsData = await slugsRes.json();
      setStats(statsData);
      if (slugsData.stats) setScrapeStats(slugsData.stats);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  };

  const fetchSlugStatus = async (slugs: string[]) => {
    if (slugs.length === 0) return;
    try {
      const res = await fetch(
        `http://localhost:1488/api/scrape/status?slugs=${slugs.join(",")}`,
      );
      const data: Record<string, ScrapeStatus> = await res.json();
      setSlugStatus(data);
    } catch (e) {
      console.error("Failed to fetch slug status:", e);
    }
  };

  // Simulate progress during AI processing (from 20% to 95% over ~25s)
  createEffect(() => {
    const events = scrapeEvents();
    const lastProgress = events
      .filter((e) => e.type === "progress")
      .slice(-1)[0];
    const isAiStage = lastProgress?.stage?.includes("AI") && isScraping();

    if (isAiStage && !progressInterval) {
      setSimulatedProgress(20);
      progressInterval = setInterval(() => {
        setSimulatedProgress((p) => Math.min(p + 3, 95));
      }, 1000);
    } else if (!isAiStage && progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
      setSimulatedProgress(0);
    }
  });

  onMount(() => {
    fetchStats();

    ws = new WebSocket("ws://localhost:1488/ws");

    ws.onopen = () => {
      console.log("Connected to WebSocket");
      setStatus("Connected");

      const request: Request = {
        id: crypto.randomUUID(),
        method: "health.check",
        params: {},
      };
      ws?.send(JSON.stringify(request));
    };

    ws.onmessage = (event) => {
      console.log("Received:", event.data);
      const data = JSON.parse(event.data);

      if (data.error) {
        setError(data.error);
        setResponse(null);
        setPhoneData(null);
        setIsScraping(false);
      } else if (data.event) {
        // Stream event - check if it's for scrape or search
        if (currentRequestId && data.id === currentRequestId) {
          if (isScraping()) {
            setScrapeEvents((prev) => [...prev, data.event]);
          } else {
            setEvents((prev) => [...prev, data.event]);
          }
        }
      } else if (data.result) {
        if (data.result.options) {
          setResponse(data);
          setError(null);
          const slugs = data.result.options.map((o: SearchOption) => o.slug);
          fetchSlugStatus(slugs);
        } else if (data.result.data) {
          // Scrape result
          setPhoneData(data.result.data);
          setIsScraping(false);
          setError(null);
        }
      }
    };

    ws.onerror = () => {
      setStatus("Error");
    };

    ws.onclose = () => {
      setStatus("Disconnected");
    };
  });

  onCleanup(() => {
    ws?.close();
  });

  const sendHealthCheck = () => {
    if (ws?.readyState === WebSocket.OPEN) {
      const request: Request = {
        id: crypto.randomUUID(),
        method: "health.check",
        params: {},
      };
      ws.send(JSON.stringify(request));
    }
  };

  const sendSearch = (query: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      setEvents([]);
      setResponse(null);
      setError(null);
      setSelectedSlug(null);
      setPhoneData(null);

      currentRequestId = crypto.randomUUID();
      const request = {
        id: currentRequestId,
        method: "scrape.search",
        params: { query },
      };
      ws.send(JSON.stringify(request));
    }
  };

  const sendScrape = (slug: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      setSelectedSlug(slug);
      setScrapeEvents([]);
      setPhoneData(null);
      setError(null);
      setIsScraping(true);

      currentRequestId = crypto.randomUUID();
      const request = {
        id: currentRequestId,
        method: "scrape.get",
        params: { slug },
      };
      ws.send(JSON.stringify(request));
    }
  };

  const searchOptions = (): SearchOption[] => {
    const res = response();
    return res?.result?.options ?? [];
  };

  return (
    <div class="min-h-screen bg-zinc-50 dark:bg-slate-950 text-zinc-900 dark:text-slate-200 font-sans selection:bg-indigo-500/30">
      <Header 
        currentPage="scraper" 
        status={status()} 
        onHealthCheck={sendHealthCheck} 
      />
      <div class="max-w-5xl mx-auto space-y-8 p-6 md:px-12 md:py-6">

        {/* Search Section */}
        <section class="max-w-2xl mx-auto w-full relative group">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-zinc-400 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && searchQuery() && sendSearch(searchQuery())
            }
            placeholder="Search devices (e.g. iPhone 14, Pixel 8)..."
            class="w-full pl-11 pr-32 py-4 bg-white dark:bg-slate-900 rounded-2xl text-lg text-zinc-900 dark:text-white border border-zinc-200 dark:border-slate-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-slate-600"
          />
          <div class="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button
              class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
              onClick={() => sendSearch(searchQuery())}
              disabled={status() !== "Connected" || !searchQuery()}
            >
              Search
            </button>
          </div>
        </section>

        {/* Database Overview */}
        <Show when={stats() || scrapeStats()}>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Show when={stats()}>
              <div class="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border border-indigo-500/20 rounded-xl p-4 relative overflow-hidden">
                <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
                <div class="relative">
                  <div class="text-3xl font-bold text-indigo-700 dark:text-white">
                    {stats()!.devices.toLocaleString()}
                  </div>
                  <div class="text-xs text-indigo-600/70 dark:text-indigo-300/70 font-medium uppercase tracking-wider mt-1">
                    Total Devices
                  </div>
                </div>
              </div>
            </Show>
            <Show when={scrapeStats()}>
              <div class="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-xl p-4 relative overflow-hidden">
                <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
                <div class="relative">
                  <div class="text-3xl font-bold text-cyan-700 dark:text-white">
                    {scrapeStats()!.scraped.toLocaleString()}
                  </div>
                  <div class="text-xs text-cyan-600/70 dark:text-cyan-300/70 font-medium uppercase tracking-wider mt-1">
                    Scraped
                  </div>
                </div>
              </div>
              <div class="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4 relative overflow-hidden">
                <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
                <div class="relative">
                  <div class="text-3xl font-bold text-emerald-700 dark:text-white">
                    {scrapeStats()!.valid.toLocaleString()}
                  </div>
                  <div class="text-xs text-emerald-600/70 dark:text-emerald-300/70 font-medium uppercase tracking-wider mt-1">
                    Valid
                  </div>
                </div>
              </div>
              <div class="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/20 rounded-xl p-4 relative overflow-hidden">
                <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>
                <div class="relative">
                  <div class="text-3xl font-bold text-rose-700 dark:text-white">
                    {scrapeStats()!.corrupted.toLocaleString()}
                  </div>
                  <div class="text-xs text-rose-600/70 dark:text-rose-300/70 font-medium uppercase tracking-wider mt-1">
                    Corrupted
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Search Events / Logs */}
        <Show when={events().length > 0 && !selectedSlug()}>
          <div class="bg-white/50 dark:bg-slate-900/50 border border-zinc-200 dark:border-slate-800 rounded-xl p-5 backdrop-blur-sm">
            <h2 class="text-xs font-semibold text-zinc-500 dark:text-slate-500 uppercase tracking-wider mb-3">
              Search Activity
            </h2>
            <div class="space-y-2 text-sm font-mono max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              <For each={events()}>
                {(evt) => (
                  <div class="flex gap-3 text-zinc-700 dark:text-slate-300 border-l-2 border-zinc-300 dark:border-slate-700 pl-3 py-0.5">
                    <Show when={evt.type === "log"}>
                      <span
                        class={`text-xs uppercase font-bold ${
                          evt.level === "error"
                            ? "text-rose-500 dark:text-rose-400"
                            : evt.level === "warn"
                              ? "text-amber-500 dark:text-amber-400"
                              : "text-indigo-500 dark:text-indigo-400"
                        }`}
                      >
                        [{evt.level}]
                      </span>
                      <span class="text-zinc-500 dark:text-slate-400">{evt.message}</span>
                    </Show>
                    <Show when={evt.type === "retry"}>
                      <span class="text-amber-500 dark:text-amber-400 font-bold">RETRY</span>
                      <span class="text-zinc-500 dark:text-slate-400">
                        {evt.attempt}/{evt.maxAttempts} - {evt.reason}
                      </span>
                    </Show>
                    <Show when={evt.type === "progress"}>
                      <span class="text-emerald-500 dark:text-emerald-400 font-bold">PROGRESS</span>
                      <span class="text-zinc-700 dark:text-slate-300">
                        {evt.stage} {evt.percent && `(${evt.percent}%)`}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Error State */}
        <Show when={error()}>
          <div class="bg-rose-950/30 border border-rose-500/30 p-5 rounded-xl flex items-start gap-4">
            <div class="bg-rose-500/20 p-2 rounded-lg text-rose-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 class="font-bold text-rose-300 text-lg">Operation Failed</h2>
              <div class="text-rose-200/80 mt-1">
                <div class="font-mono text-xs opacity-70 mb-1">
                  {error().code}
                </div>
                <p>{error().message}</p>
              </div>
            </div>
          </div>
        </Show>

        {/* Search Results Grid */}
        <Show when={searchOptions().length > 0}>
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-zinc-700 dark:text-slate-300 flex items-center gap-2">
              Found {searchOptions().length} devices
              <span class="h-px bg-zinc-200 dark:bg-slate-800 flex-1 ml-4"></span>
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <For each={searchOptions()}>
                {(option) => {
                  const status = () => slugStatus()[option.slug];
                  const isScraped = () => status()?.hasHtml;
                  const isValid = () =>
                    status()?.hasHtml && status()?.isCorrupted === false;
                  const isCorrupted = () => status()?.isCorrupted === true;

                  return (
                    <button
                      class={`group text-left p-5 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden ${
                        selectedSlug() === option.slug
                          ? "bg-indigo-100 dark:bg-indigo-900/20 border-indigo-500/50 ring-1 ring-indigo-500/30"
                          : "bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-800 hover:border-zinc-300 dark:hover:border-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-black/20"
                      }`}
                      onClick={() => sendScrape(option.slug)}
                      disabled={isScraping()}
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-lg text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                              {option.name}
                            </span>
                            <Show when={isValid()}>
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                Valid
                              </span>
                            </Show>
                            <Show when={isCorrupted()}>
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/20">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 9v2m0 4h.01"
                                  />
                                </svg>
                                Corrupted
                              </span>
                            </Show>
                            <Show
                              when={isScraped() && !isValid() && !isCorrupted()}
                            >
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                                Scraped
                              </span>
                            </Show>
                          </div>
                          <div class="text-xs font-mono text-zinc-500 dark:text-slate-500 mt-1.5 bg-zinc-100 dark:bg-slate-950/50 inline-block px-2 py-0.5 rounded border border-zinc-200 dark:border-slate-800 group-hover:border-zinc-300 dark:group-hover:border-slate-700 truncate max-w-full">
                            {option.slug}
                          </div>
                        </div>
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <div class="bg-indigo-600 text-white p-2 rounded-lg shadow-lg">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Scrape Progress Dashboard */}
        <Show
          when={selectedSlug() && (isScraping() || scrapeEvents().length > 0)}
        >
          {(() => {
            const progressEvents = () =>
              scrapeEvents().filter((e) => e.type === "progress");
            const lastProgress = () => progressEvents().slice(-1)[0];
            const lastLog = () =>
              scrapeEvents()
                .filter((e) => e.type === "log")
                .slice(-1)[0];
            const hasError = () =>
              scrapeEvents().some(
                (e) => e.type === "log" && e.level === "error",
              );
            const isAiStage = () =>
              lastProgress()?.stage?.includes("AI") && isScraping();
            const progress = () => {
              if (isAiStage()) return simulatedProgress();
              return lastProgress()?.percent ?? 0;
            };
            const stage = () => lastProgress()?.stage ?? "Initializing...";
            const currentMessage = () =>
              lastLog()?.message ?? "Waiting for events...";
            const totalDuration = () => lastProgress()?.durationMs;

            const formatDuration = (ms: number) => {
              if (ms < 1000) return `${ms}ms`;
              return `${(ms / 1000).toFixed(1)}s`;
            };

            return (
              <div class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl shadow-zinc-200/50 dark:shadow-black/30 relative overflow-hidden">
                {/* Background Glow */}
                <div class="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

                <div class="relative">
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-4">
                      <div
                        class={`relative w-12 h-12 rounded-xl flex items-center justify-center ${
                          isScraping()
                            ? "bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/40"
                            : hasError()
                              ? "bg-rose-500/20 text-rose-500 dark:text-rose-400"
                              : "bg-emerald-500/20 text-emerald-500 dark:text-emerald-400"
                        }`}
                      >
                        <Show
                          when={isScraping()}
                          fallback={
                            hasError() ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )
                          }
                        >
                          <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </Show>
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <h2 class="font-bold text-xl text-zinc-900 dark:text-white tracking-tight">
                            {stage()}
                          </h2>
                          <Show when={totalDuration()}>
                            <span class="text-xs font-mono bg-zinc-100 dark:bg-slate-800 text-zinc-500 dark:text-slate-400 px-2 py-0.5 rounded">
                              {formatDuration(totalDuration()!)}
                            </span>
                          </Show>
                        </div>
                        <div class="text-zinc-500 dark:text-slate-400 text-sm mt-0.5 font-mono">
                          {selectedSlug()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div class="mb-6 relative">
                    <div class="flex justify-between text-xs font-semibold text-zinc-500 dark:text-slate-500 mb-2 uppercase tracking-wide">
                      <span>Progress</span>
                      <span>{Math.round(progress())}%</span>
                    </div>
                    <div class="w-full bg-zinc-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        class={`h-3 rounded-full transition-all duration-500 ease-out relative ${
                          hasError()
                            ? "bg-rose-500"
                            : progress() === 100
                              ? "bg-emerald-500"
                              : "bg-gradient-to-r from-indigo-500 to-cyan-400"
                        }`}
                        style={{ width: `${progress()}%` }}
                      >
                        <Show when={isScraping()}>
                          <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                          <div class="absolute top-0 left-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                        </Show>
                      </div>
                    </div>
                  </div>

                  {/* Console Output */}
                  <div class="bg-zinc-100 dark:bg-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800/50 p-4 font-mono text-xs overflow-hidden">
                    <div class="flex gap-2 text-zinc-600 dark:text-slate-400">
                      <span class="text-indigo-500">➜</span>
                      <span>{currentMessage()}</span>
                    </div>
                  </div>

                  {/* Stats Breakdown */}
                  <Show when={!isScraping() && progressEvents().length > 1}>
                    <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <For each={progressEvents().filter((e) => e.durationMs)}>
                        {(evt) => (
                          <div class="bg-zinc-100 dark:bg-slate-800/50 p-3 rounded-lg border border-zinc-200 dark:border-slate-700/50">
                            <div class="text-[10px] text-zinc-500 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">
                              {evt.stage
                                .replace("Scraping: ", "")
                                .replace("Scrape: ", "")}
                            </div>
                            <div class="text-lg font-mono text-zinc-900 dark:text-white">
                              {formatDuration(evt.durationMs!)}
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            );
          })()}
        </Show>

        {/* Phone Data Display */}
        <Show when={phoneData()}>
          <div class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div class="p-6 border-b border-zinc-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50 dark:bg-slate-900/50">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-xl">
                  {phoneData().brand?.[0] || "?"}
                </div>
                <div>
                  <h2 class="font-bold text-2xl text-zinc-900 dark:text-white">
                    {phoneData().brand} {phoneData().name}
                  </h2>
                  <div class="text-zinc-500 dark:text-slate-400 text-sm">{phoneData().slug}</div>
                </div>
              </div>
              <button
                class="flex items-center gap-2 text-sm font-medium cursor-pointer bg-zinc-100 dark:bg-slate-800 hover:bg-zinc-200 dark:hover:bg-slate-700 text-zinc-900 dark:text-white px-4 py-2 rounded-lg transition-all border border-zinc-200 dark:border-slate-700 hover:border-zinc-300 dark:hover:border-slate-600 shadow-sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(phoneData(), null, 2),
                  );
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-zinc-500 dark:text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy JSON
              </button>
            </div>

            <div class="grid md:grid-cols-2 border-b border-zinc-200 dark:border-slate-800">
              {/* Quick Specs View - A few key fields if available */}
              <div class="p-6 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-slate-800 space-y-4">
                <h3 class="text-sm font-bold text-zinc-500 dark:text-slate-500 uppercase tracking-wider">
                  Key Specifications
                </h3>
                <div class="space-y-3">
                  <Show when={phoneData().screen}>
                    <div class="flex justify-between items-center py-2 border-b border-zinc-200 dark:border-slate-800/50">
                      <span class="text-zinc-500 dark:text-slate-400">Screen</span>
                      <span class="text-zinc-800 dark:text-slate-200 font-medium text-right">
                        {phoneData().screen.size}"{" "}
                        {phoneData().screen.resolution}
                      </span>
                    </div>
                  </Show>
                  <Show when={phoneData().cpu}>
                    <div class="flex justify-between items-center py-2 border-b border-zinc-200 dark:border-slate-800/50">
                      <span class="text-zinc-500 dark:text-slate-400">Processor</span>
                      <span class="text-zinc-800 dark:text-slate-200 font-medium text-right">
                        {phoneData().cpu.name || "Unknown"}
                      </span>
                    </div>
                  </Show>
                  <Show when={phoneData().battery}>
                    <div class="flex justify-between items-center py-2 border-b border-zinc-200 dark:border-slate-800/50">
                      <span class="text-zinc-500 dark:text-slate-400">Battery</span>
                      <span class="text-zinc-800 dark:text-slate-200 font-medium text-right">
                        {phoneData().battery.capacity}{" "}
                        {phoneData().battery.type}
                      </span>
                    </div>
                  </Show>
                  <Show when={phoneData().storage}>
                    <div class="flex justify-between items-center py-2 border-b border-zinc-200 dark:border-slate-800/50">
                      <span class="text-zinc-500 dark:text-slate-400">Storage</span>
                      <span class="text-zinc-800 dark:text-slate-200 font-medium text-right">
                        {phoneData().storage.capacity}
                      </span>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Raw JSON Preview */}
              <div class="relative group">
                <div class="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span class="text-[10px] text-zinc-500 dark:text-slate-500 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-zinc-200 dark:border-slate-800">
                    Raw Data
                  </span>
                </div>
                <pre class="text-xs overflow-auto h-64 md:h-full max-h-96 bg-zinc-100 dark:bg-slate-950 p-6 font-mono text-emerald-600 dark:text-emerald-300/90 leading-relaxed custom-scrollbar">
                  {JSON.stringify(phoneData(), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default App;
