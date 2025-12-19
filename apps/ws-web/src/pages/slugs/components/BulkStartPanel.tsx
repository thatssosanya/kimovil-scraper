import { Show } from "solid-js";

interface BulkStartPanelProps {
  wsConnected: boolean;
  bulkJobLoading: boolean;
  onStartJob: (filter: "all" | "unscraped") => void;
}

export function BulkStartPanel(props: BulkStartPanelProps) {
  return (
    <div class="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl">
      <div class="flex items-center gap-2 text-sm text-slate-400">
        <span class="font-medium text-slate-200">Bulk Scrape</span>
        <Show when={!props.wsConnected}>
          <span class="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
            Offline
          </span>
        </Show>
      </div>
      <div class="flex gap-2">
        <button
          class="cursor-pointer px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => props.onStartJob("unscraped")}
          disabled={props.bulkJobLoading || !props.wsConnected}
        >
          Unscraped
        </button>
        <button
          class="cursor-pointer px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => props.onStartJob("all")}
          disabled={props.bulkJobLoading || !props.wsConnected}
        >
          All
        </button>
      </div>
    </div>
  );
}
