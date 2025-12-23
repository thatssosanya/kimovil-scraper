import { createSignal, createMemo, Show } from "solid-js";
import { PricesLinksList } from "./PricesLinksList";
import { PricesSellerPivot } from "./PricesSellerPivot";
import { PricesEmptyState } from "./PricesEmptyState";
import type { PriceSummary, PriceOffer, DeviceSource } from "../../types";

export interface DeviceLink {
  externalId: string;
  url: string;
  variantKey?: string;
  variantLabel?: string;
  minPrice: number;
  maxPrice: number;
  quoteCount: number;
  lastScraped: number;
  status: "active" | "stale" | "error";
}

interface PricesTabProps {
  slug: string;
  prices: PriceSummary | null;
  deviceSources: DeviceSource[];
  loading: boolean;
  error: string | null;
  onLink: (url: string) => Promise<void>;
  onScrape: (linkId?: string) => Promise<void>;
  scraping: boolean;
  scrapeProgress: number;
}

type ViewMode = "links" | "sellers";

function deriveLinks(
  quotes: PriceOffer[],
  deviceSources: DeviceSource[],
): DeviceLink[] {
  const linkMap = new Map<string, DeviceLink>();

  for (const source of deviceSources) {
    if (source.source !== "yandex_market") continue;

    linkMap.set(source.externalId, {
      externalId: source.externalId,
      url: source.url || "",
      variantKey: undefined,
      variantLabel: undefined,
      minPrice: 0,
      maxPrice: 0,
      quoteCount: 0,
      lastScraped: source.lastSeen * 1000,
      status: source.status === "active" ? "active" : "stale",
    });
  }

  for (const quote of quotes) {
    const externalId = quote.externalId || quote.url || "default";

    if (linkMap.has(externalId)) {
      const link = linkMap.get(externalId)!;
      if (link.quoteCount === 0) {
        link.minPrice = quote.price;
        link.maxPrice = quote.price;
      } else {
        link.minPrice = Math.min(link.minPrice, quote.price);
        link.maxPrice = Math.max(link.maxPrice, quote.price);
      }
      link.quoteCount++;
      if (quote.variantLabel) {
        link.variantLabel = quote.variantLabel;
        link.variantKey = quote.variantKey;
      }
    } else {
      linkMap.set(externalId, {
        externalId,
        url: quote.url || "",
        variantKey: quote.variantKey,
        variantLabel: quote.variantLabel,
        minPrice: quote.price,
        maxPrice: quote.price,
        quoteCount: 1,
        lastScraped: Date.now(),
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
    return deriveLinks(props.prices?.quotes || [], props.deviceSources);
  });

  const selectedLink = createMemo(() => {
    const id = selectedLinkId();
    if (!id) return links()[0] || null;
    return links().find((l) => l.externalId === id) || null;
  });

  const quotesForSelectedLink = createMemo(() => {
    const link = selectedLink();
    if (!link || !props.prices?.quotes) return [];
    return props.prices.quotes.filter(
      (q) => (q.externalId || q.url || "default") === link.externalId,
    );
  });

  const hasData = () =>
    (props.prices && props.prices.quotes.length > 0) ||
    props.deviceSources.length > 0;
  
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
          />
        </Show>
        
        {/* Data views */}
        <Show when={hasData()}>
          {/* View toggle + summary bar */}
          <div class="flex-shrink-0 px-6 py-4 border-b border-slate-800/50">
            <div class="flex items-center justify-between">
              {/* Summary stats */}
              <div class="flex items-center gap-6">
                <div class="flex items-baseline gap-2">
                  <span class="text-3xl font-light tracking-tight text-white font-mono">
                    ₽{(props.prices!.minPrice / 100).toLocaleString("ru-RU")}
                  </span>
                  <span class="text-slate-500">–</span>
                  <span class="text-xl text-slate-400 font-mono">
                    ₽{(props.prices!.maxPrice / 100).toLocaleString("ru-RU")}
                  </span>
                </div>
                <div class="h-8 w-px bg-slate-700/50" />
                <div class="flex items-center gap-4 text-sm">
                  <div class="flex items-center gap-1.5">
                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span class="text-slate-400">{props.prices!.quotes.filter(q => q.isAvailable !== false).length} available</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span class="text-slate-500">{props.prices!.quotes.filter(q => q.isAvailable === false).length} out of stock</span>
                  </div>
                </div>
              </div>
              
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
                quotes={props.prices!.quotes}
                links={links()}
              />
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
