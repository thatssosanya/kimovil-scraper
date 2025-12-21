import { For, Show } from "solid-js";
import { JobsRow } from "./JobsRow";
import type { JobEntry } from "./jobViewHelpers";

interface JobsTableProps {
  jobs: JobEntry[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onSetWorkers: (jobId: string, count: number) => void;
  onShowErrors: (jobId: string) => void;
  formatTimeRemaining: (timestamp: number | null) => string;
}

export function JobsTable(props: JobsTableProps) {
  return (
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
            <For each={props.jobs}>
              {(item) => (
                <JobsRow
                  job={item}
                  isSelected={props.selectedJobId === item.job.id}
                  onSelect={() => props.onSelectJob(item.job.id)}
                  onPause={() => props.onPause(item.job.id)}
                  onResume={() => props.onResume(item.job.id)}
                  onSetWorkers={(count) => props.onSetWorkers(item.job.id, count)}
                  onShowErrors={() => props.onShowErrors(item.job.id)}
                  formatTimeRemaining={props.formatTimeRemaining}
                />
              )}
            </For>
            <Show when={props.jobs.length === 0}>
              <tr>
                <td colSpan={6} class="p-8 text-center text-slate-500 italic">
                  No jobs found. Start a bulk scrape to see it here.
                </td>
              </tr>
            </Show>
          </tbody>
        </table>
      </div>
    </div>
  );
}
