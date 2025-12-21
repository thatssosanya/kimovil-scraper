import { Show } from "solid-js";

interface JobsHeaderProps {
  jobCount: number;
  activeCount: number;
  expanded: boolean;
  onToggle: () => void;
}

export function JobsHeader(props: JobsHeaderProps) {
  return (
    <button
      class="flex items-center gap-2 text-lg font-semibold text-slate-200 hover:text-white transition-colors group w-full text-left"
      onClick={props.onToggle}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class={`h-5 w-5 transition-transform duration-300 ${
          props.expanded ? "rotate-90" : ""
        }`}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      All Jobs
      <Show when={props.jobCount > 0}>
        <span class="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-700">
          {props.jobCount}
        </span>
      </Show>
      <Show when={props.activeCount > 0}>
        <span class="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded-full border border-indigo-500/20 animate-pulse">
          {props.activeCount} active
        </span>
      </Show>
    </button>
  );
}
