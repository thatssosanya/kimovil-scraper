import { createSignal, createMemo, Show } from "solid-js";
import { PricesLinksList } from "./PricesLinksList";
import { PricesSellerPivot } from "./PricesSellerPivot";
import { PricesEmptyState } from "./PricesEmptyState";
import type { PriceOffer, DeviceSource } from "../../types";

export interface DeviceLink {
  externalId: string;
  url: string;
  source: string;
  variantKey?: string;
  variantLabel?: string;
  minPrice: number;
  maxPrice: number;
  quoteCount: number;
  lastQuoteAt: number | null;
  status: "active" | "stale" | "not_found" | "error";
  searchedQuery?: string;
  searchedAt?: number;
}

interface PricesTabProps {
  slug: string;
  quotes: PriceOffer[];
  deviceSources: DeviceSource[];
  loading: boolean;
  error: string | null;
  onLink: (url: string) => Promise<void>;
  onScrape: (linkId?: string) => Promise<void>;
  onRefreshQuotes: () => Promise<void>;
  scraping: boolean;
  scrapeProgress: number;
  hasPriceRuLink?: boolean;
  onLinkPriceRu?: () => Promise<void>;
  onGetPriceRuPrices?: () => Promise<void>;
}

type ViewMode = "links" | "sellers";

function deriveLinks(
  quotes: PriceOffer[],
  deviceSources: DeviceSource[],
): DeviceLink[] {
  const linkMap = new Map<string, DeviceLink>();

  for (const source of deviceSources) {
    if (source.source !== "yandex_market" && source.source !== "price_ru") continue;

    const key = `${source.source}:${source.externalId}`;
    linkMap.set(key, {
      externalId: source.externalId,
      url: source.url || "",
      source: source.source,
      variantKey: undefined,
      variantLabel: undefined,
      minPrice: 0,
      maxPrice: 0,
      quoteCount: 0,
      lastQuoteAt: null,
      status: source.status === "active" ? "active" 
            : source.status === "not_found" ? "not_found"
            : "stale",
      searchedQuery: source.metadata?.searched ?? source.metadata?.query ?? undefined,
      searchedAt: source.metadata?.at ?? source.metadata?.linked_at ?? undefined,
    });
  }

  for (const quote of quotes) {
    const externalId = quote.externalId || quote.url || "default";
    const quoteSource = quote.source || "yandex_market";
    const key = `${quoteSource}:${externalId}`;

    if (linkMap.has(key)) {
      const link = linkMap.get(key)!;
      const quoteTime = quote.scrapedAt * 1000;
      if (link.quoteCount === 0) {
        link.minPrice = quote.price;
        link.maxPrice = quote.price;
        link.lastQuoteAt = quoteTime;
      } else {
        link.minPrice = Math.min(link.minPrice, quote.price);
        link.maxPrice = Math.max(link.maxPrice, quote.price);
        if (quoteTime > (link.lastQuoteAt || 0)) {
          link.lastQuoteAt = quoteTime;
        }
      }
      link.quoteCount++;
      if (quote.variantLabel) {
        link.variantLabel = quote.variantLabel;
        link.variantKey = quote.variantKey;
      }
    } else {
      linkMap.set(key, {
        externalId,
        url: quote.url || "",
        source: quoteSource,
        variantKey: quote.variantKey,
        variantLabel: quote.variantLabel,
        minPrice: quote.price,
        maxPrice: quote.price,
        quoteCount: 1,
        lastQuoteAt: quote.scrapedAt * 1000,
        status: "active",
      });
    }
  }

  return Array.from(linkMap.values());
}

export function PricesTab(props: PricesTabProps) {
  const [viewMode, setViewMode] = createSignal<ViewMode>("links");
  const [selectedLinkId, setSelectedLinkId] = createSignal<string | null>(null);

  const links = createMemo(() => {
    return deriveLinks(props.quotes, props.deviceSources);
  });

  const selectedLink = createMemo(() => {
    const id = selectedLinkId();
    if (!id) return links()[0] || null;
    return links().find((l) => l.externalId === id) || null;
  });

  const quotesForSelectedLink = createMemo(() => {
    const link = selectedLink();
    if (!link) return [];
    
    // For price_ru with anchor links, show all quotes for that source
    // (price.ru search returns offers with various modelIds as externalIds)
    if (link.source === "price_ru" && link.externalId.startsWith("device:")) {
      return props.quotes.filter((q) => q.source === "price_ru");
    }
    
    return props.quotes.filter(
      (q) => (q.externalId || q.url || "default") === link.externalId,
    );
  });

  const hasData = () =>
    props.quotes.length > 0 || props.deviceSources.length > 0;
  
  const priceStats = createMemo(() => {
    const available = props.quotes.filter(q => q.isAvailable !== false);
    if (available.length === 0) return null;
    return {
      min: Math.min(...available.map(q => q.price)),
      max: Math.max(...available.map(q => q.price)),
      availableCount: available.length,
      unavailableCount: props.quotes.length - available.length,
    };
  });
  
  return (
    <div class="absolute inset-0 flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Ambient glow */}
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/5 blur-[100px] pointer-events-none" />
      
      <Show when={props.loading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="relative">
            <div class="w-12 h-12 rounded-full border-2 border-amber-500/20" />
            <div class="absolute inset-0 w-12 h-12 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <div class="absolute inset-2 w-8 h-8 rounded-full border border-amber-500/30 border-b-transparent animate-spin animation-delay-150" style={{ "animation-direction": "reverse" }} />
          </div>
        </div>
      </Show>
      
      <Show when={!props.loading}>
        {/* Error banner */}
        <Show when={props.error}>
          <div class="mx-6 mt-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-sm">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-rose-300">Operation failed</div>
                <div class="text-xs text-rose-400/70 truncate">{props.error}</div>
              </div>
            </div>
          </div>
        </Show>
        
        {/* Empty state */}
        <Show when={!hasData()}>
          <PricesEmptyState 
            onLink={props.onLink}
            linking={props.scraping}
            progress={props.scrapeProgress}
            onLinkPriceRu={props.onLinkPriceRu}
          />
        </Show>
        
        {/* Data views */}
        <Show when={hasData()}>
          {/* View toggle + summary bar */}
          <div class="flex-shrink-0 px-6 py-4 border-b border-slate-800/50">
            <div class="flex items-center justify-between">
              {/* Summary stats */}
              <div class="flex items-center gap-6">
                <Show 
                  when={priceStats()}
                  fallback={
                    <div class="flex flex-col gap-0.5">
                      {(() => {
                        const activeLinks = links().filter(l => l.status === "active");
                        const notFoundLinks = links().filter(l => l.status === "not_found");
                        
                        if (activeLinks.length > 0 && props.quotes.length === 0) {
                          return (
                            <div class="flex items-center gap-2 text-slate-400">
                              <span>{activeLinks.length} link{activeLinks.length !== 1 ? "s" : ""} · Refresh to get prices</span>
                            </div>
                          );
                        }
                        
                        if (notFoundLinks.length > 0 && activeLinks.length === 0) {
                          const nf = notFoundLinks[0];
                          const dateStr = nf.searchedAt 
                            ? new Date(nf.searchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : null;
                          return (
                            <div class="flex items-center gap-2 text-amber-500/80">
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <span>
                                Searched {nf.searchedQuery ? `"${nf.searchedQuery}"` : nf.source}
                                {dateStr ? ` on ${dateStr}` : ""} — no results
                              </span>
                            </div>
                          );
                        }
                        
                        return (
                          <div class="flex items-center gap-2 text-slate-400">
                            <span>{links().length} link{links().length !== 1 ? "s" : ""} · No prices yet</span>
                          </div>
                        );
                      })()}
                    </div>
                  }
                >
                  {(stats) => (
                    <>
                      <div class="flex items-baseline gap-2">
                        <span class="text-2xl font-medium text-white">
                          {(stats().min / 100).toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 })}
                        </span>
                        <Show when={stats().min !== stats().max}>
                          <span class="text-slate-500">–</span>
                          <span class="text-lg text-slate-400">
                            {(stats().max / 100).toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 })}
                          </span>
                        </Show>
                      </div>
                      <div class="h-6 w-px bg-slate-700/50" />
                      <div class="text-sm text-slate-500">
                        {props.quotes.length} quotes · {stats().availableCount} in stock
                      </div>
                    </>
                  )}
                </Show>
              </div>
              
              {/* price.ru actions */}
              <Show when={props.onLinkPriceRu || props.onGetPriceRuPrices}>
                <div class="flex items-center gap-2">
                  <Show when={!props.hasPriceRuLink && props.onLinkPriceRu}>
                    <button
                      onClick={props.onLinkPriceRu}
                      disabled={props.scraping}
                      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Link price.ru
                    </button>
                  </Show>
                  <Show when={props.hasPriceRuLink && props.onGetPriceRuPrices}>
                    <button
                      onClick={props.onGetPriceRuPrices}
                      disabled={props.scraping}
                      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Refresh price.ru
                    </button>
                  </Show>
                </div>
              </Show>

              {/* View toggle */}
              <div class="flex items-center gap-1 p-1 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <button
                  onClick={() => setViewMode("links")}
                  class={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                    ${viewMode() === "links" 
                      ? "bg-gradient-to-b from-amber-400 to-amber-500 text-slate-900 shadow-lg shadow-amber-500/25" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"}
                  `}
                >
                  <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    By Link
                  </span>
                </button>
                <button
                  onClick={() => setViewMode("sellers")}
                  class={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                    ${viewMode() === "sellers" 
                      ? "bg-gradient-to-b from-amber-400 to-amber-500 text-slate-900 shadow-lg shadow-amber-500/25" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"}
                  `}
                >
                  <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                    By Seller
                  </span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Views */}
          <div class="flex-1 overflow-hidden">
            <Show when={viewMode() === "links"}>
              <PricesLinksList
                links={links()}
                selectedLink={selectedLink()}
                quotes={quotesForSelectedLink()}
                onSelectLink={setSelectedLinkId}
                onScrape={props.onScrape}
                onAddLink={props.onLink}
                scraping={props.scraping}
                scrapeProgress={props.scrapeProgress}
              />
            </Show>
            
            <Show when={viewMode() === "sellers"}>
              <PricesSellerPivot
                quotes={props.quotes}
                links={links()}
              />
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
