import { createSignal, Show, For } from "solid-js";
import type { DeviceLink } from "./PricesTab";
import type { PriceOffer } from "../../types";

interface PricesLinksListProps {
  links: DeviceLink[];
  selectedLink: DeviceLink | null;
  quotes: PriceOffer[];
  onSelectLink: (id: string) => void;
  onScrape: (linkId?: string) => Promise<void>;
  onAddLink: (url: string) => Promise<void>;
  scraping: boolean;
  scrapeProgress: number;
}

function formatPrice(kopeks: number): string {
  return (kopeks / 100).toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}



function SourceIcon(props: { source: string }) {
  const icons: Record<string, () => any> = {
    yandex_market: () => (
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    ),
  };
  const Icon = icons[props.source] || icons.yandex_market;
  return <Icon />;
}

export function PricesLinksList(props: PricesLinksListProps) {
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [newUrl, setNewUrl] = createSignal("");
  const [adding, setAdding] = createSignal(false);
  
  const handleAdd = async () => {
    if (!newUrl().trim()) return;
    setAdding(true);
    try {
      await props.onAddLink(newUrl());
      setNewUrl("");
      setShowAddForm(false);
    } finally {
      setAdding(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  return (
    <div class="h-full flex">
      {/* Left panel - Links list */}
      <div class="w-[340px] flex-shrink-0 border-r border-slate-800/50 flex flex-col bg-slate-900/50">
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <For each={props.links}>
            {(link) => {
              const isSelected = () => props.selectedLink?.externalId === link.externalId;
              const hasQuotes = () => link.quoteCount > 0;
              
              return (
                <button
                  onClick={() => props.onSelectLink(link.externalId)}
                  class={`
                    group w-full text-left px-3 py-2.5 transition-all duration-150 cursor-pointer relative
                    ${isSelected() 
                      ? "bg-slate-800/80" 
                      : "hover:bg-slate-800/40"}
                  `}
                >
                  {/* Selection indicator */}
                  <div class={`
                    absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r transition-all duration-150
                    ${isSelected() ? "bg-slate-400" : "bg-transparent"}
                  `} />
                  
                  <div class="flex items-center gap-3">
                    {/* Source icon */}
                    <div class={`
                      w-7 h-7 rounded flex items-center justify-center flex-shrink-0 transition-colors
                      ${isSelected() ? "bg-slate-700 text-slate-300" : "bg-slate-800/60 text-slate-500"}
                    `}>
                      <SourceIcon source={link.source} />
                    </div>
                    
                    {/* Content */}
                    <div class="flex-1 min-w-0">
                      {/* Price row */}
                      <div class="flex items-baseline gap-2">
                        <Show when={hasQuotes()}>
                          <span class="text-sm font-medium text-slate-100">
                            {formatPrice(link.minPrice)}
                          </span>
                          <Show when={link.minPrice !== link.maxPrice}>
                            <span class="text-xs text-slate-500">
                              – {formatPrice(link.maxPrice)}
                            </span>
                          </Show>
                        </Show>
                        <Show when={!hasQuotes()}>
                          <span class="text-sm text-slate-500">No prices</span>
                        </Show>
                      </div>
                      
                      {/* Meta row */}
                      <div class="text-[11px] text-slate-500 mt-0.5 truncate" title={link.url}>
                        {hasQuotes() ? `${link.quoteCount} offers` : "Not scraped"}
                        <Show when={link.lastQuoteAt}>
                          <span class="text-slate-600"> · {formatTimeAgo(link.lastQuoteAt!)}</span>
                        </Show>
                      </div>
                    </div>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
        
        {/* Add link button/form */}
        <div class="flex-shrink-0 p-4 border-t border-slate-800/50 bg-slate-900/80">
          <Show when={!showAddForm()}>
            <button
              onClick={() => setShowAddForm(true)}
              class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all duration-200 cursor-pointer"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Market Link
            </button>
          </Show>
          
          <Show when={showAddForm()}>
            <div class="space-y-3">
              <input
                type="url"
                placeholder="https://market.yandex.ru/..."
                value={newUrl()}
                onInput={(e) => setNewUrl(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-sm"
                autofocus
              />
              <div class="flex gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  class="flex-1 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newUrl().trim() || adding()}
                  class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 text-slate-900 font-medium hover:from-amber-300 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Show when={adding()}>
                    <div class="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  </Show>
                  <Show when={!adding()}>Add</Show>
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
      
      {/* Right panel - Link details */}
      <div class="flex-1 flex flex-col overflow-hidden">
        <Show when={props.selectedLink}>
          {/* Link header */}
          <div class="flex-shrink-0 px-6 py-4 border-b border-slate-800/50 bg-slate-900/30">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-mono text-slate-300 truncate max-w-[400px]">
                      {props.selectedLink!.url}
                    </span>
                    <button
                      onClick={() => copyToClipboard(props.selectedLink!.url)}
                      class="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      title="Copy URL"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    </button>
                    <a
                      href={props.selectedLink!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                      title="Open in new tab"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                  <Show when={props.selectedLink!.variantLabel}>
                    <div class="text-xs text-slate-500 mt-1">{props.selectedLink!.variantLabel}</div>
                  </Show>
                </div>
              </div>
              
              <button
                onClick={() => props.onScrape(props.selectedLink!.externalId)}
                disabled={props.scraping}
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Show when={props.scraping}>
                  <div class="relative w-4 h-4">
                    <svg class="w-4 h-4 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <span class="font-mono text-sm">{props.scrapeProgress}%</span>
                </Show>
                <Show when={!props.scraping}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span class="text-sm">Refresh</span>
                </Show>
              </button>
            </div>
          </div>
          
          {/* Quotes list */}
          <div class="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
            <Show when={props.quotes.length > 0}>
              {/* Table header */}
              <div class="flex items-center gap-3 px-3 py-2 text-[11px] text-slate-500 uppercase tracking-wide border-b border-slate-800/50 mb-1">
                <div class="w-4" />
                <div class="flex-1">Seller</div>
                <div class="w-16 text-right">Price</div>
                <div class="w-14 text-right">Updated</div>
                <div class="w-6" />
              </div>
              
              <div class="space-y-0.5">
                <For each={props.quotes}>
                  {(quote, index) => {
                    const isLowest = () =>
                      index() === 0 ||
                      props.quotes.slice(0, index()).every((q) => q.price >= quote.price);
                    const isAvailable = () => quote.isAvailable !== false;

                    return (
                      <div
                        class={`
                          group flex items-center gap-3 px-3 py-2 rounded transition-colors
                          ${isAvailable() ? "hover:bg-slate-800/40" : "opacity-40"}
                        `}
                      >
                        {/* Stock indicator */}
                        <div class="w-4 flex justify-center">
                          <Show when={isAvailable()}>
                            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </Show>
                          <Show when={!isAvailable()}>
                            <svg class="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </Show>
                        </div>

                        {/* Seller name */}
                        <div class="flex-1 min-w-0">
                          <span class={`text-sm truncate ${isAvailable() ? "text-slate-200" : "text-slate-500"}`}>
                            {quote.seller}
                          </span>
                        </div>

                        {/* Price */}
                        <div class={`w-16 text-right text-sm font-medium ${isLowest() && isAvailable() ? "text-slate-100" : "text-slate-300"}`}>
                          {formatPrice(quote.price)}
                        </div>
                        
                        {/* Scraped time */}
                        <div class="w-14 text-right text-[11px] text-slate-600">
                          {formatTimeAgo(quote.scrapedAt * 1000)}
                        </div>
                        
                        {/* External link */}
                        <div class="w-6 flex justify-center">
                          <Show when={quote.url}>
                            <a
                              href={quote.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-slate-300 transition-opacity"
                              title="Open seller page"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                              </svg>
                            </a>
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
              
              {/* Footer summary */}
              <div class="mt-3 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-500">
                <span>{props.quotes.filter(q => q.isAvailable !== false).length} of {props.quotes.length} in stock</span>
                <span>Last update: {formatTimeAgo(Math.max(...props.quotes.map(q => q.scrapedAt)) * 1000)}</span>
              </div>
            </Show>

            {/* Empty state for linked but no quotes */}
            <Show when={props.quotes.length === 0}>
              <div class="flex flex-col items-center justify-center h-full text-center">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
                  <svg
                    class="w-8 h-8 text-slate-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                    />
                  </svg>
                </div>
                <div class="text-slate-400 mb-2">No price quotes yet</div>
                <div class="text-sm text-slate-500 mb-4">
                  Click the Refresh button above to scrape prices
                </div>
                <button
                  onClick={() => props.onScrape(props.selectedLink?.externalId)}
                  disabled={props.scraping}
                  class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 text-slate-900 font-medium hover:from-amber-300 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <Show when={props.scraping}>
                    <div class="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Scraping... {props.scrapeProgress}%</span>
                  </Show>
                  <Show when={!props.scraping}>
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>Scrape Prices</span>
                  </Show>
                </button>
              </div>
            </Show>
          </div>
        </Show>
        
        {/* No selection state */}
        <Show when={!props.selectedLink}>
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <div class="w-16 h-16 mx-auto rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <div class="text-slate-500">Select a link to view offers</div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
