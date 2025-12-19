import { Show, For } from "solid-js";
import type { Device, QueueItem, ScrapeStatus } from "../types";
import { StatusBadge } from "./StatusBadge";

interface DevicesTableProps {
  devices: Device[];
  selected: Set<string>;
  scrapeStatus: Record<string, ScrapeStatus>;
  queueStatus: Record<string, QueueItem>;
  queueLoading: Record<string, boolean>;
  loading: boolean;
  onToggleSelect: (slug: string) => void;
  onToggleSelectAll: () => void;
  onQueueScrape: (slug: string, mode: "fast" | "complex") => void;
  onOpenPreview: (slug: string) => void;
  onClearData: (slug: string) => void;
  allSelected: boolean;
  filtered: number;
  total: number;
}

export function DevicesTable(props: DevicesTableProps) {
  const canPreview = (slug: string) => props.scrapeStatus[slug]?.hasHtml;
  const hasData = (slug: string) =>
    props.scrapeStatus[slug]?.hasHtml || props.queueStatus[slug];

  return (
    <>
      <div class="text-sm text-slate-400 flex items-center justify-between">
        <span>
          Showing{" "}
          <span class="text-slate-200 font-semibold">
            {props.filtered.toLocaleString()}
          </span>{" "}
          of {props.total.toLocaleString()} devices
        </span>
        <Show when={props.filtered > 500}>
          <span class="text-amber-500 text-xs bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
            Limited to 500 results
          </span>
        </Show>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <Show when={props.loading}>
          <div class="flex flex-col items-center justify-center py-24 space-y-4">
            <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p class="text-slate-500 animate-pulse">Loading devices...</p>
          </div>
        </Show>

        <Show when={!props.loading}>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-800/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th class="w-10 p-4">
                    <input
                      type="checkbox"
                      checked={props.allSelected}
                      onChange={props.onToggleSelectAll}
                      class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th class="p-4 font-semibold">Name</th>
                  <th class="p-4 font-semibold">Slug</th>
                  <th class="p-4 font-semibold">Brand</th>
                  <th class="p-4 font-semibold">Status</th>
                  <th class="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                <For each={props.devices}>
                  {(device) => (
                    <tr
                      class={`group transition-colors ${
                        props.selected.has(device.slug)
                          ? "bg-indigo-900/10 hover:bg-indigo-900/20"
                          : "hover:bg-slate-800/30"
                      } ${props.scrapeStatus[device.slug]?.isCorrupted ? "bg-rose-950/10" : ""}`}
                    >
                      <td class="p-4">
                        <input
                          type="checkbox"
                          checked={props.selected.has(device.slug)}
                          onChange={() => props.onToggleSelect(device.slug)}
                          class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                        />
                      </td>
                      <td class="p-4">
                        <div class="font-medium text-slate-200">
                          {device.name}
                        </div>
                      </td>
                      <td class="p-4">
                        <div class="font-mono text-xs text-slate-500 bg-slate-950/30 px-2 py-1 rounded inline-block border border-slate-800/50">
                          {device.slug}
                        </div>
                      </td>
                      <td class="p-4 text-slate-400">{device.brand || "—"}</td>
                      <td class="p-4">
                        <StatusBadge
                          queueItem={props.queueStatus[device.slug]}
                          scrapeStatus={props.scrapeStatus[device.slug]}
                        />
                      </td>
                      <td class="p-4 text-right">
                        <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <Show when={!props.scrapeStatus[device.slug]?.hasHtml}>
                            <button
                              class="cursor-pointer px-2 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded transition-colors disabled:opacity-50"
                              onClick={() =>
                                props.onQueueScrape(device.slug, "fast")
                              }
                              disabled={
                                props.queueLoading[device.slug] ||
                                props.queueStatus[device.slug]?.status ===
                                  "running"
                              }
                            >
                              Fast
                            </button>
                            <button
                              class="cursor-pointer px-2 py-1 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded transition-colors disabled:opacity-50"
                              onClick={() =>
                                props.onQueueScrape(device.slug, "complex")
                              }
                              disabled={
                                props.queueLoading[device.slug] ||
                                props.queueStatus[device.slug]?.status ===
                                  "running"
                              }
                            >
                              Full
                            </button>
                          </Show>
                          <Show when={canPreview(device.slug)}>
                            <button
                              class="cursor-pointer px-2 py-1 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded transition-colors"
                              onClick={() => props.onOpenPreview(device.slug)}
                            >
                              View
                            </button>
                          </Show>
                          <Show when={hasData(device.slug)}>
                            <button
                              class="cursor-pointer p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                              title="Clear Data"
                              onClick={() => props.onClearData(device.slug)}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </Show>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            <Show when={props.devices.length === 0}>
              <div class="p-12 text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-8 w-8 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <h3 class="text-lg font-medium text-slate-300">
                  No devices found
                </h3>
                <p class="text-slate-500 mt-2 max-w-sm mx-auto">
                  Try adjusting your search filters or run the crawler to
                  collect more slugs.
                </p>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </>
  );
}
