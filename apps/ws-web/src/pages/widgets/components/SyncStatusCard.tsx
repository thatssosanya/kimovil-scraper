import { Show } from "solid-js";
import type { SyncStatus } from "../WidgetDebug.types";

function formatDateStr(dateStr: string | null) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleString();
}

export function SyncStatusCard(props: {
  syncStatus: SyncStatus | null;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4 mb-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex flex-wrap gap-6 text-sm">
          <div>
            <span class="text-zinc-500 dark:text-slate-400">Last synced:</span>
            <span class="ml-2 font-medium text-zinc-900 dark:text-white">
              {formatDateStr(props.syncStatus?.lastSyncedAt ?? null)}
            </span>
          </div>
          <div>
            <span class="text-zinc-500 dark:text-slate-400">Posts cached:</span>
            <span class="ml-2 font-medium text-zinc-900 dark:text-white">
              {props.syncStatus?.postsCount?.toLocaleString() ?? "—"}
            </span>
          </div>
          <div>
            <span class="text-zinc-500 dark:text-slate-400">Widgets cached:</span>
            <span class="ml-2 font-medium text-zinc-900 dark:text-white">
              {props.syncStatus?.widgetsCount?.toLocaleString() ?? "—"}
            </span>
          </div>
        </div>
        <button
          onClick={props.onSync}
          disabled={props.syncing}
          class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <Show when={props.syncing}>
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </Show>
          {props.syncing ? "Syncing..." : "Sync from WordPress"}
        </button>
      </div>
    </div>
  );
}
