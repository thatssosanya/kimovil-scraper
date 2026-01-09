import { createSignal, Show, For, onMount, createEffect, onCleanup } from "solid-js";
import { Header } from "../../components/Header";
import {
  type WidgetMapping,
  type SyncStatus,
  type SuggestedMatch,
  type DeviceSearchResult,
  type PostInfo,
  type DevicePreview,
  type NewDeviceDefaults,
  type PriceInfo,
  type SortField,
  type StatusTab,
  type PeriodOption,
  type PreviewTab,
  type DetailedQuote,
  type CatalogueLink,
  PERIOD_OPTIONS,
} from "./WidgetDebug.types";
import * as api from "../../api/widgetMappings";
import { SyncStatusCard } from "./components/SyncStatusCard";
import { StatsRow } from "./components/StatsRow";
import { FiltersBar } from "./components/FiltersBar";
import { MappingsTable } from "./components/MappingsTable";
import { StatusBadge } from "./components/StatusBadge";

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

  // Modal state
  const [modalLoading, setModalLoading] = createSignal(false);
  const [suggestions, setSuggestions] = createSignal<SuggestedMatch[]>([]);
  const [posts, setPosts] = createSignal<PostInfo[]>([]);
  const [devicePreview, setDevicePreview] = createSignal<DevicePreview | null>(null);
  const [newDeviceDefaults, setNewDeviceDefaults] = createSignal<NewDeviceDefaults | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = createSignal<string | null>(null);
  const [_selectedDeviceName, setSelectedDeviceName] = createSignal<string | null>(null);
  const [deviceSearch, setDeviceSearch] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<DeviceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [actionLoading, setActionLoading] = createSignal(false);

  // Create device form state
  const [newDeviceBrand, setNewDeviceBrand] = createSignal("");
  const [newDeviceName, setNewDeviceName] = createSignal("");
  const [newDeviceSlug, setNewDeviceSlug] = createSignal("");
  const [createError, setCreateError] = createSignal<string | null>(null);

  // Preview tab state
  const [previewTab, setPreviewTab] = createSignal<PreviewTab>("widget");
  const [widgetHtml, setWidgetHtml] = createSignal<string | null>(null);
  const [widgetFetched, setWidgetFetched] = createSignal(false); // Track if we've attempted fetch
  const [widgetLoading, setWidgetLoading] = createSignal(false);
  const [mobilePreview, setMobilePreview] = createSignal(false);

  // Price scraping state
  const [priceInfo, setPriceInfo] = createSignal<PriceInfo | null>(null);
  const [priceLoading, setPriceLoading] = createSignal(false);

  // Detailed quotes for Prices tab
  const [detailedQuotes, setDetailedQuotes] = createSignal<DetailedQuote[]>([]);
  const [priceRuScraping, setPriceRuScraping] = createSignal(false);
  const [yandexScraping, setYandexScraping] = createSignal(false);
  const [yandexUrl, setYandexUrl] = createSignal("");
  const [scrapeError, setScrapeError] = createSignal<string | null>(null);
  const [scrapeSuccess, setScrapeSuccess] = createSignal<string | null>(null);

  // Catalogue links state
  const [catalogueLinks, setCatalogueLinks] = createSignal<CatalogueLink[] | null>(null);
  const [_catalogueLoading, setCatalogueLoading] = createSignal(false);

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

  const openMappingEditor = async (mapping: WidgetMapping, _listIndex?: number) => {
    setSelectedMapping(mapping);
    setModalLoading(true);
    setSuggestions([]);
    setPosts([]);
    setDevicePreview(null);
    setNewDeviceDefaults(null);
    setSelectedDeviceId(mapping.deviceId);
    setSelectedDeviceName(null);
    setDeviceSearch("");
    setSearchResults([]);
    setCreateError(null);
    setPreviewTab("widget");
    setWidgetHtml(null);
    // Reset price state
    setPriceInfo(null);
    setYandexUrl("");
    setScrapeError(null);
    setScrapeSuccess(null);

    try {
      const data = await api.getMappingContext(mapping.rawModel);
      setSuggestions(data.suggestions);
      setPosts(data.posts);
      setDevicePreview(data.devicePreview);
      setNewDeviceDefaults(data.newDeviceDefaults);
      // Initialize create form with defaults
      setNewDeviceBrand(data.newDeviceDefaults.brand ?? "");
      setNewDeviceName(data.newDeviceDefaults.modelName);
      setNewDeviceSlug(data.newDeviceDefaults.suggestedSlug);
      if (mapping.deviceId) {
        const match = data.suggestions.find((s) => s.deviceId === mapping.deviceId);
        if (match) {
          setSelectedDeviceName(match.name);
        }
      }
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedMapping(null);
    setSuggestions([]);
    setPosts([]);
    setDevicePreview(null);
    setNewDeviceDefaults(null);
    setSelectedDeviceId(null);
    setSelectedDeviceName(null);
    setDeviceSearch("");
    setSearchResults([]);
    setCatalogueLinks(null);
  };

  const advanceToNext = (justReviewedRawModel?: string) => {
    const needsReview = filteredMappings().filter(
      (m) => m.status === "pending" || m.status === "suggested"
    );

    if (needsReview.length === 0) {
      closeModal();
      return;
    }

    // Find the index of the just-reviewed item in the new needs_review list
    // It should not be there anymore (status changed), but if it is, skip past it
    let nextIdx = 0;
    if (justReviewedRawModel) {
      const oldIdx = needsReview.findIndex((m) => m.rawModel === justReviewedRawModel);
      // If not found (expected), start at index 0; if found, go to next
      nextIdx = oldIdx === -1 ? 0 : Math.min(oldIdx, needsReview.length - 1);
    }

    const next = needsReview[nextIdx];
    if (next) {
      openMappingEditor(next, nextIdx);
    } else {
      closeModal();
    }
  };

  const handleConfirm = async () => {
    const mapping = selectedMapping();
    if (!mapping || !selectedDeviceId()) return;

    const rawModel = mapping.rawModel;
    setActionLoading(true);
    try {
      await api.updateMapping(rawModel, {
        deviceId: selectedDeviceId(),
        status: "confirmed",
      });
      await fetchMappings();
      advanceToNext(rawModel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setActionLoading(false);
    }
  };

  const handleIgnore = async () => {
    const mapping = selectedMapping();
    if (!mapping) return;

    const rawModel = mapping.rawModel;
    setActionLoading(true);
    try {
      await api.updateMapping(rawModel, { status: "ignored" });
      await fetchMappings();
      advanceToNext(rawModel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setActionLoading(false);
    }
  };

  const selectSuggestion = (suggestion: SuggestedMatch) => {
    setSelectedDeviceId(suggestion.deviceId);
    setSelectedDeviceName(suggestion.name);
    setDevicePreview({
      id: suggestion.deviceId,
      slug: suggestion.slug,
      name: suggestion.name,
      brand: null,
    });
    setWidgetHtml(null); // Clear cached widget on selection change
    setWidgetFetched(false);
  };

  const selectSearchResult = (result: DeviceSearchResult) => {
    setSelectedDeviceId(result.id);
    setSelectedDeviceName(result.name);
    setDevicePreview({
      id: result.id,
      slug: result.slug,
      name: result.name,
      brand: result.brand,
    });
    setSearchResults([]);
    setDeviceSearch("");
    setWidgetHtml(null); // Clear cached widget on selection change
    setWidgetFetched(false);
  };

  const clearSelection = () => {
    setSelectedDeviceId(null);
    setSelectedDeviceName(null);
    setDevicePreview(null);
    setWidgetHtml(null);
    setWidgetFetched(false);
    setPreviewTab("widget");
  };

  const fetchWidgetPreview = async (slug: string, bustCache = false) => {
    setWidgetLoading(true);
    setWidgetFetched(false);
    try {
      const html = await api.getWidgetHtml(slug, bustCache);
      setWidgetHtml(html);
    } catch {
      setWidgetHtml(null);
    } finally {
      setWidgetLoading(false);
      setWidgetFetched(true);
    }
  };

  // Fetch widget when tab changes to widget and we have a device
  createEffect(() => {
    const tab = previewTab();
    const device = devicePreview();
    if (tab === "widget" && device && !widgetHtml() && !widgetLoading() && !widgetFetched()) {
      fetchWidgetPreview(device.slug);
    }
  });

  const handleCreateDevice = async () => {
    const slug = newDeviceSlug().trim();
    const name = newDeviceName().trim();
    const brand = newDeviceBrand().trim() || null;

    if (!slug || !name) {
      setCreateError("Slug and name are required");
      return;
    }

    setActionLoading(true);
    setCreateError(null);

    try {
      const device = await api.createDevice({ slug, name, brand });

      setSelectedDeviceId(device.id);
      setSelectedDeviceName(device.name);
      setDevicePreview({
        id: device.id,
        slug: device.slug,
        name: device.name,
        brand: device.brand,
      });
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create device");
    } finally {
      setActionLoading(false);
    }
  };

  // Price scraping handlers
  const fetchPriceInfo = async (deviceId: string) => {
    setPriceLoading(true);
    try {
      const data = await api.getPriceInfo(deviceId);
      setPriceInfo(data);
      if ((data as PriceInfo & { quotes?: DetailedQuote[] }).quotes) {
        setDetailedQuotes((data as PriceInfo & { quotes: DetailedQuote[] }).quotes);
      }
      const yandexLink = data.linkedSources?.find((s) => s.source === "yandex_market");
      if (yandexLink?.url) {
        setYandexUrl(yandexLink.url);
      }
    } catch (e) {
      console.error("Failed to fetch price info:", e);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleScrapePriceRu = async () => {
    const device = devicePreview();
    if (!device) return;

    setPriceRuScraping(true);
    setScrapeError(null);
    setScrapeSuccess(null);

    try {
      const data = await api.scrapePriceRu(device.id);

      if (!data.success) {
        setScrapeError(data.error || "Failed to scrape");
      } else if (data.offerCount === 0) {
        setScrapeSuccess(data.message || "No offers found");
      } else {
        setScrapeSuccess(
          `Found ${data.offerCount} offers (${formatPrice(data.minPrice)} - ${formatPrice(data.maxPrice)})`
        );
        await fetchPriceInfo(device.id);
        setWidgetHtml(null);
        fetchWidgetPreview(device.slug, true);
      }
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPriceRuScraping(false);
    }
  };

  const handleScrapeYandex = async () => {
    const device = devicePreview();
    const url = yandexUrl().trim();
    if (!device || !url) return;

    setYandexScraping(true);
    setScrapeError(null);
    setScrapeSuccess(null);

    try {
      const data = await api.scrapeYandex(device.id, url);

      if (!data.success) {
        setScrapeError(data.error || "Failed to scrape");
      } else if (data.offerCount === 0) {
        setScrapeSuccess(data.message || "No offers found");
      } else {
        setScrapeSuccess(
          `Found ${data.offerCount} offers (${formatPrice(data.minPrice)} - ${formatPrice(data.maxPrice)})`
        );
        await fetchPriceInfo(device.id);
        setWidgetHtml(null);
        fetchWidgetPreview(device.slug, true);
      }
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setYandexScraping(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (price == null) return "—";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Fetch price info when widget tab is opened
  createEffect(() => {
    const tab = previewTab();
    const device = devicePreview();
    if ((tab === "widget" || tab === "prices") && device && !priceInfo() && !priceLoading()) {
      fetchPriceInfo(device.id);
    }
  });

  // Fetch catalogue links when device is selected
  const fetchCatalogueLinks = async (slug: string) => {
    setCatalogueLoading(true);
    try {
      const links = await api.getCatalogueLinks(slug);
      setCatalogueLinks(links);
    } catch {
      setCatalogueLinks([]);
    } finally {
      setCatalogueLoading(false);
    }
  };

  createEffect(() => {
    const device = devicePreview();
    if (device) {
      fetchCatalogueLinks(device.slug);
    } else {
      setCatalogueLinks(null);
    }
  });

  let searchTimeout: ReturnType<typeof setTimeout>;
  const handleDeviceSearch = (query: string) => {
    setDeviceSearch(query);
    clearTimeout(searchTimeout);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    searchTimeout = setTimeout(async () => {
      try {
        const results = await api.searchDevices(query);
        setSearchResults(results);
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  onMount(() => {
    fetchMappings();
    fetchSyncStatus();
  });

  // Keyboard shortcuts for modal
  createEffect(() => {
    const mapping = selectedMapping();
    if (!mapping) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (actionLoading() || modalLoading()) return;
      
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closeModal();
          break;
        case "Enter":
          if (selectedDeviceId()) {
            e.preventDefault();
            handleConfirm();
          }
          break;
        case "i":
        case "I":
          e.preventDefault();
          handleIgnore();
          break;
        case "ArrowUp":
          e.preventDefault();
          navigateSuggestions(-1);
          break;
        case "ArrowDown":
          e.preventDefault();
          navigateSuggestions(1);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  const navigateSuggestions = (direction: number) => {
    const sug = suggestions();
    if (sug.length === 0) return;
    
    const currentId = selectedDeviceId();
    const currentIdx = sug.findIndex((s) => s.deviceId === currentId);
    
    let newIdx: number;
    if (currentIdx === -1) {
      newIdx = direction > 0 ? 0 : sug.length - 1;
    } else {
      newIdx = currentIdx + direction;
      if (newIdx < 0) newIdx = sug.length - 1;
      if (newIdx >= sug.length) newIdx = 0;
    }
    
    selectSuggestion(sug[newIdx]);
  };

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

  const formatDate = (ts: number | null) => {
    if (ts == null) return "Never";
    const d = new Date(ts * 1000);
    return d.toLocaleString();
  };

  const needsReviewCount = () =>
    mappings().filter((m) => m.status === "pending" || m.status === "suggested").length;
  const confirmedCount = () =>
    mappings().filter((m) => m.status === "confirmed" || m.status === "auto_confirmed").length;

  return (
    <div class="min-h-screen bg-zinc-100 dark:bg-slate-950">
      <Header currentPage="widget-debug" />

      <div class="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
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

        {/* Error */}
        <Show when={error()}>
          <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-4 text-rose-600 dark:text-rose-400">
            {error()}
          </div>
        </Show>

        {/* Loading */}
        <Show when={loading() || syncing()}>
          <div class="flex items-center justify-center py-12 gap-3">
            <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span class="text-zinc-500 dark:text-slate-400">
              {syncing() ? "Syncing from WordPress..." : "Loading..."}
            </span>
          </div>
        </Show>

        {/* Table */}
        <Show when={!loading() && !syncing()}>
          <MappingsTable
            mappings={filteredMappings()}
            sortField={sortField()}
            sortDesc={sortDesc()}
            onSortChange={toggleSort}
            onRowClick={(mapping) => openMappingEditor(mapping)}
            total={total()}
          />
        </Show>

        {/* Mapping Review Modal */}
        <Show when={selectedMapping()}>
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8">
          <div class="w-full h-full max-w-[95vw] max-h-[90vh] flex flex-col bg-zinc-100 dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div class="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-800 px-6 py-4">
              <div class="flex items-center justify-between max-w-screen-2xl mx-auto">
                <div class="flex items-center gap-4 min-w-0 flex-1">
                  <div class="min-w-0">
                    <h2 class="text-lg font-semibold text-zinc-900 dark:text-white truncate font-mono">
                      {selectedMapping()!.rawModel}
                    </h2>
                    <div class="flex items-center gap-3 mt-1">
                      <StatusBadge status={selectedMapping()!.status} />
                      <span class="text-xs text-zinc-500 dark:text-slate-400">
                        {selectedMapping()!.usageCount} uses
                      </span>
                      <span class="text-xs text-zinc-500 dark:text-slate-400">
                        {formatDate(selectedMapping()!.firstSeenAt)} — {formatDate(selectedMapping()!.lastSeenAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-xs text-zinc-400 dark:text-slate-500 hidden sm:inline">
                    Esc to close · Enter to confirm · I to ignore
                  </span>
                  <button
                    onClick={closeModal}
                    class="p-2 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-zinc-500"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Body - Two Columns */}
            <div class="flex-1 overflow-hidden">
              <Show when={modalLoading()}>
                <div class="flex items-center justify-center h-full gap-3">
                  <div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span class="text-zinc-500 dark:text-slate-400">Loading...</span>
                </div>
              </Show>

              <Show when={!modalLoading()}>
                <div class="h-full grid grid-cols-1 lg:grid-cols-2 gap-0 max-w-screen-2xl mx-auto">
                  {/* LEFT COLUMN - Info & Matching */}
                  <div class="flex flex-col h-full overflow-hidden border-r border-zinc-200 dark:border-slate-800">
                    <div class="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Posts Section */}
                      <div>
                        <div class="flex items-center justify-between mb-3">
                          <div class="text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">
                            Posts with this widget
                          </div>
                          <span class="text-xs text-zinc-400 dark:text-slate-500">
                            {posts().length} posts
                          </span>
                        </div>
                        <Show when={posts().length > 0} fallback={
                          <div class="text-sm text-zinc-400 dark:text-slate-500 italic py-2">
                            No posts found with this widget
                          </div>
                        }>
                          <div class="space-y-1 max-h-48 overflow-y-auto">
                            <For each={posts()}>
                              {(post) => (
                                <a
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group"
                                >
                                  <span class="text-sm text-zinc-700 dark:text-slate-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                    {post.title}
                                  </span>
                                  <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span class="text-xs text-zinc-400 dark:text-slate-500">
                                      {new Date(post.dateGmt).toLocaleDateString()}
                                    </span>
                                    <svg class="w-3.5 h-3.5 text-zinc-400 group-hover:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </div>
                                </a>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>

                      {/* Suggested Matches - hide when already confirmed */}
                      <Show when={selectedMapping()?.status !== "confirmed"}>
                        <div>
                          <div class="text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                            Suggested Matches
                          </div>
                          <Show when={suggestions().length > 0} fallback={
                            <div class="text-sm text-zinc-400 dark:text-slate-500 italic py-2">
                              No matching devices found
                            </div>
                          }>
                            <div class="space-y-1.5">
                              <For each={suggestions()}>
                                {(suggestion, idx) => (
                                  <button
                                    onClick={() => selectSuggestion(suggestion)}
                                    class={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 ${
                                      selectedDeviceId() === suggestion.deviceId
                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500/20"
                                        : "border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-zinc-300 dark:hover:border-slate-700"
                                    }`}
                                  >
                                    <div class="flex items-center justify-between gap-2">
                                      <div class="flex items-center gap-2.5 min-w-0">
                                        <div
                                          class={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                                            selectedDeviceId() === suggestion.deviceId
                                              ? "border-indigo-500 bg-indigo-500"
                                              : "border-zinc-300 dark:border-slate-600"
                                          }`}
                                        />
                                        <div class="min-w-0">
                                          <div class="flex items-center gap-2">
                                            <span class="font-medium text-sm text-zinc-900 dark:text-white truncate">
                                              {suggestion.name}
                                            </span>
                                            <Show when={idx() === 0 && suggestion.confidence >= 0.97}>
                                              <span class="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-semibold uppercase">
                                                Best
                                              </span>
                                            </Show>
                                          </div>
                                          <div class="text-xs text-zinc-400 dark:text-slate-500 font-mono truncate">
                                            {suggestion.slug}
                                          </div>
                                        </div>
                                      </div>
                                      <span
                                        class={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                                          suggestion.confidence >= 0.9
                                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                            : suggestion.confidence >= 0.7
                                            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                            : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-400"
                                        }`}
                                      >
                                        {Math.round(suggestion.confidence * 100)}%
                                      </span>
                                    </div>
                                  </button>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </Show>

                      {/* Device Search */}
                      <div>
                        <div class="text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                          Search All Devices
                        </div>
                        <div class="relative">
                          <input
                            type="text"
                            placeholder="Search by name or slug..."
                            value={deviceSearch()}
                            onInput={(e) => handleDeviceSearch(e.currentTarget.value)}
                            class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-slate-500"
                          />
                          <Show when={searchLoading()}>
                            <div class="absolute right-3 top-1/2 -translate-y-1/2">
                              <div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          </Show>
                        </div>
                        <Show when={searchResults().length > 0}>
                          <div class="mt-2 border border-zinc-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                            <For each={searchResults()}>
                              {(result) => (
                                <button
                                  onClick={() => selectSearchResult(result)}
                                  class="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-slate-800 transition-colors border-b last:border-b-0 border-zinc-100 dark:border-slate-800"
                                >
                                  <div class="flex items-center justify-between">
                                    <div class="min-w-0">
                                      <div class="font-medium text-zinc-900 dark:text-white text-sm truncate">
                                        {result.name}
                                      </div>
                                      <div class="text-xs text-zinc-400 dark:text-slate-500 font-mono truncate">
                                        {result.slug}
                                      </div>
                                    </div>
                                    <Show when={result.brand}>
                                      <span class="text-xs text-zinc-500 dark:text-slate-400 flex-shrink-0 ml-2 bg-zinc-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                        {result.brand}
                                      </span>
                                    </Show>
                                  </div>
                                </button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div class="flex-shrink-0 p-4 bg-white dark:bg-slate-900 border-t border-zinc-200 dark:border-slate-800">
                      <Show when={selectedMapping()?.status === "confirmed"} fallback={
                        <div class="flex items-center justify-between gap-3">
                          <button
                            onClick={closeModal}
                            disabled={actionLoading()}
                            class="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <div class="flex items-center gap-2">
                            <button
                              onClick={handleIgnore}
                              disabled={actionLoading()}
                              class="px-4 py-2 text-sm font-medium border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              <Show when={actionLoading()}>
                                <div class="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                              </Show>
                              Ignore
                            </button>
                            <button
                              onClick={handleConfirm}
                              disabled={actionLoading() || !selectedDeviceId()}
                              class="px-5 py-2 text-sm font-semibold bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/25 flex items-center gap-2"
                            >
                              <Show when={actionLoading()}>
                                <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              </Show>
                              Confirm Match
                            </button>
                          </div>
                        </div>
                      }>
                        {/* Simplified footer for confirmed mappings */}
                        <div class="flex items-center justify-end">
                          <button
                            onClick={closeModal}
                            class="px-5 py-2 text-sm font-medium bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-slate-700 transition-colors"
                          >
                            Done
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>

                  {/* RIGHT COLUMN - Device Preview */}
                  <div class="flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-slate-900/50">
                    <div class="flex-1 overflow-y-auto p-6">
                      <Show when={devicePreview()} fallback={
                        <Show when={suggestions().length === 0 && newDeviceDefaults()} fallback={
                          <div class="h-full flex flex-col items-center justify-center text-center p-8">
                            <div class="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-slate-800 flex items-center justify-center mb-4">
                              <svg class="w-8 h-8 text-zinc-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-zinc-700 dark:text-slate-300 mb-2">
                              Select a device
                            </h3>
                            <p class="text-sm text-zinc-500 dark:text-slate-500 max-w-xs">
                              Choose a device from the suggestions or search to see its preview here
                            </p>
                          </div>
                        }>
                          {/* Create New Device Form */}
                          <div class="h-full flex flex-col">
                            <div class="flex items-center gap-3 mb-6">
                              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                              <div>
                                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
                                  Create New Device
                                </h3>
                                <p class="text-sm text-zinc-500 dark:text-slate-400">
                                  No matches found. Add this device to the database.
                                </p>
                              </div>
                            </div>

                            <div class="space-y-4 flex-1">
                              <div>
                                <label class="block text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                  Brand (optional)
                                </label>
                                <input
                                  type="text"
                                  value={newDeviceBrand()}
                                  onInput={(e) => setNewDeviceBrand(e.currentTarget.value)}
                                  placeholder="e.g. Samsung, Apple, Xiaomi"
                                  class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                              <div>
                                <label class="block text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                  Device Name *
                                </label>
                                <input
                                  type="text"
                                  value={newDeviceName()}
                                  onInput={(e) => setNewDeviceName(e.currentTarget.value)}
                                  placeholder="e.g. Galaxy S25 Ultra"
                                  class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                              <div>
                                <label class="block text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                  Slug *
                                </label>
                                <input
                                  type="text"
                                  value={newDeviceSlug()}
                                  onInput={(e) => setNewDeviceSlug(e.currentTarget.value)}
                                  placeholder="e.g. galaxy-s25-ultra"
                                  class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg text-zinc-900 dark:text-white font-mono placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>

                              <Show when={createError()}>
                                <div class="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-600 dark:text-rose-400">
                                  {createError()}
                                </div>
                              </Show>

                              <div class="pt-2">
                                <button
                                  onClick={handleCreateDevice}
                                  disabled={actionLoading() || !newDeviceName().trim() || !newDeviceSlug().trim()}
                                  class="w-full px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25"
                                >
                                  {actionLoading() ? "Creating..." : "Create & Select Device"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </Show>
                      }>
                        {/* Device Preview with Tabs */}
                        <div class="h-full flex flex-col">
                          {/* Header with device info and clear button */}
                          <div class="flex items-center justify-between gap-3 mb-5">
                            <div class="flex items-center gap-3 min-w-0">
                              <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div class="min-w-0">
                                <h3 class="text-base font-semibold text-zinc-900 dark:text-white truncate leading-tight">
                                  {devicePreview()!.name}
                                </h3>
                                <p class="text-xs text-zinc-400 dark:text-slate-500 font-mono truncate">
                                  {devicePreview()!.slug}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={clearSelection}
                              class="p-1.5 text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-md transition-colors flex-shrink-0"
                              title="Clear selection"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* Subtle tab bar */}
                          <div class="flex items-center gap-1 mb-4 border-b border-zinc-200 dark:border-slate-800">
                            <button
                              onClick={() => setPreviewTab("widget")}
                              class={`relative px-3 py-2 text-sm font-medium transition-colors ${
                                previewTab() === "widget"
                                  ? "text-zinc-900 dark:text-white"
                                  : "text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300"
                              }`}
                            >
                              Widget
                              <Show when={previewTab() === "widget"}>
                                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                              </Show>
                            </button>
                            <button
                              onClick={() => setPreviewTab("device")}
                              class={`relative px-3 py-2 text-sm font-medium transition-colors ${
                                previewTab() === "device"
                                  ? "text-zinc-900 dark:text-white"
                                  : "text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300"
                              }`}
                            >
                              Details
                              <Show when={previewTab() === "device"}>
                                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                              </Show>
                            </button>
                            <button
                              onClick={() => setPreviewTab("prices")}
                              class={`relative px-3 py-2 text-sm font-medium transition-colors ${
                                previewTab() === "prices"
                                  ? "text-zinc-900 dark:text-white"
                                  : "text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300"
                              }`}
                            >
                              Prices
                              <Show when={detailedQuotes().length > 0}>
                                <span class="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-slate-800 text-zinc-500 dark:text-slate-400 rounded">
                                  {detailedQuotes().length}
                                </span>
                              </Show>
                              <Show when={previewTab() === "prices"}>
                                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                              </Show>
                            </button>
                          </div>

                          {/* Tab content */}
                          <div class="flex-1 overflow-y-auto">
                            <Show when={previewTab() === "device"}>
                              {/* Device details */}
                              <div class="space-y-4">
                                <div class="bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800 divide-y divide-zinc-100 dark:divide-slate-800">
                                  <div class="flex items-center justify-between px-3.5 py-2.5">
                                    <span class="text-xs font-medium text-zinc-400 dark:text-slate-500 uppercase tracking-wide">ID</span>
                                    <span class="text-sm font-mono text-zinc-700 dark:text-slate-300">{devicePreview()!.id}</span>
                                  </div>
                                  <div class="flex items-center justify-between px-3.5 py-2.5">
                                    <span class="text-xs font-medium text-zinc-400 dark:text-slate-500 uppercase tracking-wide">Slug</span>
                                    <span class="text-sm font-mono text-zinc-700 dark:text-slate-300">{devicePreview()!.slug}</span>
                                  </div>
                                  <Show when={devicePreview()!.brand}>
                                    <div class="flex items-center justify-between px-3.5 py-2.5">
                                      <span class="text-xs font-medium text-zinc-400 dark:text-slate-500 uppercase tracking-wide">Brand</span>
                                      <span class="text-sm text-zinc-700 dark:text-slate-300">{devicePreview()!.brand}</span>
                                    </div>
                                  </Show>
                                </div>

                                <div class="flex items-start gap-2.5 p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                                  <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                  <p class="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                                    Press <kbd class="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-[10px] font-mono font-semibold">Enter</kbd> or click Confirm to link this widget
                                  </p>
                                </div>
                              </div>
                            </Show>

                            <Show when={previewTab() === "widget"}>
                              {/* Widget preview & Price scraping */}
                              <div class="space-y-3">
                                {/* Compact toolbar */}
                                <div class="flex items-center justify-between">
                                  <div class="flex items-center gap-1.5">
                                    {/* Price.ru button */}
                                    <button
                                      onClick={handleScrapePriceRu}
                                      disabled={priceRuScraping()}
                                      title="Scrape from Price.ru (API)"
                                      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <Show when={priceRuScraping()} fallback={
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      }>
                                        <div class="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                      </Show>
                                      Price.ru
                                    </button>

                                    {/* Yandex dropdown or input */}
                                    <div class="relative group">
                                      <button
                                        disabled={yandexScraping()}
                                        title="Scrape from Yandex Market (requires URL)"
                                        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                      >
                                        <Show when={yandexScraping()} fallback={
                                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                          </svg>
                                        }>
                                          <div class="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                        </Show>
                                        Yandex
                                        <svg class="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                      {/* Dropdown panel */}
                                      <div class="absolute left-0 top-full mt-1 w-72 p-2 bg-white dark:bg-slate-800 rounded-lg border border-zinc-200 dark:border-slate-700 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                        {/* Catalogue link option */}
                                        <Show when={catalogueLinks()?.some(l => l.isYandexMarket && l.resolvedUrl)}>
                                          <div class="mb-2">
                                            <For each={catalogueLinks()!.filter(l => l.isYandexMarket && l.resolvedUrl)}>
                                              {(link) => {
                                                const formatCataloguePrice = (price?: number) => {
                                                  if (!price) return null;
                                                  return new Intl.NumberFormat("ru-RU", {
                                                    style: "currency",
                                                    currency: "RUB",
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 0,
                                                  }).format(price);
                                                };
                                                const formatRelativeDate = (dateStr?: string) => {
                                                  if (!dateStr) return null;
                                                  const date = new Date(dateStr);
                                                  const now = new Date();
                                                  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                                                  if (diffDays === 0) return "today";
                                                  if (diffDays === 1) return "1d ago";
                                                  if (diffDays < 7) return `${diffDays}d ago`;
                                                  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
                                                  return `${Math.floor(diffDays / 30)}mo ago`;
                                                };
                                                const priceStr = formatCataloguePrice(link.price);
                                                const dateStr = formatRelativeDate(link.updatedAt);
                                                return (
                                                  <button
                                                    onClick={() => {
                                                      setYandexUrl(link.resolvedUrl!);
                                                      handleScrapeYandex();
                                                    }}
                                                    disabled={yandexScraping()}
                                                    class="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-zinc-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                                  >
                                                    <svg class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                    </svg>
                                                    <div class="flex-1 min-w-0">
                                                      <div class="text-zinc-700 dark:text-slate-300">Use saved link</div>
                                                      <Show when={priceStr || dateStr}>
                                                        <div class="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-slate-500">
                                                          <Show when={priceStr}>
                                                            <span class="font-medium text-zinc-500 dark:text-slate-400">{priceStr}</span>
                                                          </Show>
                                                          <Show when={priceStr && dateStr}>
                                                            <span>·</span>
                                                          </Show>
                                                          <Show when={dateStr}>
                                                            <span>{dateStr}</span>
                                                          </Show>
                                                        </div>
                                                      </Show>
                                                    </div>
                                                  </button>
                                                );
                                              }}
                                            </For>
                                          </div>
                                          <div class="border-t border-zinc-100 dark:border-slate-700 my-2" />
                                        </Show>
                                        {/* Manual input label when catalogue links exist */}
                                        <Show when={catalogueLinks()?.some(l => l.isYandexMarket && l.resolvedUrl)}>
                                          <div class="text-[10px] text-zinc-400 dark:text-slate-500 mb-1">
                                            or enter URL manually:
                                          </div>
                                        </Show>
                                        <input
                                          type="text"
                                          placeholder="market.yandex.ru or kik.cat link..."
                                          value={yandexUrl()}
                                          onInput={(e) => setYandexUrl(e.currentTarget.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          class="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-md text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <button
                                          onClick={handleScrapeYandex}
                                          disabled={yandexScraping() || !yandexUrl().trim()}
                                          class="w-full mt-1.5 px-2.5 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                          {yandexScraping() ? "Scraping..." : "Scrape"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right side: price summary + mobile toggle + refresh */}
                                  <div class="flex items-center gap-2">
                                    <Show when={priceInfo()?.summary}>
                                      <span class="text-xs font-medium text-zinc-600 dark:text-slate-300">
                                        {formatPrice(priceInfo()!.summary!.minPrice / 100)}
                                      </span>
                                    </Show>
                                    {/* Mobile/Desktop toggle */}
                                    <button
                                      onClick={() => setMobilePreview(!mobilePreview())}
                                      title={mobilePreview() ? "Switch to desktop view" : "Switch to mobile view"}
                                      class={`p-1.5 rounded-md transition-colors ${
                                        mobilePreview()
                                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                                          : "text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800"
                                      }`}
                                    >
                                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => {
                                        const device = devicePreview();
                                        if (device) {
                                          setWidgetHtml(null);
                                          fetchWidgetPreview(device.slug, true);
                                          fetchPriceInfo(device.id);
                                        }
                                      }}
                                      disabled={widgetLoading() || priceLoading()}
                                      title="Refresh widget"
                                      class="p-1.5 text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-md disabled:opacity-50 transition-colors"
                                    >
                                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Status messages - inline compact */}
                                <Show when={scrapeError() || scrapeSuccess()}>
                                  <div class={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
                                    scrapeError() 
                                      ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400" 
                                      : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                  }`}>
                                    <Show when={scrapeError()} fallback={
                                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                      </svg>
                                    }>
                                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </Show>
                                    <span class="truncate">{scrapeError() || scrapeSuccess()}</span>
                                    <button 
                                      onClick={() => { setScrapeError(null); setScrapeSuccess(null); }}
                                      class="ml-auto p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded"
                                    >
                                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </Show>

                                {/* Widget Preview */}
                                <Show when={widgetLoading()}>
                                  <div class="flex items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800">
                                    <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                  </div>
                                </Show>

                                <Show when={!widgetLoading() && widgetHtml()}>
                                  <div class={`bg-slate-900 rounded-lg p-3 border border-slate-800 transition-all ${mobilePreview() ? "flex justify-center" : ""}`}>
                                    <div 
                                      class="widget-preview"
                                      style={mobilePreview() ? { width: "320px", "max-width": "100%" } : undefined}
                                      innerHTML={widgetHtml()!}
                                    />
                                  </div>
                                </Show>

                                <Show when={!widgetLoading() && !widgetHtml()}>
                                  <div class="flex flex-col items-center justify-center py-10 bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-slate-900 dark:to-slate-950 rounded-xl border border-zinc-200 dark:border-slate-800">
                                    <div class="w-14 h-14 rounded-2xl bg-zinc-200 dark:bg-slate-800 flex items-center justify-center mb-4">
                                      <svg class="w-7 h-7 text-zinc-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <p class="text-sm font-medium text-zinc-600 dark:text-slate-400 mb-1">
                                      No price data yet
                                    </p>
                                    <p class="text-xs text-zinc-400 dark:text-slate-500 mb-4">
                                      Use Price.ru or Yandex to add prices
                                    </p>
                                    <button
                                      onClick={() => {
                                        const device = devicePreview();
                                        if (device) {
                                          setWidgetHtml(null);
                                          setWidgetFetched(false);
                                          fetchWidgetPreview(device.slug, true);
                                          fetchPriceInfo(device.id);
                                        }
                                      }}
                                      disabled={widgetLoading() || priceLoading()}
                                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                                    >
                                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Refresh
                                    </button>
                                  </div>
                                </Show>
                              </div>
                            </Show>

                            <Show when={previewTab() === "prices"}>
                              {/* Prices breakdown by source */}
                              <div class="space-y-4">
                                <Show when={priceLoading()}>
                                  <div class="flex items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800">
                                    <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                  </div>
                                </Show>

                                <Show when={!priceLoading() && detailedQuotes().length === 0}>
                                  <div class="flex flex-col items-center justify-center py-12 bg-zinc-50 dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800">
                                    <svg class="w-8 h-8 text-zinc-300 dark:text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p class="text-xs text-zinc-400 dark:text-slate-500">
                                      No price quotes available
                                    </p>
                                  </div>
                                </Show>

                                <Show when={!priceLoading() && detailedQuotes().length > 0}>
                                  {(() => {
                                    const quotes = detailedQuotes();
                                    const yandexQuotes = quotes.filter(q => q.source === "yandex_market");
                                    const priceRuQuotes = quotes.filter(q => q.source === "price_ru");
                                    
                                    // Group price.ru by seller, get min price per seller
                                    const priceRuBySeller = new Map<string, typeof priceRuQuotes>();
                                    for (const q of priceRuQuotes) {
                                      const existing = priceRuBySeller.get(q.seller);
                                      if (existing) {
                                        existing.push(q);
                                      } else {
                                        priceRuBySeller.set(q.seller, [q]);
                                      }
                                    }
                                    
                                    // Sort sellers by min price
                                    const sortedSellers = [...priceRuBySeller.entries()]
                                      .map(([seller, quotes]) => ({
                                        seller,
                                        quotes: quotes.sort((a, b) => a.price - b.price),
                                        minPrice: Math.min(...quotes.map(q => q.price)),
                                      }))
                                      .sort((a, b) => a.minPrice - b.minPrice);

                                    const formatPriceRub = (minorUnits: number) => {
                                      const rubles = Math.round(minorUnits / 100);
                                      return rubles.toLocaleString("ru-RU") + " ₽";
                                    };

                                    const formatTime = (ts: number) => {
                                      const d = new Date(ts * 1000);
                                      return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                                    };

                                    return (
                                      <div class="space-y-4">
                                        {/* Yandex Market section */}
                                        <Show when={yandexQuotes.length > 0}>
                                          <div class="bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800 overflow-hidden">
                                            <div class="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30">
                                              <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-2">
                                                  <svg class="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                                  </svg>
                                                  <span class="text-sm font-semibold text-amber-800 dark:text-amber-300">Яндекс Маркет</span>
                                                </div>
                                                <span class="text-xs text-amber-600 dark:text-amber-400">
                                                  {yandexQuotes.length} {yandexQuotes.length === 1 ? "предложение" : "предложений"}
                                                </span>
                                              </div>
                                            </div>
                                            <div class="divide-y divide-zinc-100 dark:divide-slate-800">
                                              <For each={yandexQuotes.sort((a, b) => a.price - b.price)}>
                                                {(quote) => (
                                                  <div class="px-4 py-3 flex items-center justify-between gap-3">
                                                    <div class="flex-1 min-w-0">
                                                      <div class="flex items-center gap-2">
                                                        <span class="text-sm font-medium text-zinc-900 dark:text-white truncate">
                                                          {quote.seller}
                                                        </span>
                                                        <Show when={!quote.isAvailable}>
                                                          <span class="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-slate-800 text-zinc-500 rounded">
                                                            нет в наличии
                                                          </span>
                                                        </Show>
                                                      </div>
                                                      <Show when={quote.variantLabel}>
                                                        <p class="text-xs text-zinc-500 dark:text-slate-400 truncate mt-0.5">
                                                          {quote.variantLabel}
                                                        </p>
                                                      </Show>
                                                    </div>
                                                    <div class="text-right flex-shrink-0">
                                                      <div class="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums">
                                                        {formatPriceRub(quote.price)}
                                                      </div>
                                                      <div class="text-[10px] text-zinc-400 dark:text-slate-500">
                                                        {formatTime(quote.scrapedAt)}
                                                      </div>
                                                    </div>
                                                    <Show when={quote.url}>
                                                      <a
                                                        href={quote.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="p-1.5 text-zinc-400 hover:text-indigo-500 transition-colors"
                                                      >
                                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                      </a>
                                                    </Show>
                                                  </div>
                                                )}
                                              </For>
                                            </div>
                                          </div>
                                        </Show>

                                        {/* Price.ru section */}
                                        <Show when={sortedSellers.length > 0}>
                                          <div class="bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800 overflow-hidden">
                                            <div class="px-4 py-3 bg-cyan-50 dark:bg-cyan-900/20 border-b border-cyan-100 dark:border-cyan-900/30">
                                              <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-2">
                                                  <svg class="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                  </svg>
                                                  <span class="text-sm font-semibold text-cyan-800 dark:text-cyan-300">Price.ru</span>
                                                </div>
                                                <span class="text-xs text-cyan-600 dark:text-cyan-400">
                                                  {sortedSellers.length} {sortedSellers.length === 1 ? "магазин" : "магазинов"} · {priceRuQuotes.length} предложений
                                                </span>
                                              </div>
                                            </div>
                                            <div class="divide-y divide-zinc-100 dark:divide-slate-800">
                                              <For each={sortedSellers}>
                                                {(sellerGroup) => (
                                                  <div class="px-4 py-3">
                                                    <div class="flex items-center justify-between gap-3 mb-2">
                                                      <span class="text-sm font-semibold text-zinc-900 dark:text-white">
                                                        {sellerGroup.seller}
                                                      </span>
                                                      <span class="text-sm font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                                                        от {formatPriceRub(sellerGroup.minPrice)}
                                                      </span>
                                                    </div>
                                                    <div class="space-y-1.5">
                                                      <For each={sellerGroup.quotes.slice(0, 5)}>
                                                        {(quote) => (
                                                          <div class="flex items-center justify-between gap-2 pl-3 py-1 bg-zinc-50 dark:bg-slate-800/50 rounded text-xs">
                                                            <div class="flex items-center gap-2 min-w-0 flex-1">
                                                              <Show when={quote.variantLabel || quote.variantKey}>
                                                                <span class="text-zinc-600 dark:text-slate-400 truncate">
                                                                  {quote.variantLabel || quote.variantKey}
                                                                </span>
                                                              </Show>
                                                              <Show when={!quote.variantLabel && !quote.variantKey}>
                                                                <span class="text-zinc-400 dark:text-slate-500 italic">
                                                                  без варианта
                                                                </span>
                                                              </Show>
                                                              <Show when={!quote.isAvailable}>
                                                                <span class="px-1 py-0.5 text-[9px] font-medium bg-zinc-200 dark:bg-slate-700 text-zinc-500 dark:text-slate-400 rounded">
                                                                  нет
                                                                </span>
                                                              </Show>
                                                            </div>
                                                            <div class="flex items-center gap-2 flex-shrink-0">
                                                              <span class="font-medium text-zinc-700 dark:text-slate-300 tabular-nums">
                                                                {formatPriceRub(quote.price)}
                                                              </span>
                                                              <Show when={quote.url}>
                                                                <a
                                                                  href={quote.url}
                                                                  target="_blank"
                                                                  rel="noopener noreferrer"
                                                                  class="p-1 text-zinc-400 hover:text-indigo-500 transition-colors"
                                                                >
                                                                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                  </svg>
                                                                </a>
                                                              </Show>
                                                            </div>
                                                          </div>
                                                        )}
                                                      </For>
                                                      <Show when={sellerGroup.quotes.length > 5}>
                                                        <div class="text-[10px] text-zinc-400 dark:text-slate-500 pl-3">
                                                          + ещё {sellerGroup.quotes.length - 5} вариантов
                                                        </div>
                                                      </Show>
                                                    </div>
                                                  </div>
                                                )}
                                              </For>
                                            </div>
                                          </div>
                                        </Show>
                                      </div>
                                    );
                                  })()}
                                </Show>
                              </div>
                            </Show>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
