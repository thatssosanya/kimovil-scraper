import { Show, For, createSignal } from "solid-js";
import type { JobType } from "../types";

interface BulkStartPanelProps {
  wsConnected: boolean;
  bulkJobLoading: boolean;
  onStartJob: (
    filter: "all" | "unscraped" | "needs_extraction" | "needs_ai",
    jobType: JobType,
    options?: { source?: string; dataKind?: string },
  ) => void;
}

type JobConfig = {
  type: JobType;
  label: string;
  color: string;
  filters: { value: string; label: string }[];
  source?: string;
  dataKind?: string;
};

const jobConfigs: JobConfig[] = [
  {
    type: "scrape",
    label: "Scrape",
    color: "indigo",
    filters: [
      { value: "unscraped", label: "Unscraped" },
      { value: "all", label: "All" },
    ],
  },
  {
    type: "process_raw",
    label: "Extract",
    color: "cyan",
    filters: [
      { value: "needs_extraction", label: "Needs Extraction" },
      { value: "all", label: "All with HTML" },
    ],
  },
  {
    type: "process_ai",
    label: "AI Process",
    color: "violet",
    filters: [
      { value: "needs_ai", label: "Needs AI" },
      { value: "all", label: "All with Raw" },
    ],
  },
  {
    type: "link_priceru",
    label: "Link price.ru offers",
    color: "orange",
    filters: [
      { value: "all", label: "All Devices" },
    ],
  },
  {
    type: "scrape",
    label: "Get prices from price.ru",
    color: "amber",
    source: "price_ru",
    dataKind: "prices",
    filters: [
      { value: "all", label: "All Linked" },
    ],
  },
];

const colorClasses: Record<string, { bg: string; hover: string; ring: string }> = {
  indigo: {
    bg: "bg-indigo-600",
    hover: "hover:bg-indigo-500",
    ring: "ring-indigo-500/30",
  },
  cyan: {
    bg: "bg-cyan-600",
    hover: "hover:bg-cyan-500",
    ring: "ring-cyan-500/30",
  },
  violet: {
    bg: "bg-violet-600",
    hover: "hover:bg-violet-500",
    ring: "ring-violet-500/30",
  },
  orange: {
    bg: "bg-orange-600",
    hover: "hover:bg-orange-500",
    ring: "ring-orange-500/30",
  },
  amber: {
    bg: "bg-amber-600",
    hover: "hover:bg-amber-500",
    ring: "ring-amber-500/30",
  },
};

export function BulkStartPanel(props: BulkStartPanelProps) {
  const [activeIdx, setActiveIdx] = createSignal(0);

  const currentConfig = () => jobConfigs[activeIdx()];
  const colors = () => colorClasses[currentConfig().color];

  return (
    <div class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Job type tabs */}
      <div class="flex border-b border-zinc-200 dark:border-slate-800">
        <For each={jobConfigs}>
          {(config, idx) => {
            const isActive = () => activeIdx() === idx();
            const clr = colorClasses[config.color];
            return (
              <button
                class={`
                  flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-all cursor-pointer
                  ${isActive() ? `${clr.bg} text-white` : "text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-200 hover:bg-zinc-100 dark:hover:bg-slate-800/50"}
                `}
                onClick={() => setActiveIdx(idx())}
              >
                {config.label}
              </button>
            );
          }}
        </For>
      </div>

      {/* Filter buttons */}
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2 text-sm text-zinc-500 dark:text-slate-400">
          <span class="font-medium text-zinc-700 dark:text-slate-300">Start Bulk Job</span>
          <Show when={!props.wsConnected}>
            <span class="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
              Offline
            </span>
          </Show>
        </div>
        <div class="flex gap-2">
          <For each={currentConfig().filters}>
            {(filter, idx) => {
              const cfg = currentConfig();
              return (
                <button
                  class={`
                    cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg transition-all active:scale-95
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${idx() === 0
                      ? `${colors().bg} ${colors().hover} text-white`
                      : "bg-zinc-200 dark:bg-slate-700 hover:bg-zinc-300 dark:hover:bg-slate-600 text-zinc-900 dark:text-white"
                    }
                  `}
                  onClick={() =>
                    props.onStartJob(
                      filter.value as "all" | "unscraped" | "needs_extraction" | "needs_ai",
                      cfg.type,
                      cfg.source || cfg.dataKind ? { source: cfg.source, dataKind: cfg.dataKind } : undefined,
                    )
                  }
                  disabled={props.bulkJobLoading || !props.wsConnected}
                >
                  {filter.label}
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}
