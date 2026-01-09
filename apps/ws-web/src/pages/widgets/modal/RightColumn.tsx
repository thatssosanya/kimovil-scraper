import { Show, For } from "solid-js";
import { useMappingModal } from "./MappingModalContext";

export function RightColumn() {
  const ctx = useMappingModal();

  return (
    <div class="flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-slate-900/50">
      <div class="flex-1 overflow-y-auto p-6">
        <Show when={ctx.devicePreview()} fallback={
          <Show when={ctx.suggestions().length === 0 && ctx.newDeviceDefaults()} fallback={
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
            <CreateDeviceForm />
          </Show>
        }>
          <DevicePreviewContent />
        </Show>
      </div>
    </div>
  );
}

function CreateDeviceForm() {
  const ctx = useMappingModal();
  
  return (
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
            value={ctx.newDeviceBrand()}
            onInput={(e) => ctx.setNewDeviceBrand(e.currentTarget.value)}
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
            value={ctx.newDeviceName()}
            onInput={(e) => ctx.setNewDeviceName(e.currentTarget.value)}
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
            value={ctx.newDeviceSlug()}
            onInput={(e) => ctx.setNewDeviceSlug(e.currentTarget.value)}
            placeholder="e.g. galaxy-s25-ultra"
            class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg text-zinc-900 dark:text-white font-mono placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <Show when={ctx.createError()}>
          <div class="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-600 dark:text-rose-400">
            {ctx.createError()}
          </div>
        </Show>

        <div class="pt-2">
          <button
            onClick={ctx.handleCreateDevice}
            disabled={ctx.actionLoading() || !ctx.newDeviceName().trim() || !ctx.newDeviceSlug().trim()}
            class="w-full px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25"
          >
            {ctx.actionLoading() ? "Creating..." : "Create & Select Device"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DevicePreviewContent() {
  const ctx = useMappingModal();

  return (
    <div class="h-full flex flex-col">
      <div class="flex items-center justify-between gap-3 mb-5">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-zinc-900 dark:text-white truncate leading-tight">
              {ctx.devicePreview()!.name}
            </h3>
            <p class="text-xs text-zinc-400 dark:text-slate-500 font-mono truncate">
              {ctx.devicePreview()!.slug}
            </p>
          </div>
        </div>
        <button
          onClick={ctx.clearSelection}
          class="p-1.5 text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-md transition-colors flex-shrink-0"
          title="Clear selection"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex items-center gap-1 mb-4 border-b border-zinc-200 dark:border-slate-800">
        <button
          onClick={() => ctx.setPreviewTab("widget")}
          class={`relative px-3 py-2 text-sm font-medium transition-colors ${
            ctx.previewTab() === "widget"
              ? "text-zinc-900 dark:text-white"
              : "text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300"
          }`}
        >
          Widget
          <Show when={ctx.previewTab() === "widget"}>
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          </Show>
        </button>
        <button
          onClick={() => ctx.setPreviewTab("device")}
          class={`relative px-3 py-2 text-sm font-medium transition-colors ${
            ctx.previewTab() === "device"
              ? "text-zinc-900 dark:text-white"
              : "text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300"
          }`}
        >
          Details
          <Show when={ctx.previewTab() === "device"}>
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          </Show>
        </button>
        <button
          onClick={() => ctx.setPreviewTab("prices")}
          class={`relative px-3 py-2 text-sm font-medium transition-colors ${
            ctx.previewTab() === "prices"
              ? "text-zinc-900 dark:text-white"
              : "text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300"
          }`}
        >
          Prices
          <Show when={ctx.detailedQuotes().length > 0}>
            <span class="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-slate-800 text-zinc-500 dark:text-slate-400 rounded">
              {ctx.detailedQuotes().length}
            </span>
          </Show>
          <Show when={ctx.previewTab() === "prices"}>
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          </Show>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={ctx.previewTab() === "device"}>
          <DeviceDetailsPanel />
        </Show>
        <Show when={ctx.previewTab() === "widget"}>
          <WidgetPreviewPanel />
        </Show>
        <Show when={ctx.previewTab() === "prices"}>
          <PricesPanel />
        </Show>
      </div>
    </div>
  );
}

function DeviceDetailsPanel() {
  const ctx = useMappingModal();
  
  return (
    <div class="space-y-4">
      <div class="bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800 divide-y divide-zinc-100 dark:divide-slate-800">
        <div class="flex items-center justify-between px-3.5 py-2.5">
          <span class="text-xs font-medium text-zinc-400 dark:text-slate-500 uppercase tracking-wide">ID</span>
          <span class="text-sm font-mono text-zinc-700 dark:text-slate-300">{ctx.devicePreview()!.id}</span>
        </div>
        <div class="flex items-center justify-between px-3.5 py-2.5">
          <span class="text-xs font-medium text-zinc-400 dark:text-slate-500 uppercase tracking-wide">Slug</span>
          <span class="text-sm font-mono text-zinc-700 dark:text-slate-300">{ctx.devicePreview()!.slug}</span>
        </div>
        <Show when={ctx.devicePreview()!.brand}>
          <div class="flex items-center justify-between px-3.5 py-2.5">
            <span class="text-xs font-medium text-zinc-400 dark:text-slate-500 uppercase tracking-wide">Brand</span>
            <span class="text-sm text-zinc-700 dark:text-slate-300">{ctx.devicePreview()!.brand}</span>
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
  );
}

function WidgetPreviewPanel() {
  const ctx = useMappingModal();

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
  
  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <button
            onClick={ctx.handleScrapePriceRu}
            disabled={ctx.priceRuScraping()}
            title="Scrape from Price.ru (API)"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Show when={ctx.priceRuScraping()} fallback={
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }>
              <div class="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            </Show>
            Price.ru
          </button>

          <div class="relative group">
            <button
              disabled={ctx.yandexScraping()}
              title="Scrape from Yandex Market (requires URL)"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-600 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Show when={ctx.yandexScraping()} fallback={
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
            <div class="absolute left-0 top-full mt-1 w-72 p-2 bg-white dark:bg-slate-800 rounded-lg border border-zinc-200 dark:border-slate-700 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <Show when={ctx.catalogueLinks()?.some(l => l.isYandexMarket && l.resolvedUrl)}>
                <div class="mb-2">
                  <For each={ctx.catalogueLinks()!.filter(l => l.isYandexMarket && l.resolvedUrl)}>
                    {(link) => {
                      const priceStr = formatCataloguePrice(link.price);
                      const dateStr = formatRelativeDate(link.updatedAt);
                      return (
                        <button
                          onClick={() => {
                            ctx.setYandexUrl(link.resolvedUrl!);
                            ctx.handleScrapeYandex();
                          }}
                          disabled={ctx.yandexScraping()}
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
              <Show when={ctx.catalogueLinks()?.some(l => l.isYandexMarket && l.resolvedUrl)}>
                <div class="text-[10px] text-zinc-400 dark:text-slate-500 mb-1">
                  or enter URL manually:
                </div>
              </Show>
              <input
                type="text"
                placeholder="market.yandex.ru or kik.cat link..."
                value={ctx.yandexUrl()}
                onInput={(e) => ctx.setYandexUrl(e.currentTarget.value)}
                onClick={(e) => e.stopPropagation()}
                class="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-md text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={ctx.handleScrapeYandex}
                disabled={ctx.yandexScraping() || !ctx.yandexUrl().trim()}
                class="w-full mt-1.5 px-2.5 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {ctx.yandexScraping() ? "Scraping..." : "Scrape"}
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Show when={ctx.priceInfo()?.summary}>
            <span class="text-xs font-medium text-zinc-600 dark:text-slate-300">
              {ctx.formatPrice(ctx.priceInfo()!.summary!.minPrice / 100)}
            </span>
          </Show>
          <button
            onClick={() => ctx.setMobilePreview(!ctx.mobilePreview())}
            title={ctx.mobilePreview() ? "Switch to desktop view" : "Switch to mobile view"}
            class={`p-1.5 rounded-md transition-colors ${
              ctx.mobilePreview()
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
              const device = ctx.devicePreview();
              if (device) {
                ctx.fetchWidgetPreview(device.slug, true);
              }
            }}
            disabled={ctx.widgetLoading() || ctx.priceLoading()}
            title="Refresh widget"
            class="p-1.5 text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-md disabled:opacity-50 transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <Show when={ctx.scrapeError() || ctx.scrapeSuccess()}>
        <div class={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
          ctx.scrapeError() 
            ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400" 
            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
        }`}>
          <Show when={ctx.scrapeError()} fallback={
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          }>
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Show>
          <span class="truncate">{ctx.scrapeError() || ctx.scrapeSuccess()}</span>
          <button 
            onClick={ctx.clearScrapeMessages}
            class="ml-auto p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded"
          >
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Show>

      <Show when={ctx.widgetLoading()}>
        <div class="flex items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800">
          <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={!ctx.widgetLoading() && ctx.widgetHtml()}>
        <div class={`bg-slate-900 rounded-lg p-3 border border-slate-800 transition-all ${ctx.mobilePreview() ? "flex justify-center" : ""}`}>
          <div 
            class="widget-preview"
            style={ctx.mobilePreview() ? { width: "320px", "max-width": "100%" } : undefined}
            innerHTML={ctx.widgetHtml()!}
          />
        </div>
      </Show>

      <Show when={!ctx.widgetLoading() && !ctx.widgetHtml()}>
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
              const device = ctx.devicePreview();
              if (device) {
                ctx.fetchWidgetPreview(device.slug, true);
              }
            }}
            disabled={ctx.widgetLoading() || ctx.priceLoading()}
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
  );
}

function PricesPanel() {
  const ctx = useMappingModal();

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
      <Show when={ctx.priceLoading()}>
        <div class="flex items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800">
          <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={!ctx.priceLoading() && ctx.detailedQuotes().length === 0}>
        <div class="flex flex-col items-center justify-center py-12 bg-zinc-50 dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800">
          <svg class="w-8 h-8 text-zinc-300 dark:text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-xs text-zinc-400 dark:text-slate-500">
            No price quotes available
          </p>
        </div>
      </Show>

      <Show when={!ctx.priceLoading() && ctx.detailedQuotes().length > 0}>
        {(() => {
          const quotes = ctx.detailedQuotes();
          const yandexQuotes = quotes.filter(q => q.source === "yandex_market");
          const priceRuQuotes = quotes.filter(q => q.source === "price_ru");
          
          const priceRuBySeller = new Map<string, typeof priceRuQuotes>();
          for (const q of priceRuQuotes) {
            const existing = priceRuBySeller.get(q.seller);
            if (existing) {
              existing.push(q);
            } else {
              priceRuBySeller.set(q.seller, [q]);
            }
          }
          
          const sortedSellers = [...priceRuBySeller.entries()]
            .map(([seller, quotes]) => ({
              seller,
              quotes: quotes.sort((a, b) => a.price - b.price),
              minPrice: Math.min(...quotes.map(q => q.price)),
            }))
            .sort((a, b) => a.minPrice - b.minPrice);

          return (
            <div class="space-y-4">
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
  );
}
