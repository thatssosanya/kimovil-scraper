import { Show, createMemo } from "solid-js";
import { useSelection, useRowData, useActions } from "../context/devices-table.context";

interface SelectionBarProps {
  bulkLoading: boolean;
  onQueueScrape: () => void;
  onQueueExtract: () => void;
  onQueueAi: () => void;
  onQueueLinkPriceRu: () => void;
  onQueuePriceRuPrices: () => void;
}

export function SelectionBar(props: SelectionBarProps) {
  const selection = useSelection();
  const rowData = useRowData();
  const actions = useActions();

  const selectedSlugs = () => selection.selectedSlugs();
  const selectedCount = () => selection.selectedCount();
  const scrapeStatus = () => rowData.scrapeStatus();

  const unscrapedCount = createMemo(() => {
    const status = scrapeStatus();
    let count = 0;
    for (const slug of selectedSlugs()) {
      if (!status[slug]?.hasHtml) count++;
    }
    return count;
  });

  const scrapedCount = createMemo(() => {
    const status = scrapeStatus();
    let count = 0;
    for (const slug of selectedSlugs()) {
      if (status[slug]?.hasHtml) count++;
    }
    return count;
  });

  const needsExtractionCount = createMemo(() => {
    const status = scrapeStatus();
    let count = 0;
    for (const slug of selectedSlugs()) {
      const s = status[slug];
      if (s?.hasHtml && !s?.hasRawData) count++;
    }
    return count;
  });

  const needsAiCount = createMemo(() => {
    const status = scrapeStatus();
    let count = 0;
    for (const slug of selectedSlugs()) {
      const s = status[slug];
      if (s?.hasRawData && !s?.hasAiData) count++;
    }
    return count;
  });

  const hasRawCount = createMemo(() => {
    const status = scrapeStatus();
    let count = 0;
    for (const slug of selectedSlugs()) {
      if (status[slug]?.hasRawData) count++;
    }
    return count;
  });

  const hasAiCount = createMemo(() => {
    const status = scrapeStatus();
    let count = 0;
    for (const slug of selectedSlugs()) {
      if (status[slug]?.hasAiData) count++;
    }
    return count;
  });

  const notLinkedToPriceRuCount = createMemo(() => {
    const status = scrapeStatus();
    let count = 0;
    for (const slug of selectedSlugs()) {
      if (!status[slug]?.hasPriceRuLink) count++;
    }
    return count;
  });

  const linkedToPriceRuCount = createMemo(() => {
    const status = scrapeStatus();
    let count = 0;
    for (const slug of selectedSlugs()) {
      if (status[slug]?.hasPriceRuLink) count++;
    }
    return count;
  });

  const handleVerify = async () => {
    await actions.verifyBulk(selectedSlugs());
  };

  const handleClear = async () => {
    const cleared = await actions.clearBulk(selectedSlugs());
    if (cleared) selection.clearSelection();
  };

  const handleClearRaw = async () => {
    const status = scrapeStatus();
    const slugsToClear = selectedSlugs().filter((slug) => status[slug]?.hasRawData);
    if (slugsToClear.length === 0) return;
    if (!confirm(`Clear raw data for ${slugsToClear.length} items?`)) return;
    await actions.clearRawBulk(slugsToClear);
  };

  const handleClearAi = async () => {
    const status = scrapeStatus();
    const slugsToClear = selectedSlugs().filter((slug) => status[slug]?.hasAiData);
    if (slugsToClear.length === 0) return;
    if (!confirm(`Clear AI data for ${slugsToClear.length} items?`)) return;
    await actions.clearAiBulk(slugsToClear);
  };

  return (
    <Show when={selectedCount() > 0}>
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-5xl px-4 animate-in slide-in-from-bottom-4 duration-300">
        <div class="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-zinc-200 dark:border-slate-700 p-4 rounded-2xl shadow-2xl">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Selection info */}
            <div class="flex items-center gap-3">
              <div class="bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                {selectedCount()}
              </div>
              <div class="text-sm">
                <span class="text-zinc-900 dark:text-white font-medium">Selected</span>
                <div class="text-[10px] text-zinc-500 dark:text-slate-400 flex flex-wrap gap-x-2">
                  <Show when={unscrapedCount() > 0}>
                    <span class="text-zinc-400 dark:text-slate-500">{unscrapedCount()} no HTML</span>
                  </Show>
                  <Show when={needsExtractionCount() > 0}>
                    <span class="text-cyan-500 dark:text-cyan-400">{needsExtractionCount()} need extract</span>
                  </Show>
                  <Show when={needsAiCount() > 0}>
                    <span class="text-violet-500 dark:text-violet-400">{needsAiCount()} need AI</span>
                  </Show>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div class="flex flex-wrap items-center gap-2 justify-center">
              {/* Scrape */}
              <Show when={unscrapedCount() > 0}>
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={props.onQueueScrape}
                  disabled={props.bulkLoading}
                  title="Scrape HTML for selected devices"
                >
                  Scrape ({unscrapedCount()})
                </button>
              </Show>

              {/* Extract */}
              <Show when={needsExtractionCount() > 0}>
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={props.onQueueExtract}
                  disabled={props.bulkLoading}
                  title="Extract raw data from HTML"
                >
                  Extract ({needsExtractionCount()})
                </button>
              </Show>

              {/* AI Process */}
              <Show when={needsAiCount() > 0}>
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={props.onQueueAi}
                  disabled={props.bulkLoading}
                  title="Process with AI"
                >
                  AI ({needsAiCount()})
                </button>
              </Show>

              {/* price.ru operations */}
              <Show when={notLinkedToPriceRuCount() > 0 || linkedToPriceRuCount() > 0}>
                <div class="w-px h-6 bg-zinc-300 dark:bg-slate-600 mx-1" />
                <Show when={notLinkedToPriceRuCount() > 0}>
                  <button
                    class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    onClick={props.onQueueLinkPriceRu}
                    disabled={props.bulkLoading}
                    title="Find matching offers on price.ru"
                  >
                    Link price.ru ({notLinkedToPriceRuCount()})
                  </button>
                </Show>
                <Show when={linkedToPriceRuCount() > 0}>
                  <button
                    class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    onClick={props.onQueuePriceRuPrices}
                    disabled={props.bulkLoading}
                    title="Fetch prices from price.ru"
                  >
                    Get prices ({linkedToPriceRuCount()})
                  </button>
                </Show>
              </Show>

              {/* Verify & Clear */}
              <Show when={scrapedCount() > 0}>
                <div class="w-px h-6 bg-zinc-300 dark:bg-slate-600 mx-1" />
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={handleVerify}
                  disabled={actions.verifyLoading()}
                >
                  Verify ({scrapedCount()})
                </button>
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={handleClear}
                  disabled={actions.clearLoading()}
                >
                  Clear ({scrapedCount()})
                </button>
              </Show>

              {/* Clear Raw/AI Data */}
              <Show when={hasRawCount() > 0 || hasAiCount() > 0}>
                <div class="w-px h-6 bg-zinc-300 dark:bg-slate-600 mx-1" />
                <Show when={hasRawCount() > 0}>
                  <button
                    class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-cyan-700/80 hover:bg-cyan-600 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 ring-1 ring-cyan-500/30"
                    onClick={handleClearRaw}
                    disabled={actions.clearRawLoading()}
                    title="Clear raw extracted data"
                  >
                    {actions.clearRawLoading() ? (
                      <span class="flex items-center gap-1.5">
                        <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Clearing...
                      </span>
                    ) : (
                      <>Clear Raw ({hasRawCount()})</>
                    )}
                  </button>
                </Show>
                <Show when={hasAiCount() > 0}>
                  <button
                    class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-violet-700/80 hover:bg-violet-600 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 ring-1 ring-violet-500/30"
                    onClick={handleClearAi}
                    disabled={actions.clearAiLoading()}
                    title="Clear AI processed data"
                  >
                    {actions.clearAiLoading() ? (
                      <span class="flex items-center gap-1.5">
                        <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Clearing...
                      </span>
                    ) : (
                      <>Clear AI ({hasAiCount()})</>
                    )}
                  </button>
                </Show>
              </Show>

              {/* Cancel */}
              <div class="w-px h-6 bg-zinc-300 dark:bg-slate-600 mx-1" />
              <button
                class="cursor-pointer px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => selection.clearSelection()}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
