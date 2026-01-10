import { createMemo, Show } from "solid-js";

export interface SparklinePoint {
  bucket: string;
  value: number;
}

export interface SparklineChartProps {
  data: SparklinePoint[];
  color?: "indigo" | "cyan" | "emerald" | "amber" | "rose";
  height?: number;
  showArea?: boolean;
  showTooltip?: boolean;
  formatValue?: (value: number) => string;
  formatTime?: (bucket: string) => string;
}

const colorConfig = {
  indigo: {
    stroke: "#6366f1",
    fill: "url(#gradient-indigo)",
    dot: "#6366f1",
    glow: "rgba(99, 102, 241, 0.4)",
  },
  cyan: {
    stroke: "#06b6d4",
    fill: "url(#gradient-cyan)",
    dot: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.4)",
  },
  emerald: {
    stroke: "#10b981",
    fill: "url(#gradient-emerald)",
    dot: "#10b981",
    glow: "rgba(16, 185, 129, 0.4)",
  },
  amber: {
    stroke: "#f59e0b",
    fill: "url(#gradient-amber)",
    dot: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.4)",
  },
  rose: {
    stroke: "#f43f5e",
    fill: "url(#gradient-rose)",
    dot: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.4)",
  },
};

export function SparklineChart(props: SparklineChartProps) {
  const height = () => props.height ?? 48;
  const color = () => props.color ?? "indigo";
  const showArea = () => props.showArea ?? true;

  const padding = { left: 0, right: 0, top: 4, bottom: 4 };
  const width = 200;

  const points = createMemo(() => {
    const data = props.data;
    if (data.length === 0) return [];

    const values = data.map((d) => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const chartHeight = height() - padding.top - padding.bottom;
    const chartWidth = width - padding.left - padding.right;

    return data.map((d, i) => ({
      x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
      y: padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight,
      value: d.value,
      bucket: d.bucket,
    }));
  });

  const linePath = createMemo(() => {
    const pts = points();
    if (pts.length === 0) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  });

  const areaPath = createMemo(() => {
    const pts = points();
    if (pts.length === 0) return "";
    const chartBottom = height() - padding.bottom;
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${linePath()} L ${last.x.toFixed(2)} ${chartBottom} L ${first.x.toFixed(2)} ${chartBottom} Z`;
  });

  const lastPoint = createMemo(() => {
    const pts = points();
    return pts.length > 0 ? pts[pts.length - 1] : null;
  });

  const cfg = () => colorConfig[color()];

  return (
    <div class="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height()}`}
        class="w-full"
        style={{ height: `${height()}px` }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="gradient-indigo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(99, 102, 241, 0.3)" />
            <stop offset="100%" stop-color="rgba(99, 102, 241, 0)" />
          </linearGradient>
          <linearGradient id="gradient-cyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(6, 182, 212, 0.3)" />
            <stop offset="100%" stop-color="rgba(6, 182, 212, 0)" />
          </linearGradient>
          <linearGradient id="gradient-emerald" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(16, 185, 129, 0.3)" />
            <stop offset="100%" stop-color="rgba(16, 185, 129, 0)" />
          </linearGradient>
          <linearGradient id="gradient-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(245, 158, 11, 0.3)" />
            <stop offset="100%" stop-color="rgba(245, 158, 11, 0)" />
          </linearGradient>
          <linearGradient id="gradient-rose" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(244, 63, 94, 0.3)" />
            <stop offset="100%" stop-color="rgba(244, 63, 94, 0)" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Show when={showArea() && areaPath()}>
          <path d={areaPath()} fill={cfg().fill} class="transition-all duration-300" />
        </Show>

        <Show when={linePath()}>
          <path
            d={linePath()}
            fill="none"
            stroke={cfg().stroke}
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all duration-300"
            filter="url(#glow)"
          />
        </Show>

        <Show when={lastPoint()}>
          <circle
            cx={lastPoint()!.x}
            cy={lastPoint()!.y}
            r="3"
            fill={cfg().dot}
            class="animate-pulse"
          />
          <circle cx={lastPoint()!.x} cy={lastPoint()!.y} r="5" fill={cfg().glow} class="animate-ping" />
        </Show>
      </svg>

      <Show when={props.data.length === 0}>
        <div class="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 dark:text-slate-500">
          No data
        </div>
      </Show>
    </div>
  );
}

export function MiniStatCard(props: {
  label: string;
  value: string | number;
  data: SparklinePoint[];
  color?: "indigo" | "cyan" | "emerald" | "amber" | "rose";
  loading?: boolean;
  trend?: { value: number; label: string };
}) {
  const colorClasses = {
    indigo: "text-indigo-600 dark:text-indigo-400",
    cyan: "text-cyan-600 dark:text-cyan-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
  };

  const trendColorClasses = {
    positive: "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
    negative: "text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20",
    neutral: "text-zinc-500 dark:text-slate-400 bg-zinc-100 dark:bg-slate-800",
  };

  const getTrendType = () => {
    if (!props.trend) return "neutral";
    if (props.trend.value > 0) return "positive";
    if (props.trend.value < 0) return "negative";
    return "neutral";
  };

  return (
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-slate-800 p-4 overflow-hidden relative">
      <div class="flex items-start justify-between mb-2">
        <div class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wide">
          {props.label}
        </div>
        <Show when={props.trend}>
          <span
            class={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${trendColorClasses[getTrendType()]}`}
          >
            {props.trend!.value > 0 ? "+" : ""}
            {props.trend!.value.toFixed(1)}%
          </span>
        </Show>
      </div>

      <div class="flex items-end justify-between gap-3">
        <div
          class={`text-2xl font-bold tabular-nums ${props.color ? colorClasses[props.color] : "text-zinc-900 dark:text-white"}`}
        >
          <Show when={!props.loading} fallback={<span class="text-zinc-300 dark:text-slate-600">—</span>}>
            {typeof props.value === "number" ? props.value.toLocaleString() : props.value}
          </Show>
        </div>

        <div class="flex-1 max-w-[120px] min-w-[80px]">
          <Show
            when={!props.loading}
            fallback={
              <div class="h-12 bg-zinc-100 dark:bg-slate-800 rounded animate-pulse" />
            }
          >
            <SparklineChart data={props.data} color={props.color ?? "indigo"} height={48} />
          </Show>
        </div>
      </div>

      <Show when={props.trend}>
        <div class="text-[10px] text-zinc-400 dark:text-slate-500 mt-1">{props.trend!.label}</div>
      </Show>
    </div>
  );
}
