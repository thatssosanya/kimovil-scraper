import { Show, createMemo } from "solid-js";
import { JobsHeader } from "./JobsHeader";
import { JobsTable } from "./JobsTable";
import { SelectedJobPanel } from "./SelectedJobPanel";
import { type JobEntry, getDisplayStatus, isActiveStatus } from "./jobViewHelpers";

interface JobsSectionProps {
  allJobs: JobEntry[];
  selectedJobId: string | null;
  selectedJob: JobEntry | null;
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
  const totalJobs = createMemo(() => props.allJobs.length);
  const activeJobsCount = createMemo(() =>
    props.allJobs.filter((j) => isActiveStatus(getDisplayStatus(j))).length
  );

  return (
    <div class="space-y-4">
      <JobsHeader
        jobCount={totalJobs()}
        activeCount={activeJobsCount()}
        expanded={props.jobsExpanded}
        onToggle={props.onToggleExpanded}
      />

      <Show when={props.jobsExpanded}>
        <JobsTable
          jobs={props.allJobs}
          selectedJobId={props.selectedJobId}
          onSelectJob={props.onSelectJob}
          onPause={props.onPause}
          onResume={props.onResume}
          onSetWorkers={props.onSetWorkers}
          onShowErrors={props.onShowErrors}
          formatTimeRemaining={props.formatTimeRemaining}
        />

        <Show when={props.selectedJob}>
          {(job) => (
            <SelectedJobPanel
              job={job()}
              onClose={props.onDeselectJob}
              onPause={() => props.onPause(job().job.id)}
              onResume={() => props.onResume(job().job.id)}
              onSetWorkers={(count) => props.onSetWorkers(job().job.id, count)}
              onShowErrors={() => props.onShowErrors(job().job.id)}
              formatTimeRemaining={props.formatTimeRemaining}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}
