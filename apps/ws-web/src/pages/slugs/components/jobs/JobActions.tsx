import { Show } from "solid-js";
import type { DisplayStatus } from "./jobViewHelpers";

interface JobActionsProps {
  status: DisplayStatus;
  errorCount: number;
  onPause: () => void;
  onResume: () => void;
}

export function JobActions(props: JobActionsProps) {
  return (
    <>
      <Show when={props.status === "running"}>
        <button
          class="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-amber-500/20"
          onClick={props.onPause}
        >
          Pause
        </button>
      </Show>
      <Show when={props.status === "pausing"}>
        <button
          class="text-amber-400/50 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-500/10 cursor-not-allowed"
          disabled
        >
          Pausing…
        </button>
      </Show>
      <Show when={props.status === "paused" || props.status === "error"}>
        <button
          class="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-emerald-500/20"
          onClick={props.onResume}
        >
          {props.status === "error" ? "Retry" : "Resume"}
        </button>
      </Show>
      <Show when={props.status === "done" && props.errorCount > 0}>
        <button
          class="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-rose-500/20"
          onClick={props.onResume}
        >
          Retry {props.errorCount} Failed
        </button>
      </Show>
    </>
  );
}
