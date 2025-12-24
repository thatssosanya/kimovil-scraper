import { Show } from "solid-js";
import type { ScrapeStatus } from "../types";
import type { TabId } from "./TabBar";

interface DataStatusIconsProps {
  status?: ScrapeStatus;
  onOpenTab?: (tab: TabId) => void;
}

interface StatusBadgeProps {
  active: boolean;
  color: "slate" | "cyan" | "violet" | "emerald" | "rose";
  title: string;
  clickable?: boolean;
  onClick?: (e: MouseEvent) => void;
  children: any;
}

function StatusBadge(props: StatusBadgeProps) {
  const colorClasses = {
    slate: {
      active: "bg-slate-800/80 text-slate-300 border-slate-700",
      activeHover: "hover:bg-slate-700/80 hover:text-slate-200",
      inactive: "bg-transparent text-slate-700 border-transparent",
    },
    cyan: {
      active: "bg-cyan-950/60 text-cyan-400 border-cyan-800/50",
      activeHover: "hover:bg-cyan-900/60 hover:text-cyan-300",
      inactive: "bg-transparent text-slate-700 border-transparent",
    },
    violet: {
      active: "bg-violet-950/60 text-violet-400 border-violet-800/50",
      activeHover: "hover:bg-violet-900/60 hover:text-violet-300",
      inactive: "bg-transparent text-slate-700 border-transparent",
    },
    emerald: {
      active: "bg-emerald-950/60 text-emerald-400 border-emerald-800/50",
      activeHover: "hover:bg-emerald-900/60 hover:text-emerald-300",
      inactive: "bg-transparent text-slate-700 border-transparent",
    },
    rose: {
      active: "bg-rose-950/60 text-rose-400 border-rose-800/50",
      activeHover: "hover:bg-rose-900/60 hover:text-rose-300",
      inactive: "bg-transparent text-slate-700 border-transparent",
    },
  };

  const colors = colorClasses[props.color];
  const isClickable = () => props.clickable && props.active;

  const handleClick = (e: MouseEvent) => {
    if (isClickable() && props.onClick) {
      e.stopPropagation();
      props.onClick(e);
    }
  };

  return (
    <div
      class={`
        flex-1 h-9 flex items-center justify-center
        border-r last:border-r-0 transition-all duration-150
        ${props.active ? colors.active : colors.inactive}
        ${isClickable() ? `cursor-pointer ${colors.activeHover}` : ""}
      `}
      title={props.title}
      onClick={handleClick}
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
    <div class="flex items-center w-full rounded-md overflow-hidden border border-slate-800/50">
      {/* HTML */}
      <StatusBadge
        active={!!status()?.hasHtml}
        color="slate"
        title={status()?.hasHtml ? "HTML cached (click to view)" : "No HTML"}
        clickable={!!props.onOpenTab}
        onClick={() => props.onOpenTab?.("html")}
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </StatusBadge>

      {/* Raw Data */}
      <StatusBadge
        active={!!status()?.hasRawData}
        color="cyan"
        title={status()?.hasRawData ? "Raw data extracted (click to view)" : "No raw data"}
        clickable={!!props.onOpenTab}
        onClick={() => props.onOpenTab?.("raw")}
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </StatusBadge>

      {/* AI Data */}
      <StatusBadge
        active={!!status()?.hasAiData}
        color="violet"
        title={status()?.hasAiData ? "AI processed (click to view)" : "No AI data"}
        clickable={!!props.onOpenTab}
        onClick={() => props.onOpenTab?.("ai")}
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
