function StatCard(props: { label: string; value: number; color?: "emerald" | "amber" | "rose" }) {
  const colorClasses = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
  };

  return (
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4">
      <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide">
        {props.label}
      </div>
      <div
        class={`text-2xl font-bold mt-1 ${props.color ? colorClasses[props.color] : "text-zinc-900 dark:text-white"}`}
      >
        {props.value.toLocaleString()}
      </div>
    </div>
  );
}

export function StatsRow(props: { total: number; needsReviewCount: number; confirmedCount: number }) {
  return (
    <div class="grid grid-cols-3 gap-4 mb-6">
      <StatCard label="Total Mappings" value={props.total} />
      <StatCard label="Needs Review" value={props.needsReviewCount} color="amber" />
      <StatCard label="Confirmed" value={props.confirmedCount} color="emerald" />
    </div>
  );
}
