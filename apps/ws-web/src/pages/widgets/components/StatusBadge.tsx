import type { MappingStatus } from "../WidgetDebug.types";

const statusStyles: Record<MappingStatus, string> = {
  pending: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
  suggested: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  auto_confirmed: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
  confirmed: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  ignored: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 line-through",
};

const statusLabels: Record<MappingStatus, string> = {
  pending: "Pending",
  suggested: "Suggested",
  auto_confirmed: "Auto",
  confirmed: "Confirmed",
  ignored: "Ignored",
};

export function StatusBadge(props: { status: MappingStatus }) {
  return (
    <span class={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusStyles[props.status]}`}>
      {statusLabels[props.status]}
    </span>
  );
}
