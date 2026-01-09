import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import type {
  WidgetMapping,
  SuggestedMatch,
  PostInfo,
  DevicePreview,
  NewDeviceDefaults,
  DeviceSearchResult,
  PreviewTab,
  PriceInfo,
  DetailedQuote,
  CatalogueLink,
} from "../WidgetDebug.types";
import * as api from "../../../api/widgetMappings";
import { MappingModalContext, type MappingModalContextValue } from "./MappingModalContext";
import { MappingModalHeader } from "./MappingModalHeader";
import { LeftColumn } from "./LeftColumn";
import { RightColumn } from "./RightColumn";

interface MappingModalProps {
  mapping: WidgetMapping | null;
  onClose: () => void;
  onMappingUpdated: () => void;
}

export function MappingModal(props: MappingModalProps) {
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

  const [newDeviceBrand, setNewDeviceBrand] = createSignal("");
  const [newDeviceName, setNewDeviceName] = createSignal("");
  const [newDeviceSlug, setNewDeviceSlug] = createSignal("");
  const [createError, setCreateError] = createSignal<string | null>(null);

  const [previewTab, setPreviewTab] = createSignal<PreviewTab>("widget");
  const [widgetHtml, setWidgetHtml] = createSignal<string | null>(null);
  const [widgetFetched, setWidgetFetched] = createSignal(false);
  const [widgetLoading, setWidgetLoading] = createSignal(false);
  const [mobilePreview, setMobilePreview] = createSignal(false);

  const [priceInfo, setPriceInfo] = createSignal<PriceInfo | null>(null);
  const [priceLoading, setPriceLoading] = createSignal(false);
  const [detailedQuotes, setDetailedQuotes] = createSignal<DetailedQuote[]>([]);
  const [priceRuScraping, setPriceRuScraping] = createSignal(false);
  const [yandexScraping, setYandexScraping] = createSignal(false);
  const [yandexUrl, setYandexUrl] = createSignal("");
  const [scrapeError, setScrapeError] = createSignal<string | null>(null);
  const [scrapeSuccess, setScrapeSuccess] = createSignal<string | null>(null);
  const [catalogueLinks, setCatalogueLinks] = createSignal<CatalogueLink[] | null>(null);

  let searchTimeout: ReturnType<typeof setTimeout>;

  onCleanup(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
  });

  const formatDate = (ts: number | null) => {
    if (ts == null) return "Never";
    const d = new Date(ts * 1000);
    return d.toLocaleString();
  };

  const formatPrice = (price?: number) => {
    if (price == null) return "—";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const loadMappingContext = async (mapping: WidgetMapping) => {
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
    setWidgetFetched(false);
    setPriceInfo(null);
    setYandexUrl("");
    setScrapeError(null);
    setScrapeSuccess(null);
    setCatalogueLinks(null);

    try {
      const data = await api.getMappingContext(mapping.rawModel);
      setSuggestions(data.suggestions);
      setPosts(data.posts);
      setDevicePreview(data.devicePreview);
      setNewDeviceDefaults(data.newDeviceDefaults ?? null);

      if (data.newDeviceDefaults) {
        setNewDeviceBrand(data.newDeviceDefaults.brand ?? "");
        setNewDeviceName(data.newDeviceDefaults.modelName);
        setNewDeviceSlug(data.newDeviceDefaults.suggestedSlug);
      } else {
        setNewDeviceBrand("");
        setNewDeviceName("");
        setNewDeviceSlug("");
      }
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
    props.onClose();
  };

  const handleConfirm = async () => {
    const mapping = props.mapping;
    if (!mapping || !selectedDeviceId()) return;

    setActionLoading(true);
    try {
      await api.updateMapping(mapping.rawModel, {
        deviceId: selectedDeviceId(),
        status: "confirmed",
      });
      props.onMappingUpdated();
      closeModal();
    } catch (e) {
      console.error("Failed to confirm:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleIgnore = async () => {
    const mapping = props.mapping;
    if (!mapping) return;

    setActionLoading(true);
    try {
      await api.updateMapping(mapping.rawModel, { status: "ignored" });
      props.onMappingUpdated();
      closeModal();
    } catch (e) {
      console.error("Failed to ignore:", e);
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
    setWidgetHtml(null);
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
    setWidgetHtml(null);
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

  const fetchPriceInfo = async (deviceId: string) => {
    setPriceLoading(true);
    try {
      const data = await api.getPriceInfo(deviceId);
      setPriceInfo(data);
      const quotes = (data as PriceInfo & { quotes?: DetailedQuote[] }).quotes ?? [];
      setDetailedQuotes(quotes);
      const yandexLink = data.linkedSources?.find((s) => s.source === "yandex_market");
      if (yandexLink?.url) {
        setYandexUrl(yandexLink.url);
      }
    } catch (e) {
      console.error("Failed to fetch price info:", e);
      setDetailedQuotes([]);
    } finally {
      setPriceLoading(false);
    }
  };

  const fetchCatalogueLinks = async (slug: string) => {
    try {
      const links = await api.getCatalogueLinks(slug);
      setCatalogueLinks(links);
    } catch {
      setCatalogueLinks([]);
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

  const clearScrapeMessages = () => {
    setScrapeError(null);
    setScrapeSuccess(null);
  };

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

  // Load mapping context when mapping changes
  createEffect(() => {
    const mapping = props.mapping;
    if (mapping) {
      loadMappingContext(mapping);
    }
  });

  // Fetch widget when tab changes to widget and we have a device
  createEffect(() => {
    const tab = previewTab();
    const device = devicePreview();
    if (tab === "widget" && device && !widgetHtml() && !widgetLoading() && !widgetFetched()) {
      fetchWidgetPreview(device.slug);
    }
  });

  // Fetch price info when widget tab is opened
  createEffect(() => {
    const tab = previewTab();
    const device = devicePreview();
    if ((tab === "widget" || tab === "prices") && device && !priceInfo() && !priceLoading()) {
      fetchPriceInfo(device.id);
    }
  });

  // Fetch catalogue links when device is selected
  createEffect(() => {
    const device = devicePreview();
    if (device) {
      fetchCatalogueLinks(device.slug);
    } else {
      setCatalogueLinks(null);
    }
  });

  // Keyboard shortcuts
  createEffect(() => {
    const mapping = props.mapping;
    if (!mapping) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (actionLoading() || modalLoading()) return;

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

  const contextValue: MappingModalContextValue = {
    mapping: () => props.mapping,
    suggestions,
    posts,
    selectedDeviceId,
    setSelectedDeviceId,
    devicePreview,
    setDevicePreview,
    deviceSearch,
    setDeviceSearch,
    searchResults,
    searchLoading,
    handleDeviceSearch,
    newDeviceDefaults,
    newDeviceBrand,
    setNewDeviceBrand,
    newDeviceName,
    setNewDeviceName,
    newDeviceSlug,
    setNewDeviceSlug,
    createError,
    handleCreateDevice,
    previewTab,
    setPreviewTab,
    widgetHtml,
    widgetLoading,
    mobilePreview,
    setMobilePreview,
    fetchWidgetPreview,
    priceInfo,
    priceLoading,
    detailedQuotes,
    catalogueLinks,
    yandexUrl,
    setYandexUrl,
    scrapeError,
    scrapeSuccess,
    priceRuScraping,
    yandexScraping,
    handleScrapePriceRu,
    handleScrapeYandex,
    clearScrapeMessages,
    actionLoading,
    modalLoading,
    handleConfirm,
    handleIgnore,
    closeModal,
    selectSuggestion,
    selectSearchResult,
    clearSelection,
    formatDate,
    formatPrice,
  };

  return (
    <Show when={props.mapping}>
      <MappingModalContext.Provider value={contextValue}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8">
          <div class="w-full h-full max-w-[95vw] max-h-[90vh] flex flex-col bg-zinc-100 dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden">
            <MappingModalHeader />

            <div class="flex-1 overflow-hidden">
              <Show when={modalLoading()}>
                <div class="flex items-center justify-center h-full gap-3">
                  <div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span class="text-zinc-500 dark:text-slate-400">Loading...</span>
                </div>
              </Show>

              <Show when={!modalLoading()}>
                <div class="h-full grid grid-cols-1 lg:grid-cols-2 gap-0 max-w-screen-2xl mx-auto">
                  <LeftColumn />
                  <RightColumn />
                </div>
              </Show>
            </div>
          </div>
        </div>
      </MappingModalContext.Provider>
    </Show>
  );
}
