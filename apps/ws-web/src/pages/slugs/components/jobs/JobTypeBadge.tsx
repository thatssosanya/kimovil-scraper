import { getJobTypeBadgeConfig, jobTypeLabel } from "./jobViewHelpers";

interface JobTypeBadgeProps {
  jobType: string;
  batchStatus?: string;
  source?: string;
  dataKind?: string;
}

function ScrapeIcon() {
  return (
    <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M2 8h12M8 2v12" stroke-linecap="round" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="8" cy="8" r="6" opacity="0.4" />
    </svg>
  );
}

function ExtractIcon() {
  return (
    <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M4 2h8v12H4z" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6 5h4M6 8h4M6 11h2" stroke-linecap="round" opacity="0.7" />
    </svg>
  );
}

function AIIcon() {
  return (
    <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M8 2L14 8L8 14L2 8Z" stroke-linejoin="round" />
      <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M8 2v12M5 5c0-1 1-2 3-2s3 1 3 2-1 2-3 2-3 1-3 2 1 2 3 2 3-1 3-2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M6 10l4-4" stroke-linecap="round" />
      <path d="M9 4h3v3M4 9v3h3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function DiscoverIcon() {
  return (
    <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l4 4" stroke-linecap="round" />
      <path d="M7 5v4M5 7h4" stroke-linecap="round" opacity="0.6" />
    </svg>
  );
}

const iconMap = {
  scrape: ScrapeIcon,
  extract: ExtractIcon,
  ai: AIIcon,
  price: PriceIcon,
  link: LinkIcon,
  discover: DiscoverIcon,
};

export function JobTypeBadge(props: JobTypeBadgeProps) {
  const config = () => getJobTypeBadgeConfig(props.jobType, props.source, props.dataKind);

  const renderIcon = () => {
    const IconComponent = iconMap[config().icon];
    return <IconComponent />;
  };

  return (
    <span
      class={`
        px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider
        border inline-flex items-center gap-1.5 w-fit
        shadow-sm hover:shadow-md transition-shadow
        ${config().bgClass} ${config().textClass} ${config().borderClass} ${config().glowClass}
      `}
    >
      <span class="opacity-80">
        {renderIcon()}
      </span>
      {jobTypeLabel(props.jobType, props.batchStatus, props.source, props.dataKind)}
    </span>
  );
}
