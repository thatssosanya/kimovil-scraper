import { Show, For } from "solid-js";
import type { WidgetMapping, SortField } from "../WidgetDebug.types";
import { StatusBadge } from "./StatusBadge";
import { SortIcon } from "./SortIcon";

export function MappingsTable(props: {
  mappings: WidgetMapping[];
  sortField: SortField;
  sortDesc: boolean;
  onSortChange: (field: SortField) => void;
  onRowClick: (mapping: WidgetMapping) => void;
  total: number;
}) {
  return (
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-zinc-50 dark:bg-slate-800/50 border-b border-zinc-200 dark:border-slate-800">
              <th
                class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                onClick={() => props.onSortChange("usageCount")}
              >
                Count <SortIcon field="usageCount" currentField={props.sortField} desc={props.sortDesc} />
              </th>
              <th class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400">
                Impressions
              </th>
              <th class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400">
                Prices
              </th>
              <th
                class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                onClick={() => props.onSortChange("status")}
              >
                Status <SortIcon field="status" currentField={props.sortField} desc={props.sortDesc} />
              </th>
              <th
                class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                onClick={() => props.onSortChange("rawModel")}
              >
                Raw Model <SortIcon field="rawModel" currentField={props.sortField} desc={props.sortDesc} />
              </th>
              <th class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400">
                Normalized
              </th>
              <th
                class="px-4 py-3 text-left font-medium text-zinc-500 dark:text-slate-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                onClick={() => props.onSortChange("confidence")}
              >
                Match <SortIcon field="confidence" currentField={props.sortField} desc={props.sortDesc} />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-slate-800">
            <For each={props.mappings}>
              {(mapping) => (
                <tr
                  class="hover:bg-zinc-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => props.onRowClick(mapping)}
                >
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center justify-center w-8 h-6 bg-zinc-100 dark:bg-slate-800 rounded text-xs font-medium text-zinc-600 dark:text-slate-300">
                      {mapping.usageCount}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <Show when={mapping.impressions != null} fallback={
                      <span class="text-xs text-zinc-300 dark:text-slate-600">—</span>
                    }>
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-medium text-zinc-700 dark:text-slate-300 tabular-nums">
                          {mapping.impressions!.toLocaleString()}
                        </span>
                        <Show when={mapping.clicks}>
                          <span class="text-[10px] text-zinc-400 dark:text-slate-500">
                            ({mapping.clicks} clicks)
                          </span>
                        </Show>
                      </div>
                    </Show>
                  </td>
                  <td class="px-4 py-3">
                    <Show when={mapping.priceCount != null} fallback={
                      <span class="text-xs text-zinc-300 dark:text-slate-600">—</span>
                    }>
                      <span class={`text-xs font-medium tabular-nums ${
                        mapping.priceCount! > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-zinc-400 dark:text-slate-500"
                      }`}>
                        {mapping.priceCount!.toLocaleString()}
                      </span>
                    </Show>
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge status={mapping.status} />
                  </td>
                  <td class="px-4 py-3 max-w-xs">
                    <div
                      class="truncate text-zinc-900 dark:text-white font-mono text-xs"
                      title={mapping.rawModel}
                    >
                      {mapping.rawModel}
                    </div>
                  </td>
                  <td class="px-4 py-3 max-w-xs">
                    <div
                      class="truncate text-zinc-500 dark:text-slate-400 font-mono text-xs"
                      title={mapping.normalizedModel ?? ""}
                    >
                      {mapping.normalizedModel ?? "—"}
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <Show
                      when={mapping.deviceId}
                      fallback={
                        <span class="inline-flex px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded text-xs">
                          No match
                        </span>
                      }
                    >
                      <div class="flex items-center gap-2">
                        <span
                          class={`inline-flex px-2 py-0.5 rounded text-xs ${
                            (mapping.confidence ?? 0) >= 0.9
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {Math.round((mapping.confidence ?? 0) * 100)}%
                        </span>
                        <span
                          class="text-xs text-zinc-500 dark:text-slate-400 truncate max-w-[120px]"
                          title={mapping.deviceId!}
                        >
                          {mapping.deviceId}
                        </span>
                      </div>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      {/* Table footer */}
      <div class="px-4 py-3 bg-zinc-50 dark:bg-slate-800/50 border-t border-zinc-200 dark:border-slate-800 text-sm text-zinc-500 dark:text-slate-400">
        Showing {props.mappings.length} of {props.total} mappings
      </div>
    </div>
  );
}
