import type { JobEntry } from "../../hooks/useBulkJobs";
import type { BulkJobInfo, BulkJobStats } from "../../types";

export type DisplayStatus = BulkJobInfo["status"];

export type { JobEntry };

export function getDisplayStatus(item: JobEntry): DisplayStatus {
  return item.job.status;
}

export function isActiveStatus(status: DisplayStatus): boolean {
  return ["running", "paused", "pausing"].includes(status);
}

export function statusLabel(status: DisplayStatus, hasErrors: boolean): string {
  if (status === "done" && hasErrors) return "done w/ errors";
  if (status === "pausing") return "pausing…";
  return status;
}

export function progressPercent(stats: BulkJobStats): number {
  const completed = stats.done + stats.error;
  const total = stats.total || 1;
  return Math.round((completed / total) * 100);
}

export function progressFraction(stats: BulkJobStats): string {
  return `${stats.done + stats.error} / ${stats.total}`;
}

export function statusPillClass(status: DisplayStatus, hasErrors: boolean): string {
  if (status === "running") {
    return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse";
  }
  if (status === "pausing") {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse";
  }
  if (status === "paused") {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  if (status === "done" && hasErrors) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  if (status === "done") {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }
  if (status === "error") {
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  }
  return "bg-slate-800 text-slate-400 border-slate-700";
}

export function statusDotClass(status: DisplayStatus): string {
  if (status === "running") {
    return "bg-indigo-400 animate-pulse";
  }
  if (status === "pausing") {
    return "bg-amber-400 animate-pulse";
  }
  return "bg-current";
}

export function progressBarClass(status: DisplayStatus): string {
  if (status === "error") return "bg-rose-500";
  if (status === "done") return "bg-emerald-500";
  return "bg-indigo-500";
}

export interface JobTypeBadgeConfig {
  bgClass: string;
  textClass: string;
  borderClass: string;
  glowClass: string;
  icon: "scrape" | "extract" | "ai" | "price" | "link" | "discover";
}

export function getJobTypeBadgeConfig(jobType: string, source?: string, dataKind?: string): JobTypeBadgeConfig {
  if (source === "price_ru" && dataKind === "prices") {
    return {
      bgClass: "bg-gradient-to-r from-amber-500/15 to-yellow-500/10",
      textClass: "text-amber-500 dark:text-amber-400",
      borderClass: "border-amber-500/30 dark:border-amber-400/20",
      glowClass: "shadow-amber-500/20",
      icon: "price",
    };
  }
  if (jobType === "scrape") {
    return {
      bgClass: "bg-gradient-to-r from-indigo-500/15 to-blue-500/10",
      textClass: "text-indigo-600 dark:text-indigo-400",
      borderClass: "border-indigo-500/30 dark:border-indigo-400/20",
      glowClass: "shadow-indigo-500/20",
      icon: "scrape",
    };
  }
  if (jobType === "process_raw") {
    return {
      bgClass: "bg-gradient-to-r from-cyan-500/15 to-teal-500/10",
      textClass: "text-cyan-600 dark:text-cyan-400",
      borderClass: "border-cyan-500/30 dark:border-cyan-400/20",
      glowClass: "shadow-cyan-500/20",
      icon: "extract",
    };
  }
  if (jobType === "link_priceru") {
    return {
      bgClass: "bg-gradient-to-r from-orange-500/15 to-red-500/10",
      textClass: "text-orange-600 dark:text-orange-400",
      borderClass: "border-orange-500/30 dark:border-orange-400/20",
      glowClass: "shadow-orange-500/20",
      icon: "link",
    };
  }
  if (jobType === "discover_latest") {
    return {
      bgClass: "bg-gradient-to-r from-emerald-500/15 to-teal-500/10",
      textClass: "text-emerald-600 dark:text-emerald-400",
      borderClass: "border-emerald-500/30 dark:border-emerald-400/20",
      glowClass: "shadow-emerald-500/20",
      icon: "discover",
    };
  }
  return {
    bgClass: "bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10",
    textClass: "text-violet-600 dark:text-violet-400",
    borderClass: "border-violet-500/30 dark:border-violet-400/20",
    glowClass: "shadow-violet-500/20",
    icon: "ai",
  };
}

export function jobTypeBadgeClass(jobType: string, source?: string, dataKind?: string): string {
  const config = getJobTypeBadgeConfig(jobType, source, dataKind);
  return `${config.bgClass} ${config.textClass} ${config.borderClass}`;
}

export function jobTypeLabel(jobType: string, batchStatus?: string, source?: string, dataKind?: string): string {
  if (source === "price_ru" && dataKind === "prices") return "price.ru prices";
  if (jobType === "scrape") return "Scrape";
  if (jobType === "process_raw") return "Extract";
  if (jobType === "link_priceru") return "price.ru link";
  if (jobType === "discover_latest") return "Discover";
  return batchStatus ? `AI (${batchStatus})` : "AI";
}
