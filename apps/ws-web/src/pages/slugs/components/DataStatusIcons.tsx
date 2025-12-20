import { Show } from "solid-js";
import type { ScrapeStatus } from "../types";

interface DataStatusIconsProps {
  status?: ScrapeStatus;
}

interface StatusBadgeProps {
  active: boolean;
  color: "slate" | "cyan" | "violet" | "emerald" | "rose";
  title: string;
  children: any;
}

function StatusBadge(props: StatusBadgeProps) {
  const colorClasses = {
    slate: {
      active: "bg-slate-700/60 text-slate-300 ring-slate-500/30",
      inactive: "bg-slate-800/40 text-slate-600 ring-slate-700/20",
    },
    cyan: {
      active: "bg-cyan-950/60 text-cyan-400 ring-cyan-500/30",
      inactive: "bg-slate-800/40 text-slate-600 ring-slate-700/20",
    },
    violet: {
      active: "bg-violet-950/60 text-violet-400 ring-violet-500/30",
      inactive: "bg-slate-800/40 text-slate-600 ring-slate-700/20",
    },
    emerald: {
      active: "bg-emerald-950/60 text-emerald-400 ring-emerald-500/30",
      inactive: "bg-slate-800/40 text-slate-600 ring-slate-700/20",
    },
    rose: {
      active: "bg-rose-950/60 text-rose-400 ring-rose-500/30",
      inactive: "bg-slate-800/40 text-slate-600 ring-slate-700/20",
    },
  };

  const colors = colorClasses[props.color];

  return (
    <div
      class={`
        w-6 h-6 rounded-md flex items-center justify-center
        ring-1 transition-all duration-200
        ${props.active ? colors.active : colors.inactive}
      `}
      title={props.title}
    >
      {props.children}
    </div>
  );
}

export function DataStatusIcons(props: DataStatusIconsProps) {
  const status = () => props.status;

  // Determine verification state
  const verificationStatus = () => {
    if (status()?.isCorrupted === true) return "corrupted";
    if (status()?.isCorrupted === false) return "valid";
    return null;
  };

  return (
    <div class="flex items-center gap-1">
      {/* HTML */}
      <StatusBadge
        active={!!status()?.hasHtml}
        color="slate"
        title={status()?.hasHtml ? "HTML cached" : "No HTML"}
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </StatusBadge>

      {/* Raw Data */}
      <StatusBadge
        active={!!status()?.hasRawData}
        color="cyan"
        title={status()?.hasRawData ? "Raw data extracted" : "No raw data"}
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </StatusBadge>

      {/* AI Data */}
      <StatusBadge
        active={!!status()?.hasAiData}
        color="violet"
        title={status()?.hasAiData ? "AI processed" : "No AI data"}
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      </StatusBadge>

      {/* Verification Status */}
      <Show when={verificationStatus() === "valid"}>
        <StatusBadge active={true} color="emerald" title="Verified valid">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </StatusBadge>
      </Show>

      <Show when={verificationStatus() === "corrupted"}>
        <StatusBadge
          active={true}
          color="rose"
          title={status()?.corruptionReason || "Corrupted"}
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </StatusBadge>
      </Show>
    </div>
  );
}
