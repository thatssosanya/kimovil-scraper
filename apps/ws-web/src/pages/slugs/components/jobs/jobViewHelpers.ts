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

export function jobTypeBadgeClass(jobType: string): string {
  if (jobType === "scrape") {
    return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  }
  if (jobType === "process_raw") {
    return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  }
  return "bg-violet-500/10 text-violet-400 border-violet-500/20";
}

export function jobTypeLabel(jobType: string, batchStatus?: string): string {
  if (jobType === "scrape") return "Scrape";
  if (jobType === "process_raw") return "Extract";
  return batchStatus ? `AI (${batchStatus})` : "AI";
}
