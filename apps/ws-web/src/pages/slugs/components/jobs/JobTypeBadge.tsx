import { jobTypeBadgeClass, jobTypeLabel } from "./jobViewHelpers";

interface JobTypeBadgeProps {
  jobType: string;
  batchStatus?: string;
}

export function JobTypeBadge(props: JobTypeBadgeProps) {
  return (
    <span
      class={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border inline-flex items-center gap-1.5 w-fit ${jobTypeBadgeClass(props.jobType)}`}
    >
      {jobTypeLabel(props.jobType, props.batchStatus)}
    </span>
  );
}
