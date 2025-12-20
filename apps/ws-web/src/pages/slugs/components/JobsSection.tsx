import { Show, For } from "solid-js";
import type { BulkJobInfo, BulkJobStats } from "../types";

interface JobsSectionProps {
  allJobs: Array<{ job: BulkJobInfo; stats: BulkJobStats }>;
  selectedJobId: string | null;
  selectedJob: { job: BulkJobInfo; stats: BulkJobStats } | null;
  jobsExpanded: boolean;
  onToggleExpanded: () => void;
  onSelectJob: (jobId: string) => void;
  onDeselectJob: () => void;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onSetWorkers: (jobId: string, count: number) => void;
  onShowErrors: (jobId: string) => void;
  formatTimeRemaining: (timestamp: number | null) => string;
}

export function JobsSection(props: JobsSectionProps) {
  return (
    <div class="space-y-4">
      <button
        class="flex items-center gap-2 text-lg font-semibold text-slate-200 hover:text-white transition-colors group w-full text-left"
        onClick={props.onToggleExpanded}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class={`h-5 w-5 transition-transform duration-300 ${
            props.jobsExpanded ? "rotate-90" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        </svg>
        All Jobs
        <Show when={props.allJobs.length > 0}>
          <span class="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-700">
            {props.allJobs.length}
          </span>
        </Show>
        <Show
          when={
            props.allJobs.filter((j) =>
              ["running", "paused"].includes(j.job.status),
            ).length > 0
          }
        >
          <span class="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded-full border border-indigo-500/20 animate-pulse">
            {
              props.allJobs.filter((j) =>
                ["running", "paused"].includes(j.job.status),
              ).length
            }{" "}
            active
          </span>
        </Show>
      </button>

      <Show when={props.jobsExpanded}>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-800/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th class="p-4 font-semibold">Job ID</th>
                  <th class="p-4 font-semibold">Type</th>
                  <th class="p-4 font-semibold">Status</th>
                  <th class="p-4 font-semibold">Progress</th>
                  <th class="p-4 font-semibold">Workers</th>
                  <th class="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                <For each={props.allJobs}>
                  {(item) => (
                    <tr
                      class={`cursor-pointer transition-colors ${
                        props.selectedJobId === item.job.id
                          ? "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/30"
                          : "hover:bg-slate-800/30"
                      }`}
                      onClick={() => props.onSelectJob(item.job.id)}
                    >
                      <td class="p-4">
                        <div class="flex flex-col">
                          <span class="font-mono text-[10px] text-slate-300">
                            {item.job.id}
                          </span>
                          <span class="text-xs text-slate-500">
                            {new Date(
                              item.job.createdAt * 1000,
                            ).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td class="p-4">
                        <span
                          class={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border inline-flex items-center gap-1.5 w-fit ${
                            (item.job.jobType ?? "scrape") === "scrape"
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              : (item.job.jobType ?? "scrape") === "process_raw"
                                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                                : "bg-violet-500/10 text-violet-400 border-violet-500/20"
                          }`}
                        >
                          {(item.job.jobType ?? "scrape") === "scrape"
                            ? "Scrape"
                            : (item.job.jobType ?? "scrape") === "process_raw"
                              ? "Extract"
                              : item.job.batchStatus
                                ? `AI (${item.job.batchStatus})`
                                : "AI"}
                        </span>
                      </td>
                      <td class="p-4">
                        <div class="flex flex-col gap-1">
                          <span
                            class={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border inline-flex items-center gap-1.5 w-fit ${
                              item.job.status === "running"
                                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse"
                                : item.job.status === "paused"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : item.job.status === "done" &&
                                      item.stats.error > 0
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : item.job.status === "done"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : item.job.status === "error"
                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                        : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            <span
                              class={`w-1.5 h-1.5 rounded-full ${
                                item.job.status === "running"
                                  ? "bg-indigo-400"
                                  : "bg-current"
                              }`}
                            ></span>
                            {item.job.status === "done" && item.stats.error > 0
                              ? "done w/ errors"
                              : item.job.status}
                          </span>
                          <Show when={item.stats.error > 0}>
                            <button
                              class="text-[10px] text-rose-400 font-medium hover:text-rose-300 hover:underline text-left"
                              onClick={(e) => {
                                e.stopPropagation();
                                props.onShowErrors(item.job.id);
                              }}
                            >
                              {item.stats.error} failed items
                              {item.job.status === "done" ? " (retryable)" : ""}
                            </button>
                          </Show>
                          <Show when={item.job.errorMessage}>
                            <div
                              class="text-rose-400 text-xs max-w-[200px] truncate"
                              title={item.job.errorMessage!}
                            >
                              {item.job.errorMessage}
                            </div>
                          </Show>
                        </div>
                      </td>
                      <td class="p-4">
                        <div class="w-full max-w-[200px]">
                          <div class="flex justify-between text-xs mb-1">
                            <span class="text-slate-400">
                              {item.stats.done + item.stats.error} /{" "}
                              {item.stats.total}
                            </span>
                            <span class="text-indigo-400 font-medium">
                              {Math.round(
                                ((item.stats.done + item.stats.error) /
                                  (item.stats.total || 1)) *
                                  100,
                              )}
                              %
                            </span>
                          </div>
                          <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                            <div
                              class={`h-full transition-all duration-500 ${
                                item.job.status === "error"
                                  ? "bg-rose-500"
                                  : item.job.status === "done"
                                    ? "bg-emerald-500"
                                    : "bg-indigo-500"
                              }`}
                              style={{
                                width: `${
                                  ((item.stats.done + item.stats.error) /
                                    (item.stats.total || 1)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <Show when={item.stats.timeout?.count}>
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
                                {item.stats.timeout!.count} timeout
                                <span class="opacity-70 ml-1 font-mono">
                                  (
                                  {props.formatTimeRemaining(
                                    item.stats.timeout!.nextRetryAt,
                                  )}
                                  )
                                </span>
                              </span>
                            </div>
                          </Show>
                        </div>
                      </td>
                      <td class="p-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          class="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          value={item.job.workerCount || 2}
                          disabled={
                            !["running", "paused"].includes(item.job.status)
                          }
                          onChange={(e) =>
                            props.onSetWorkers(
                              item.job.id,
                              parseInt(e.currentTarget.value),
                            )
                          }
                        >
                          <For
                            each={[1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50]}
                          >
                            {(num) => <option value={num}>{num}</option>}
                          </For>
                        </select>
                      </td>
                      <td
                        class="p-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Show when={item.job.status === "running"}>
                          <button
                            class="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-amber-500/20"
                            onClick={() => props.onPause(item.job.id)}
                          >
                            Pause
                          </button>
                        </Show>
                        <Show
                          when={
                            item.job.status === "paused" ||
                            item.job.status === "error"
                          }
                        >
                          <button
                            class="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-emerald-500/20"
                            onClick={() => props.onResume(item.job.id)}
                          >
                            {item.job.status === "error" ? "Retry" : "Resume"}
                          </button>
                        </Show>
                        <Show
                          when={
                            item.job.status === "done" && item.stats.error > 0
                          }
                        >
                          <button
                            class="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-rose-500/20"
                            onClick={() => props.onResume(item.job.id)}
                          >
                            Retry {item.stats.error} Failed
                          </button>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
                <Show when={props.allJobs.length === 0}>
                  <tr>
                    <td
                      colspan="6"
                      class="p-8 text-center text-slate-500 italic"
                    >
                      No jobs found. Start a bulk scrape to see it here.
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Job Detail Panel - the kept view */}
        <Show when={props.selectedJob}>
          <div class="mt-4 bg-slate-800/50 border border-slate-700 rounded-xl p-5 animate-in slide-in-from-top-2 duration-200">
            <div class="flex items-start justify-between mb-4">
              <div>
                <div class="flex items-center gap-3">
                  <h4 class="text-base font-semibold text-slate-200">
                    Job {props.selectedJob!.job.id.slice(0, 8)}
                  </h4>
                  <span
                    class={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                      props.selectedJob!.job.status === "running"
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse"
                        : props.selectedJob!.job.status === "paused"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : props.selectedJob!.job.status === "done"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : props.selectedJob!.job.status === "error"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {props.selectedJob!.job.status}
                  </span>
                </div>
                <div class="text-xs text-slate-500 mt-1">
                  Created:{" "}
                  {new Date(
                    props.selectedJob!.job.createdAt * 1000,
                  ).toLocaleString()}
                  <Show when={props.selectedJob!.job.startedAt}>
                    {" "}
                    · Started:{" "}
                    {new Date(
                      props.selectedJob!.job.startedAt! * 1000,
                    ).toLocaleTimeString()}
                  </Show>
                </div>
              </div>
              <button
                class="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDeselectJob();
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
                  {props.selectedJob!.stats.done +
                    props.selectedJob!.stats.error}{" "}
                  / {props.selectedJob!.stats.total}
                </span>
                <span class="text-indigo-400 font-medium">
                  {Math.round(
                    ((props.selectedJob!.stats.done +
                      props.selectedJob!.stats.error) /
                      (props.selectedJob!.stats.total || 1)) *
                      100,
                  )}
                  %
                </span>
              </div>
              <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  class={`h-full transition-all duration-500 ${
                    props.selectedJob!.job.status === "error"
                      ? "bg-rose-500"
                      : props.selectedJob!.job.status === "done"
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-indigo-500 to-cyan-400"
                  }`}
                  style={{
                    width: `${((props.selectedJob!.stats.done + props.selectedJob!.stats.error) / (props.selectedJob!.stats.total || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
              <div class="bg-slate-900/50 p-2 rounded-lg">
                <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Pending
                </div>
                <div class="text-lg font-mono text-slate-300">
                  {props.selectedJob!.stats.pending}
                </div>
              </div>
              <div class="bg-indigo-500/10 p-2 rounded-lg">
                <div class="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">
                  Running
                </div>
                <div class="text-lg font-mono text-indigo-300">
                  {props.selectedJob!.stats.running}
                </div>
              </div>
              <div class="bg-emerald-500/10 p-2 rounded-lg">
                <div class="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                  Done
                </div>
                <div class="text-lg font-mono text-emerald-300">
                  {props.selectedJob!.stats.done}
                </div>
              </div>
              <button
                class={`bg-rose-500/10 p-2 rounded-lg text-center w-full ${
                  props.selectedJob!.stats.error > 0
                    ? "hover:bg-rose-500/20 cursor-pointer transition-colors"
                    : ""
                }`}
                onClick={() => {
                  if (props.selectedJob!.stats.error > 0) {
                    props.onShowErrors(props.selectedJob!.job.id);
                  }
                }}
                disabled={props.selectedJob!.stats.error === 0}
              >
                <div class="text-[10px] uppercase tracking-wider text-rose-400 font-bold">
                  Errors
                </div>
                <div class="text-lg font-mono text-rose-300">
                  {props.selectedJob!.stats.error}
                </div>
                <Show when={props.selectedJob!.stats.error > 0}>
                  <div class="text-[9px] text-rose-400/70 mt-0.5">
                    click to view
                  </div>
                </Show>
              </button>
              <Show when={props.selectedJob!.stats.timeout?.count}>
                <div class="bg-amber-500/10 p-2 rounded-lg">
                  <div class="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                    Timeout
                  </div>
                  <div class="text-lg font-mono text-amber-300">
                    {props.selectedJob!.stats.timeout!.count}
                    <span class="text-xs ml-1 opacity-70">
                      {props.formatTimeRemaining(
                        props.selectedJob!.stats.timeout!.nextRetryAt,
                      )}
                    </span>
                  </div>
                </div>
              </Show>
            </div>

            {/* Error banner for done jobs with failures */}
            <Show
              when={
                props.selectedJob!.job.status === "done" &&
                props.selectedJob!.stats.error > 0
              }
            >
              <div class="mt-4 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-center justify-between">
                <button
                  class="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  onClick={() => props.onShowErrors(props.selectedJob!.job.id)}
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
                    <span class="font-bold underline">
                      {props.selectedJob!.stats.error} items
                    </span>{" "}
                    failed during scraping
                  </span>
                </button>
                <button
                  class="bg-rose-500 hover:bg-rose-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => props.onResume(props.selectedJob!.job.id)}
                >
                  Retry Failed
                </button>
              </div>
            </Show>

            <div class="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500">Workers:</span>
                <select
                  class="bg-slate-900 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 outline-none focus:border-indigo-500"
                  value={props.selectedJob!.job.workerCount || 2}
                  onChange={(e) =>
                    props.onSetWorkers(
                      props.selectedJob!.job.id,
                      parseInt(e.currentTarget.value),
                    )
                  }
                  disabled={
                    !["running", "paused"].includes(
                      props.selectedJob!.job.status,
                    )
                  }
                >
                  <For each={[1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50]}>
                    {(n) => <option value={n}>{n}</option>}
                  </For>
                </select>
              </div>
              <div class="flex gap-2">
                <Show when={props.selectedJob!.job.status === "running"}>
                  <button
                    class="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-amber-500/20"
                    onClick={() => props.onPause(props.selectedJob!.job.id)}
                  >
                    Pause
                  </button>
                </Show>
                <Show
                  when={
                    props.selectedJob!.job.status === "paused" ||
                    props.selectedJob!.job.status === "error"
                  }
                >
                  <button
                    class="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-emerald-500/20"
                    onClick={() => props.onResume(props.selectedJob!.job.id)}
                  >
                    {props.selectedJob!.job.status === "error"
                      ? "Retry All"
                      : "Resume"}
                  </button>
                </Show>
                <Show
                  when={
                    props.selectedJob!.job.status === "done" &&
                    props.selectedJob!.stats.error > 0
                  }
                >
                  <button
                    class="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-rose-500/20"
                    onClick={() => props.onResume(props.selectedJob!.job.id)}
                  >
                    Retry {props.selectedJob!.stats.error} Failed
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
