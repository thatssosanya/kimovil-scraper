import { Show, For, createSignal, onCleanup, onMount } from "solid-js";
import { useDevices, useSelection } from "../context/devices-table.context";
import { DeviceRow } from "./DeviceRow";

const LIMIT_OPTIONS = [10, 100, 500, 1000, 10000] as const;

export function DevicesTable() {
  const { devices, filtered, total, limit, setLimit, loading } = useDevices();
  const { toggleAll, allSelected, handleRowClick, clearSelection } = useSelection();

  const [showLimitMenu, setShowLimitMenu] = createSignal(false);
  const [focusedIndex, setFocusedIndex] = createSignal(-1);

  const handleKeyDown = (e: KeyboardEvent) => {
    const devs = devices();
    if (devs.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, devs.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case " ":
        e.preventDefault();
        const idx = focusedIndex();
        if (idx >= 0 && idx < devs.length) {
          handleRowClick(devs[idx].slug, idx, e as unknown as MouseEvent);
        }
        break;
      case "Escape":
        e.preventDefault();
        clearSelection();
        setFocusedIndex(-1);
        break;
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <>
      {/* Header row */}
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-400">
            Showing <span class="text-slate-200 font-semibold tabular-nums">{Math.min(filtered(), limit()).toLocaleString()}</span>
            {" "}of {filtered().toLocaleString()}
            {filtered() !== total() && <span> (filtered from {total().toLocaleString()})</span>}
          </span>
          <div class="relative">
            <button
              onClick={() => setShowLimitMenu(!showLimitMenu())}
              class={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ring-1 cursor-pointer transition-colors ${
                filtered() > limit()
                  ? "text-amber-400 bg-amber-500/10 ring-amber-500/20 hover:bg-amber-500/20"
                  : "text-slate-400 bg-slate-800 ring-slate-700 hover:bg-slate-700"
              }`}
            >
              Limit: {limit().toLocaleString()}
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <Show when={showLimitMenu()}>
              <div class="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[100px]">
                <For each={[...LIMIT_OPTIONS]}>
                  {(option) => (
                    <button
                      onClick={() => {
                        setLimit(option);
                        setShowLimitMenu(false);
                      }}
                      class={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        option === limit()
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
        <Show when={loading()}>
          <div class="flex flex-col items-center justify-center py-20 space-y-3">
            <div class="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p class="text-sm text-slate-500">Loading devices...</p>
          </div>
        </Show>

        <Show when={!loading()}>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-slate-800/50">
                  <th class="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected()}
                      onChange={toggleAll}
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
                <For each={devices()}>
                  {(device, i) => (
                    <DeviceRow
                      device={device}
                      index={i()}
                      focused={focusedIndex() === i()}
                      onFocus={() => setFocusedIndex(i())}
                    />
                  )}
                </For>
              </tbody>
            </table>

            {/* Empty state */}
            <Show when={devices().length === 0}>
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
