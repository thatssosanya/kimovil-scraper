import { For } from "solid-js";
import { STATUS_TABS, PERIOD_OPTIONS, type StatusTab, type PeriodOption } from "../WidgetDebug.types";

export function FiltersBar(props: {
  search: string;
  onSearchChange: (value: string) => void;
  statusTab: StatusTab;
  onStatusTabChange: (tab: StatusTab) => void;
  period: PeriodOption;
  onPeriodChange: (period: PeriodOption) => void;
  loading: boolean;
  syncing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4 mb-6">
      <div class="flex flex-col md:flex-row gap-4 items-start md:items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="Search models..."
          value={props.search}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          class="flex-1 px-3 py-2 text-sm bg-zinc-100 dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-slate-400"
        />

        {/* Status Tabs */}
        <div class="flex gap-1 bg-zinc-100 dark:bg-slate-800 rounded-lg p-1">
          <For each={STATUS_TABS}>
            {(tab) => (
              <button
                onClick={() => props.onStatusTabChange(tab.id)}
                class={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  props.statusTab === tab.id
                    ? "bg-white dark:bg-slate-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>

        {/* Period Selector */}
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 text-zinc-500 dark:text-slate-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="flex gap-0.5 bg-zinc-100 dark:bg-slate-800 rounded-lg p-0.5">
            <For each={PERIOD_OPTIONS}>
              {(opt) => (
                <button
                  onClick={() => props.onPeriodChange(opt.id)}
                  class={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                    props.period === opt.id
                      ? "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                      : "text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={props.onRefresh}
          disabled={props.loading || props.syncing}
          class="px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          {props.loading ? "Loading..." : props.syncing ? "Syncing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
