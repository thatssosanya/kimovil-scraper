import { Show, For, createSignal } from "solid-js";
import type { Device, QueueItem, ScrapeStatus } from "../types";
import { DataStatusIcons } from "./DataStatusIcons";

const LIMIT_OPTIONS = [10, 100, 500, 1000, 10000] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number];

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
  onOpenModal: (slug: string) => void;
  onClearData: (slug: string) => void;
  allSelected: boolean;
  filtered: number;
  total: number;
  limit: LimitOption;
  onLimitChange: (limit: LimitOption) => void;
}

function QueueStatusBadge(props: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    pending: { class: "bg-amber-500/10 text-amber-400 ring-amber-500/20", label: "Pending" },
    running: { class: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20 animate-pulse", label: "Running" },
    done: { class: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", label: "Done" },
    error: { class: "bg-rose-500/10 text-rose-400 ring-rose-500/20", label: "Error" },
  };

  const cfg = config[props.status] || config.pending;

  return (
    <span class={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ring-1 ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}

function ActionButton(props: {
  onClick: () => void;
  disabled?: boolean;
  variant: "fast" | "full" | "view" | "delete";
  title: string;
}) {
  const variants = {
    fast: {
      class: "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10",
      icon: (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    full: {
      class: "text-violet-400 hover:text-violet-300 hover:bg-violet-500/10",
      icon: (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
    },
    view: {
      class: "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10",
      icon: (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    delete: {
      class: "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10",
      icon: (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      ),
    },
  };

  const v = variants[props.variant];

  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      class={`
        p-1.5 rounded-md transition-all duration-150 cursor-pointer
        disabled:opacity-30 disabled:cursor-not-allowed
        ${v.class}
      `}
    >
      {v.icon}
    </button>
  );
}

export function DevicesTable(props: DevicesTableProps) {
  const canViewData = (slug: string) => {
    const status = props.scrapeStatus[slug];
    return status?.hasHtml || status?.hasRawData || status?.hasAiData;
  };

  const hasAnyData = (slug: string) => {
    const status = props.scrapeStatus[slug];
    return status?.hasHtml || status?.hasRawData || status?.hasAiData || props.queueStatus[slug];
  };

  const isQueued = (slug: string) => {
    const q = props.queueStatus[slug];
    return q && (q.status === "pending" || q.status === "running");
  };

  const needsScrape = (slug: string) => {
    return !props.scrapeStatus[slug]?.hasHtml && !isQueued(slug);
  };

  const [showLimitMenu, setShowLimitMenu] = createSignal(false);

  return (
    <>
      {/* Header row */}
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-400">
            Showing <span class="text-slate-200 font-semibold tabular-nums">{Math.min(props.filtered, props.limit).toLocaleString()}</span>
            {" "}of {props.filtered.toLocaleString()}
            {props.filtered !== props.total && <span> (filtered from {props.total.toLocaleString()})</span>}
          </span>
          <div class="relative">
            <button
              onClick={() => setShowLimitMenu(!showLimitMenu())}
              class={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ring-1 cursor-pointer transition-colors ${
                props.filtered > props.limit
                  ? "text-amber-400 bg-amber-500/10 ring-amber-500/20 hover:bg-amber-500/20"
                  : "text-slate-400 bg-slate-800 ring-slate-700 hover:bg-slate-700"
              }`}
            >
              Limit: {props.limit.toLocaleString()}
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <Show when={showLimitMenu()}>
              <div class="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[100px]">
                <For each={LIMIT_OPTIONS}>
                  {(option) => (
                    <button
                      onClick={() => {
                        props.onLimitChange(option);
                        setShowLimitMenu(false);
                      }}
                      class={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        option === props.limit
                          ? "text-indigo-400 bg-indigo-500/10"
                          : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {option.toLocaleString()}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Table container */}
      <div class="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <Show when={props.loading}>
          <div class="flex flex-col items-center justify-center py-20 space-y-3">
            <div class="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p class="text-sm text-slate-500">Loading devices...</p>
          </div>
        </Show>

        <Show when={!props.loading}>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-slate-800/50">
                  <th class="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={props.allSelected}
                      onChange={props.onToggleSelectAll}
                      class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 cursor-pointer"
                    />
                  </th>
                  <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Device
                  </th>
                  <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-28">
                    Brand
                  </th>
                  <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-36">
                    Data
                  </th>
                  <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-24">
                    Queue
                  </th>
                  <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-32 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/30">
                <For each={props.devices}>
                  {(device) => {
                    const isSelected = () => props.selected.has(device.slug);
                    const status = () => props.scrapeStatus[device.slug];
                    const isCorrupted = () => status()?.isCorrupted === true;

                    return (
                      <tr
                        class={`
                          group transition-colors duration-150
                          ${isSelected() ? "bg-indigo-500/5" : "hover:bg-slate-800/30"}
                          ${isCorrupted() ? "bg-rose-500/5" : ""}
                        `}
                      >
                        {/* Checkbox */}
                        <td class="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected()}
                            onChange={() => props.onToggleSelect(device.slug)}
                            class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                          />
                        </td>

                        {/* Device */}
                        <td class="px-4 py-2">
                          <div class="flex flex-col min-w-0">
                            <span class="text-sm font-medium text-slate-200 truncate" title={device.name}>
                              {device.name}
                            </span>
                            <span class="text-[11px] font-mono text-slate-500 truncate" title={device.slug}>
                              {device.slug}
                            </span>
                          </div>
                        </td>

                        {/* Brand */}
                        <td class="px-4 py-2">
                          <span class="text-sm text-slate-400">
                            {device.brand || "—"}
                          </span>
                        </td>

                        {/* Data Status */}
                        <td class="px-4 py-2">
                          <DataStatusIcons status={status()} />
                        </td>

                        {/* Queue Status */}
                        <td class="px-4 py-2">
                          <Show when={props.queueStatus[device.slug]}>
                            <QueueStatusBadge status={props.queueStatus[device.slug].status} />
                          </Show>
                        </td>

                        {/* Actions */}
                        <td class="px-4 py-2">
                          <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                            {/* Scrape buttons */}
                            <Show when={needsScrape(device.slug)}>
                              <ActionButton
                                variant="fast"
                                title="Fast scrape (HTML + Raw)"
                                onClick={() => props.onQueueScrape(device.slug, "fast")}
                                disabled={props.queueLoading[device.slug]}
                              />
                              <ActionButton
                                variant="full"
                                title="Full scrape (+ AI processing)"
                                onClick={() => props.onQueueScrape(device.slug, "complex")}
                                disabled={props.queueLoading[device.slug]}
                              />
                            </Show>

                            {/* View button */}
                            <Show when={canViewData(device.slug)}>
                              <ActionButton
                                variant="view"
                                title="View data"
                                onClick={() => props.onOpenModal(device.slug)}
                              />
                            </Show>

                            {/* Delete button */}
                            <Show when={hasAnyData(device.slug)}>
                              <ActionButton
                                variant="delete"
                                title="Clear all data"
                                onClick={() => props.onClearData(device.slug)}
                              />
                            </Show>
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>

            {/* Empty state */}
            <Show when={props.devices.length === 0}>
              <div class="flex flex-col items-center justify-center py-16">
                <div class="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
                  <svg class="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <h3 class="text-base font-medium text-slate-300 mb-1">No devices found</h3>
                <p class="text-sm text-slate-500 max-w-xs text-center">
                  Try adjusting your search or filters
                </p>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </>
  );
}
