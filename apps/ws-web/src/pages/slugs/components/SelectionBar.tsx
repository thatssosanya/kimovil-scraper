import { Show } from "solid-js";

interface SelectionBarProps {
  selectedCount: number;
  scrapedCount: number;
  unscrapedCount: number;
  needsExtractionCount: number;
  needsAiCount: number;
  hasRawCount: number;
  hasAiCount: number;
  bulkLoading: boolean;
  verifyLoading: boolean;
  clearLoading: boolean;
  clearRawLoading: boolean;
  clearAiLoading: boolean;
  onQueueScrape: () => void;
  onQueueExtract: () => void;
  onQueueAi: () => void;
  onVerify: () => void;
  onClear: () => void;
  onClearRaw: () => void;
  onClearAi: () => void;
  onCancel: () => void;
}

export function SelectionBar(props: SelectionBarProps) {
  return (
    <Show when={props.selectedCount > 0}>
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-5xl px-4 animate-in slide-in-from-bottom-4 duration-300">
        <div class="bg-slate-800/95 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Selection info */}
            <div class="flex items-center gap-3">
              <div class="bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                {props.selectedCount}
              </div>
              <div class="text-sm">
                <span class="text-white font-medium">Selected</span>
                <div class="text-[10px] text-slate-400 flex flex-wrap gap-x-2">
                  <Show when={props.unscrapedCount > 0}>
                    <span class="text-slate-500">{props.unscrapedCount} no HTML</span>
                  </Show>
                  <Show when={props.needsExtractionCount > 0}>
                    <span class="text-cyan-400">{props.needsExtractionCount} need extract</span>
                  </Show>
                  <Show when={props.needsAiCount > 0}>
                    <span class="text-violet-400">{props.needsAiCount} need AI</span>
                  </Show>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div class="flex flex-wrap items-center gap-2 justify-center">
              {/* Scrape */}
              <Show when={props.unscrapedCount > 0}>
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={props.onQueueScrape}
                  disabled={props.bulkLoading}
                  title="Scrape HTML for selected devices"
                >
                  Scrape ({props.unscrapedCount})
                </button>
              </Show>

              {/* Extract */}
              <Show when={props.needsExtractionCount > 0}>
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={props.onQueueExtract}
                  disabled={props.bulkLoading}
                  title="Extract raw data from HTML"
                >
                  Extract ({props.needsExtractionCount})
                </button>
              </Show>

              {/* AI Process */}
              <Show when={props.needsAiCount > 0}>
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={props.onQueueAi}
                  disabled={props.bulkLoading}
                  title="Process with AI"
                >
                  AI ({props.needsAiCount})
                </button>
              </Show>

              {/* Verify & Clear */}
              <Show when={props.scrapedCount > 0}>
                <div class="w-px h-6 bg-slate-600 mx-1" />
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={props.onVerify}
                  disabled={props.verifyLoading}
                >
                  Verify ({props.scrapedCount})
                </button>
                <button
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                  onClick={props.onClear}
                  disabled={props.clearLoading}
                >
                  Clear ({props.scrapedCount})
                </button>
              </Show>

              {/* Clear Raw/AI Data */}
              <Show when={props.hasRawCount > 0 || props.hasAiCount > 0}>
                <div class="w-px h-6 bg-slate-600 mx-1" />
                <Show when={props.hasRawCount > 0}>
                  <button
                    class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-cyan-700/80 hover:bg-cyan-600 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 ring-1 ring-cyan-500/30"
                    onClick={props.onClearRaw}
                    disabled={props.clearRawLoading}
                    title="Clear raw extracted data"
                  >
                    {props.clearRawLoading ? (
                      <span class="flex items-center gap-1.5">
                        <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Clearing...
                      </span>
                    ) : (
                      <>Clear Raw ({props.hasRawCount})</>
                    )}
                  </button>
                </Show>
                <Show when={props.hasAiCount > 0}>
                  <button
                    class="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-violet-700/80 hover:bg-violet-600 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 ring-1 ring-violet-500/30"
                    onClick={props.onClearAi}
                    disabled={props.clearAiLoading}
                    title="Clear AI processed data"
                  >
                    {props.clearAiLoading ? (
                      <span class="flex items-center gap-1.5">
                        <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Clearing...
                      </span>
                    ) : (
                      <>Clear AI ({props.hasAiCount})</>
                    )}
                  </button>
                </Show>
              </Show>

              {/* Cancel */}
              <div class="w-px h-6 bg-slate-600 mx-1" />
              <button
                class="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                onClick={props.onCancel}
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
