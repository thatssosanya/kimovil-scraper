import { For } from "solid-js";
import { type DisplayStatus, isActiveStatus } from "./jobViewHelpers";

interface JobWorkersSelectProps {
  workerCount: number;
  status: DisplayStatus;
  onChange: (count: number) => void;
}

const WORKER_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50];

export function JobWorkersSelect(props: JobWorkersSelectProps) {
  const disabled = () => !isActiveStatus(props.status);

  return (
    <select
      class="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      value={props.workerCount}
      disabled={disabled()}
      onChange={(e) => props.onChange(parseInt(e.currentTarget.value))}
    >
      <For each={WORKER_OPTIONS}>{(num) => <option value={num}>{num}</option>}</For>
    </select>
  );
}
