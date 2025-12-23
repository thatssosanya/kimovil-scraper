import { createMemo, Show, For } from "solid-js";
import type { DeviceLink } from "./PricesTab";
import type { PriceOffer } from "../../types";

interface PricesSellerPivotProps {
  quotes: PriceOffer[];
  links: DeviceLink[];
}

interface PivotCell {
  price: number;
  isAvailable: boolean;
  url?: string;
  isRowLowest: boolean;
  isColLowest: boolean;
  isGlobalLowest: boolean;
}

function formatPrice(kopeks: number): string {
  return `₽${(kopeks / 100).toLocaleString("ru-RU")}`;
}

export function PricesSellerPivot(props: PricesSellerPivotProps) {
  const pivotData = createMemo(() => {
    const sellers = [...new Set(props.quotes.map(q => q.seller))].sort();
    const variants = [...new Set(props.quotes.map(q => q.variantKey || "default"))].sort();
    
    const matrix: Record<string, Record<string, PriceOffer | null>> = {};
    for (const seller of sellers) {
      matrix[seller] = {};
      for (const variant of variants) {
        matrix[seller][variant] = null;
      }
    }
    
    for (const quote of props.quotes) {
      const variant = quote.variantKey || "default";
      const existing = matrix[quote.seller][variant];
      if (!existing || quote.price < existing.price) {
        matrix[quote.seller][variant] = quote;
      }
    }
    
    const globalMin = Math.min(...props.quotes.filter(q => q.isAvailable !== false).map(q => q.price));
    
    const rowMins: Record<string, number> = {};
    for (const seller of sellers) {
      const sellerQuotes = props.quotes.filter(q => q.seller === seller && q.isAvailable !== false);
      if (sellerQuotes.length > 0) {
        rowMins[seller] = Math.min(...sellerQuotes.map(q => q.price));
      }
    }
    
    const colMins: Record<string, number> = {};
    for (const variant of variants) {
      const variantQuotes = props.quotes.filter(q => (q.variantKey || "default") === variant && q.isAvailable !== false);
      if (variantQuotes.length > 0) {
        colMins[variant] = Math.min(...variantQuotes.map(q => q.price));
      }
    }
    
    return { sellers, variants, matrix, globalMin, rowMins, colMins };
  });
  
  const getCellData = (seller: string, variant: string): PivotCell | null => {
    const quote = pivotData().matrix[seller][variant];
    if (!quote) return null;
    
    const { globalMin, rowMins, colMins } = pivotData();
    const isAvailable = quote.isAvailable !== false;
    
    return {
      price: quote.price,
      isAvailable,
      url: quote.url,
      isRowLowest: isAvailable && quote.price === rowMins[seller],
      isColLowest: isAvailable && quote.price === colMins[variant],
      isGlobalLowest: isAvailable && quote.price === globalMin,
    };
  };
  
  const variantLabels = createMemo(() => {
    const labels: Record<string, string> = {};
    for (const quote of props.quotes) {
      const key = quote.variantKey || "default";
      if (quote.variantLabel && !labels[key]) {
        labels[key] = quote.variantLabel;
      }
    }
    return labels;
  });
  
  return (
    <div class="h-full overflow-auto custom-scrollbar p-6">
      <div class="min-w-max">
        {/* Table */}
        <div class="relative rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/20">
          <table class="w-full border-collapse">
            {/* Header */}
            <thead>
              <tr>
                <th class="sticky left-0 z-20 bg-slate-900 p-0">
                  <div class="p-4 border-b border-r border-slate-700/50 text-left">
                    <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Seller</span>
                  </div>
                </th>
                <For each={pivotData().variants}>
                  {(variant) => (
                    <th class="p-0 bg-slate-900/80 backdrop-blur-sm">
                      <div class="p-4 border-b border-slate-700/50 text-center min-w-[140px]">
                        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
                          <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                          <span class="font-mono text-sm text-slate-300">
                            {variant === "default" ? "Standard" : variant}
                          </span>
                        </div>
                        <Show when={variantLabels()[variant] && variant !== "default"}>
                          <div class="text-xs text-slate-500 mt-1">{variantLabels()[variant]}</div>
                        </Show>
                      </div>
                    </th>
                  )}
                </For>
              </tr>
            </thead>
            
            {/* Body */}
            <tbody>
              <For each={pivotData().sellers}>
                {(seller, sellerIndex) => (
                  <tr class="group">
                    {/* Seller name cell */}
                    <td class="sticky left-0 z-10 bg-slate-900 p-0">
                      <div class={`
                        p-4 border-r border-slate-700/50 
                        ${sellerIndex() < pivotData().sellers.length - 1 ? "border-b border-b-slate-800/50" : ""}
                      `}>
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center text-xs font-bold text-slate-400">
                            {seller.charAt(0).toUpperCase()}
                          </div>
                          <span class="font-medium text-slate-200">{seller}</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* Price cells */}
                    <For each={pivotData().variants}>
                      {(variant) => {
                        const cell = getCellData(seller, variant);
                        const isLast = () => sellerIndex() === pivotData().sellers.length - 1;
                        
                        return (
                          <td class="p-0">
                            <div class={`
                              p-3 text-center transition-colors duration-150
                              ${!isLast() ? "border-b border-slate-800/50" : ""}
                              ${cell ? "group-hover:bg-slate-800/30" : ""}
                            `}>
                              <Show when={cell} fallback={
                                <div class="flex items-center justify-center h-12">
                                  <span class="text-slate-700">—</span>
                                </div>
                              }>
                                {(c) => {
                                  const cellData = c();
                                  return (
                                    <div class={`
                                      relative inline-flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all duration-200
                                      ${cellData.isGlobalLowest 
                                        ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/40" 
                                        : cellData.isRowLowest || cellData.isColLowest
                                          ? "bg-amber-500/10 ring-1 ring-amber-500/20"
                                          : "hover:bg-slate-700/30"}
                                      ${!cellData.isAvailable ? "opacity-40" : ""}
                                    `}>
                                      {/* Global lowest crown */}
                                      <Show when={cellData.isGlobalLowest}>
                                        <div class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                          <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                          </svg>
                                        </div>
                                      </Show>
                                      
                                      <span class={`
                                        font-mono font-semibold text-base
                                        ${cellData.isGlobalLowest ? "text-emerald-400" : "text-white"}
                                      `}>
                                        {formatPrice(cellData.price)}
                                      </span>
                                      
                                      {/* Availability indicator */}
                                      <Show when={!cellData.isAvailable}>
                                        <span class="text-[10px] uppercase tracking-wide text-slate-500">Out of stock</span>
                                      </Show>
                                      
                                      {/* Best in row/col badges */}
                                      <Show when={cellData.isAvailable && (cellData.isRowLowest || cellData.isColLowest) && !cellData.isGlobalLowest}>
                                        <div class="flex items-center gap-1 mt-0.5">
                                          <Show when={cellData.isRowLowest}>
                                            <span class="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-amber-500/20 text-amber-400">
                                              ↓ row
                                            </span>
                                          </Show>
                                          <Show when={cellData.isColLowest}>
                                            <span class="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-amber-500/20 text-amber-400">
                                              ↓ col
                                            </span>
                                          </Show>
                                        </div>
                                      </Show>
                                    </div>
                                  );
                                }}
                              </Show>
                            </div>
                          </td>
                        );
                      }}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div class="flex items-center justify-center gap-6 mt-6 text-xs text-slate-500">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/40 flex items-center justify-center">
              <svg class="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <span>Best price overall</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-amber-500/10 ring-1 ring-amber-500/20" />
            <span>Best in row/column</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-600">—</span>
            <span>Not available</span>
          </div>
        </div>
      </div>
    </div>
  );
}
