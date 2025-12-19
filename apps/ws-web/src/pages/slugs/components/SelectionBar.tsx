import { Show } from "solid-js";

interface SelectionBarProps {
  selectedCount: number;
  scrapedCount: number;
  unscrapedCount: number;
  bulkLoading: boolean;
  verifyLoading: boolean;
  clearLoading: boolean;
  onQueueBulk: () => void;
  onVerify: () => void;
  onClear: () => void;
  onCancel: () => void;
}

export function SelectionBar(props: SelectionBarProps) {
  return (
    <Show when={props.selectedCount > 0}>
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4 animate-in slide-in-from-bottom-4 duration-300">
        <div class="bg-slate-800/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
              {props.selectedCount}
            </div>
            <div class="text-sm">
              <span class="text-white font-medium">Selected Devices</span>
              <div class="text-xs text-slate-400 flex gap-2">
                <Show when={props.scrapedCount > 0}>
                  <span>{props.scrapedCount} scraped</span>
                </Show>
                <Show when={props.unscrapedCount > 0}>
                  <span>{props.unscrapedCount} unscraped</span>
                </Show>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 justify-center">
            <Show when={props.unscrapedCount > 0}>
              <button
                class="cursor-pointer px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50"
                onClick={props.onQueueBulk}
                disabled={props.bulkLoading}
              >
                Queue Fast ({props.unscrapedCount})
              </button>
            </Show>
            <Show when={props.scrapedCount > 0}>
              <button
                class="cursor-pointer px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-lg shadow-amber-900/20 transition-all active:scale-95 disabled:opacity-50"
                onClick={props.onVerify}
                disabled={props.verifyLoading}
              >
                Verify ({props.scrapedCount})
              </button>
              <button
                class="cursor-pointer px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-lg shadow-rose-900/20 transition-all active:scale-95 disabled:opacity-50"
                onClick={props.onClear}
                disabled={props.clearLoading}
              >
                Clear Data ({props.scrapedCount})
              </button>
            </Show>
            <div class="w-px h-8 bg-slate-700 mx-1"></div>
            <button
              class="cursor-pointer px-3 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
              onClick={props.onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
