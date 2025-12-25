import { jobTypeBadgeClass, jobTypeLabel } from "./jobViewHelpers";

interface JobTypeBadgeProps {
  jobType: string;
  batchStatus?: string;
  source?: string;
  dataKind?: string;
}

export function JobTypeBadge(props: JobTypeBadgeProps) {
  return (
    <span
      class={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border inline-flex items-center gap-1.5 w-fit ${jobTypeBadgeClass(props.jobType, props.source, props.dataKind)}`}
    >
      {jobTypeLabel(props.jobType, props.batchStatus, props.source, props.dataKind)}
    </span>
  );
}
