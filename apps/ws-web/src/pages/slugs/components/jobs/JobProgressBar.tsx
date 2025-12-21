import { Show } from "solid-js";
import type { BulkJobStats } from "../../types";
import {
  type DisplayStatus,
  progressPercent,
  progressBarClass,
} from "./jobViewHelpers";

interface JobProgressBarProps {
  stats: BulkJobStats;
  status: DisplayStatus;
  size?: "sm" | "lg";
  timeout?: { count: number; nextRetryAt: number | null };
  formatTimeRemaining?: (timestamp: number | null) => string;
}

export function JobProgressBar(props: JobProgressBarProps) {
  const size = () => props.size ?? "sm";
  const percent = () => progressPercent(props.stats);
  const barClass = () =>
    `h-full transition-all duration-500 ${progressBarClass(props.status)}`;

  return (
    <div class={size() === "lg" ? "w-full" : "w-full max-w-[200px]"}>
      <div class="flex justify-between text-xs mb-1">
        <span class="text-slate-400">
          {props.stats.done + props.stats.error} / {props.stats.total}
        </span>
        <span class="text-indigo-400 font-medium">{percent()}%</span>
      </div>
      <div
        class={`bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 ${size() === "lg" ? "h-2 bg-slate-700" : "h-1.5"}`}
      >
        <div class={barClass()} style={{ width: `${percent()}%` }} />
      </div>
      <Show when={props.timeout?.count && props.formatTimeRemaining}>
        <div class="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-400 font-medium animate-in fade-in slide-in-from-top-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clip-rule="evenodd"
            />
          </svg>
          <span>
            {props.timeout!.count} timeout
            <span class="opacity-70 ml-1 font-mono">
              ({props.formatTimeRemaining!(props.timeout!.nextRetryAt)})
            </span>
          </span>
        </div>
      </Show>
    </div>
  );
}
