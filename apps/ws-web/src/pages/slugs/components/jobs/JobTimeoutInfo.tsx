import { Show } from "solid-js";

interface JobTimeoutInfoProps {
  timeout: { count: number; nextRetryAt: number | null } | undefined;
  formatTimeRemaining: (timestamp: number | null) => string;
}

export function JobTimeoutInfo(props: JobTimeoutInfoProps) {
  return (
    <Show when={props.timeout?.count}>
      <div class="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-400 font-medium animate-in fade-in slide-in-from-top-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3 w-3"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clip-rule="evenodd"
          />
        </svg>
        <span>
          {props.timeout!.count} timeout
          <span class="opacity-70 ml-1 font-mono">
            ({props.formatTimeRemaining(props.timeout!.nextRetryAt)})
          </span>
        </span>
      </div>
    </Show>
  );
}
