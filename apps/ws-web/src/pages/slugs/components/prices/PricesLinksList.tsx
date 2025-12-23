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
  return `₽${(kopeks / 100).toLocaleString("ru-RU")}`;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function StatusDot(props: { status: DeviceLink["status"] }) {
  const config = {
    active: { color: "bg-emerald-400", pulse: true },
    stale: { color: "bg-amber-400", pulse: false },
    error: { color: "bg-rose-400", pulse: false },
  };
  const c = () => config[props.status];
  
  return (
    <div class="relative">
      <div class={`w-2 h-2 rounded-full ${c().color}`} />
      <Show when={c().pulse}>
        <div class={`absolute inset-0 w-2 h-2 rounded-full ${c().color} animate-ping opacity-75`} />
      </Show>
    </div>
  );
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
              return (
                <button
                  onClick={() => props.onSelectLink(link.externalId)}
                  class={`
                    w-full text-left p-4 border-b border-slate-800/30 transition-all duration-200 cursor-pointer
                    ${isSelected() 
                      ? "bg-gradient-to-r from-amber-500/10 to-transparent border-l-2 border-l-amber-400" 
                      : "hover:bg-slate-800/30 border-l-2 border-l-transparent"}
                  `}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      {/* Variant badge */}
                      <Show when={link.variantKey}>
                        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-700/50 text-xs font-mono text-slate-300 mb-2">
                          <svg class="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                          {link.variantKey}
                        </div>
                      </Show>
                      
                      {/* Price range or "No quotes" */}
                      <Show when={link.quoteCount > 0}>
                        <div class="flex items-baseline gap-1.5">
                          <span class="text-lg font-mono font-medium text-white">
                            {formatPrice(link.minPrice)}
                          </span>
                          <Show when={link.minPrice !== link.maxPrice}>
                            <span class="text-slate-600">–</span>
                            <span class="text-sm font-mono text-slate-400">
                              {formatPrice(link.maxPrice)}
                            </span>
                          </Show>
                        </div>
                      </Show>
                      <Show when={link.quoteCount === 0}>
                        <div class="text-sm text-slate-500 italic">
                          No quotes yet
                        </div>
                      </Show>

                      {/* Meta info */}
                      <div class="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <Show when={link.quoteCount > 0}>
                          <span>{link.quoteCount} offers</span>
                          <span>•</span>
                        </Show>
                        <span>{formatTimeAgo(link.lastScraped)}</span>
                      </div>
                    </div>
                    
                    <StatusDot status={link.status} />
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
          
          {/* Quotes table or empty state for no quotes */}
          <div class="flex-1 overflow-y-auto custom-scrollbar p-6">
            <Show when={props.quotes.length > 0}>
              <div class="space-y-2">
                <For each={props.quotes}>
                  {(quote, index) => {
                    const isLowest = () =>
                      index() === 0 ||
                      props.quotes.slice(0, index()).every((q) => q.price >= quote.price);

                    return (
                      <div
                        class={`
                          group relative flex items-center justify-between p-4 rounded-xl transition-all duration-200
                          ${
                            quote.isAvailable !== false
                              ? "bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/50"
                              : "bg-slate-800/20 border border-slate-800/50 opacity-60"
                          }
                          ${isLowest() && quote.isAvailable !== false ? "ring-1 ring-emerald-500/30" : ""}
                        `}
                      >
                        {/* Lowest price indicator */}
                        <Show when={isLowest() && quote.isAvailable !== false}>
                          <div class="absolute -left-px top-3 bottom-3 w-0.5 bg-gradient-to-b from-emerald-400 to-emerald-500 rounded-full" />
                        </Show>

                        <div class="flex items-center gap-4">
                          {/* Availability indicator */}
                          <div
                            class={`
                            w-2 h-2 rounded-full flex-shrink-0
                            ${quote.isAvailable !== false ? "bg-emerald-400" : "bg-slate-600"}
                          `}
                          />

                          {/* Seller info */}
                          <div>
                            <div class="font-medium text-slate-200">{quote.seller}</div>
                            <Show when={quote.variantLabel}>
                              <div class="text-xs text-slate-500 mt-0.5">{quote.variantLabel}</div>
                            </Show>
                          </div>
                        </div>

                        <div class="flex items-center gap-4">
                          {/* Price */}
                          <div class="text-right">
                            <div
                              class={`
                              font-mono font-semibold text-lg
                              ${isLowest() && quote.isAvailable !== false ? "text-emerald-400" : "text-white"}
                            `}
                            >
                              {formatPrice(quote.price)}
                            </div>
                            <Show when={isLowest() && quote.isAvailable !== false}>
                              <div class="text-xs text-emerald-500/70 font-medium">Lowest</div>
                            </Show>
                          </div>

                          {/* Action button */}
                          <Show when={quote.url}>
                            <a
                              href={quote.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
                            >
                              <svg
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                />
                              </svg>
                            </a>
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>
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
