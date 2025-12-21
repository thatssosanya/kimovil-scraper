import { Show } from "solid-js";
import {
  type DisplayStatus,
  statusPillClass,
  statusDotClass,
  statusLabel,
} from "./jobViewHelpers";

interface JobStatusBadgeProps {
  status: DisplayStatus;
  hasErrors: boolean;
  errorCount?: number;
  errorMessage?: string | null;
  onShowErrors?: () => void;
}

export function JobStatusBadge(props: JobStatusBadgeProps) {
  return (
    <div class="flex flex-col gap-1">
      <span
        class={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border inline-flex items-center gap-1.5 w-fit ${statusPillClass(props.status, props.hasErrors)}`}
      >
        <span class={`w-1.5 h-1.5 rounded-full ${statusDotClass(props.status)}`} />
        {statusLabel(props.status, props.hasErrors)}
      </span>
      <Show when={(props.errorCount ?? 0) > 0 && props.onShowErrors}>
        <button
          class="text-[10px] text-rose-400 font-medium hover:text-rose-300 hover:underline text-left"
          onClick={(e) => {
            e.stopPropagation();
            props.onShowErrors!();
          }}
        >
          {props.errorCount} failed items
          {props.status === "done" ? " (retryable)" : ""}
        </button>
      </Show>
      <Show when={props.errorMessage}>
        <div
          class="text-rose-400 text-xs max-w-[200px] truncate"
          title={props.errorMessage!}
        >
          {props.errorMessage}
        </div>
      </Show>
    </div>
  );
}
