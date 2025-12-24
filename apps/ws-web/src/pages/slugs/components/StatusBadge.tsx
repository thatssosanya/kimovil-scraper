import type { QueueItem, ScrapeStatus } from "../types";

interface StatusBadgeProps {
  queueItem?: QueueItem;
  scrapeStatus?: ScrapeStatus;
}

export function StatusBadge(props: StatusBadgeProps) {
  const item = props.queueItem;
  const status = props.scrapeStatus;

  if (item) {
    const colors = {
      pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      running:
        "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse",
      done: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      error: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    };
    const labels = {
      pending: "Pending",
      running: "Running",
      done: "Done",
      error: "Error",
    };
    return (
      <span
        class={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[item.status]}`}
      >
        <span
          class={`w-1.5 h-1.5 rounded-full ${item.status === "running" ? "bg-indigo-400" : "bg-current"}`}
        ></span>
        {labels[item.status]}
        <span class="opacity-70 ml-0.5 text-[10px] uppercase tracking-wider">
          ({item.mode})
        </span>
      </span>
    );
  }

  if (status?.isCorrupted) {
    return (
      <span
        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"
        title={status.corruptionReason || undefined}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Corrupted
      </span>
    );
  }

  if (status?.hasHtml) {
    if (status.isCorrupted === false) {
      return (
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          Valid
        </span>
      );
    }
    return (
      <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Has HTML
      </span>
    );
  }

  return (
    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-slate-800 text-zinc-500 dark:text-slate-500 border border-zinc-200 dark:border-slate-700/50">
      Not Scraped
    </span>
  );
}
