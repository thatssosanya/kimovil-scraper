import { Show, createMemo } from "solid-js";
import { JobActions, JobWorkersSelect } from "./index";
import {
  type JobEntry,
  type DisplayStatus,
  getDisplayStatus,
  progressPercent,
  statusPillClass,
  statusLabel,
} from "./jobViewHelpers";

interface SelectedJobPanelProps {
  job: JobEntry;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onSetWorkers: (count: number) => void;
  onShowErrors: () => void;
  formatTimeRemaining: (timestamp: number | null) => string;
}

export function SelectedJobPanel(props: SelectedJobPanelProps) {
  const displayStatus = createMemo<DisplayStatus>(() => getDisplayStatus(props.job));
  const percentComplete = createMemo(() => progressPercent(props.job.stats));
  const hasErrors = () => props.job.stats.error > 0;

  const barColor = () => {
    const s = displayStatus();
    if (s === "error") return "bg-rose-500";
    if (s === "done") return "bg-emerald-500";
    return "bg-gradient-to-r from-indigo-500 to-cyan-400";
  };

  const completed = () => props.job.stats.done + props.job.stats.error;

  return (
    <div class="mt-4 bg-slate-800/50 border border-slate-700 rounded-xl p-5 animate-in slide-in-from-top-2 duration-200">
      <div class="flex items-start justify-between mb-4">
        <div>
          <div class="flex items-center gap-3">
            <h4 class="text-base font-semibold text-slate-200">
              Job {props.job.job.id.slice(0, 8)}
            </h4>
            <span
              class={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${statusPillClass(displayStatus(), hasErrors())}`}
            >
              {statusLabel(displayStatus(), hasErrors())}
            </span>
          </div>
          <div class="text-xs text-slate-500 mt-1">
            Created: {new Date(props.job.job.createdAt * 1000).toLocaleString()}
            <Show when={props.job.job.startedAt}>
              {" "}· Started:{" "}
              {new Date(props.job.job.startedAt! * 1000).toLocaleTimeString()}
            </Show>
          </div>
        </div>
        <button
          class="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            props.onClose();
          }}
          title="Close"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="mb-4">
        <div class="flex justify-between text-xs mb-1.5">
          <span class="text-slate-400">
            {completed()} / {props.job.stats.total}
          </span>
          <span class="text-indigo-400 font-medium">{percentComplete()}%</span>
        </div>
        <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            class={`h-full transition-all duration-500 ${barColor()}`}
            style={{ width: `${percentComplete()}%` }}
          />
        </div>
      </div>

      <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
        <div class="bg-slate-900/50 p-2 rounded-lg">
          <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            Pending
          </div>
          <div class="text-lg font-mono text-slate-300">
            {props.job.stats.pending}
          </div>
        </div>
        <div class="bg-indigo-500/10 p-2 rounded-lg">
          <div class="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">
            Running
          </div>
          <div class="text-lg font-mono text-indigo-300">
            {props.job.stats.running}
          </div>
        </div>
        <div class="bg-emerald-500/10 p-2 rounded-lg">
          <div class="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
            Done
          </div>
          <div class="text-lg font-mono text-emerald-300">
            {props.job.stats.done}
          </div>
        </div>
        <button
          class={`bg-rose-500/10 p-2 rounded-lg text-center w-full ${
            props.job.stats.error > 0
              ? "hover:bg-rose-500/20 cursor-pointer transition-colors"
              : ""
          }`}
          onClick={() => {
            if (props.job.stats.error > 0) {
              props.onShowErrors();
            }
          }}
          disabled={props.job.stats.error === 0}
        >
          <div class="text-[10px] uppercase tracking-wider text-rose-400 font-bold">
            Errors
          </div>
          <div class="text-lg font-mono text-rose-300">
            {props.job.stats.error}
          </div>
          <Show when={props.job.stats.error > 0}>
            <div class="text-[9px] text-rose-400/70 mt-0.5">click to view</div>
          </Show>
        </button>
        <Show when={props.job.stats.timeout?.count}>
          <div class="bg-amber-500/10 p-2 rounded-lg">
            <div class="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
              Timeout
            </div>
            <div class="text-lg font-mono text-amber-300">
              {props.job.stats.timeout!.count}
              <span class="text-xs ml-1 opacity-70">
                {props.formatTimeRemaining(props.job.stats.timeout!.nextRetryAt)}
              </span>
            </div>
          </div>
        </Show>
      </div>

      <Show when={displayStatus() === "done" && props.job.stats.error > 0}>
        <div class="mt-4 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-center justify-between">
          <button
            class="flex items-center gap-2 hover:opacity-80 transition-opacity"
            onClick={props.onShowErrors}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-rose-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="text-sm text-rose-300">
              <span class="font-bold underline">{props.job.stats.error} items</span>{" "}
              failed during scraping
            </span>
          </button>
          <button
            class="bg-rose-500 hover:bg-rose-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            onClick={props.onResume}
          >
            Retry Failed
          </button>
        </div>
      </Show>

      <div class="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-500">Workers:</span>
          <JobWorkersSelect
            workerCount={props.job.job.workerCount || 2}
            status={displayStatus()}
            onChange={props.onSetWorkers}
          />
        </div>
        <JobActions
          status={displayStatus()}
          errorCount={props.job.stats.error}
          onPause={props.onPause}
          onResume={props.onResume}
        />
      </div>
    </div>
  );
}
