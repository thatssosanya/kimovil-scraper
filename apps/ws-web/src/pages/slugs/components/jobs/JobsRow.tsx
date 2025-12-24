import {
  JobTypeBadge,
  JobStatusBadge,
  JobProgressBar,
  JobWorkersSelect,
  JobActions,
} from "./index";
import { type JobEntry, type DisplayStatus } from "./jobViewHelpers";

interface JobsRowProps {
  job: JobEntry;
  isSelected: boolean;
  onSelect: () => void;
  onPause: () => void;
  onResume: () => void;
  onSetWorkers: (count: number) => void;
  onShowErrors: () => void;
  formatTimeRemaining: (timestamp: number | null) => string;
}

export function JobsRow(props: JobsRowProps) {
  const displayStatus = (): DisplayStatus => props.job.job.status;

  return (
    <tr
      class={`cursor-pointer transition-colors ${
        props.isSelected
          ? "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/30"
          : "hover:bg-zinc-100/50 dark:hover:bg-slate-800/30"
      }`}
      onClick={props.onSelect}
    >
      <td class="p-4">
        <div class="flex flex-col">
          <span class="font-mono text-[10px] text-zinc-700 dark:text-slate-300">
            {props.job.job.id}
          </span>
          <span class="text-xs text-zinc-500 dark:text-slate-500">
            {new Date(props.job.job.createdAt * 1000).toLocaleString()}
          </span>
        </div>
      </td>
      <td class="p-4">
        <JobTypeBadge
          jobType={props.job.job.jobType ?? "scrape"}
          batchStatus={props.job.job.batchStatus ?? undefined}
        />
      </td>
      <td class="p-4">
        <JobStatusBadge
          status={displayStatus()}
          hasErrors={props.job.stats.error > 0}
          errorCount={props.job.stats.error}
          errorMessage={props.job.job.errorMessage}
          onShowErrors={props.onShowErrors}
        />
      </td>
      <td class="p-4">
        <JobProgressBar
          stats={props.job.stats}
          status={displayStatus()}
          timeout={props.job.stats.timeout}
          formatTimeRemaining={props.formatTimeRemaining}
        />
      </td>
      <td class="p-4" onClick={(e) => e.stopPropagation()}>
        <JobWorkersSelect
          workerCount={props.job.job.workerCount || 2}
          status={displayStatus()}
          onChange={props.onSetWorkers}
        />
      </td>
      <td class="p-4 text-right" onClick={(e) => e.stopPropagation()}>
        <JobActions
          status={displayStatus()}
          errorCount={props.job.stats.error}
          onPause={props.onPause}
          onResume={props.onResume}
        />
      </td>
    </tr>
  );
}
