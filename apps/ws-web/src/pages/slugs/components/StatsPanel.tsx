import { Show } from "solid-js";
import type { Stats, ScrapeStats, FilterType } from "../types";

interface StatsPanelProps {
  stats: Stats | null;
  scrapeStats: ScrapeStats | null;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

function PipelineConnector() {
  return (
    <div class="hidden lg:flex items-center justify-center w-8 -mx-1">
      <svg class="w-6 h-6 text-zinc-400 dark:text-slate-600" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12h14m-4-4l4 4-4 4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: "indigo" | "slate" | "cyan" | "violet" | "emerald" | "rose";
  icon: "devices" | "html" | "code" | "sparkle" | "check" | "x";
  sublabel?: string;
  pipelinePosition?: "start" | "middle" | "end" | "isolated";
  onClick?: () => void;
  active?: boolean;
}

function StatCard(props: StatCardProps) {
  const colorClasses = {
    indigo: {
      glow: "bg-indigo-500/8",
      border: "border-indigo-500/20 hover:border-indigo-500/40",
      text: "text-indigo-400",
      value: "text-indigo-50",
      icon: "text-indigo-400/80",
    },
    slate: {
      glow: "bg-zinc-500/8 dark:bg-slate-500/8",
      border: "border-zinc-300 dark:border-slate-600/30 hover:border-zinc-400 dark:hover:border-slate-500/50",
      text: "text-zinc-500 dark:text-slate-400",
      value: "text-zinc-900 dark:text-slate-100",
      icon: "text-zinc-500/80 dark:text-slate-400/80",
    },
    cyan: {
      glow: "bg-cyan-500/8",
      border: "border-cyan-500/20 hover:border-cyan-500/40",
      text: "text-cyan-400",
      value: "text-cyan-50",
      icon: "text-cyan-400/80",
    },
    violet: {
      glow: "bg-violet-500/8",
      border: "border-violet-500/20 hover:border-violet-500/40",
      text: "text-violet-400",
      value: "text-violet-50",
      icon: "text-violet-400/80",
    },
    emerald: {
      glow: "bg-emerald-500/8",
      border: "border-emerald-500/20 hover:border-emerald-500/40",
      text: "text-emerald-400",
      value: "text-emerald-50",
      icon: "text-emerald-400/80",
    },
    rose: {
      glow: "bg-rose-500/8",
      border: "border-rose-500/20 hover:border-rose-500/40",
      text: "text-rose-400",
      value: "text-rose-50",
      icon: "text-rose-400/80",
    },
  };

  const icons = {
    devices: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    html: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    code: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    sparkle: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    check: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    x: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const colors = colorClasses[props.color];

  return (
    <div
      onClick={props.onClick}
      class={`
        relative overflow-hidden rounded-xl border bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm
        p-4 transition-all duration-300 group
        ${props.onClick ? "cursor-pointer" : "cursor-default"}
        ${colors.border}
        ${props.active ? "ring-2 ring-offset-1 ring-offset-zinc-50 dark:ring-offset-slate-950 ring-" + props.color + "-500" : ""}
      `}
    >
      {/* Glow effect */}
      <div class={`absolute inset-0 ${colors.glow} ${props.active ? "opacity-100" : "opacity-0"} group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Content */}
      <div class="relative z-10">
        <div class="flex items-center justify-between mb-3">
          <span class={`text-[11px] font-semibold uppercase tracking-wider ${colors.text}`}>
            {props.label}
          </span>
          <div class={colors.icon}>{icons[props.icon]}</div>
        </div>
        <div class={`text-2xl font-bold tabular-nums tracking-tight ${colors.value}`}>
          {props.value.toLocaleString()}
        </div>
        <Show when={props.sublabel}>
          <div class="text-[10px] text-zinc-500 dark:text-slate-500 mt-1 font-medium">
            {props.sublabel}
          </div>
        </Show>
      </div>
    </div>
  );
}

export function StatsPanel(props: StatsPanelProps) {
  return (
    <Show when={props.stats}>
      <div class="space-y-4">
        {/* Pipeline Section Label */}
        <div class="flex items-center gap-3">
          <div class="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 dark:via-slate-700 to-transparent" />
          <span class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-slate-500">
            Data Pipeline
          </span>
          <div class="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 dark:via-slate-700 to-transparent" />
        </div>

        {/* Main Pipeline Flow */}
        <div class="flex flex-col lg:flex-row items-stretch gap-3">
          {/* Total Devices - Entry Point */}
          <div class="lg:w-44 shrink-0">
            <StatCard
              label="Devices"
              value={props.stats!.devices}
              color="indigo"
              icon="devices"
              sublabel="Total in database"
              onClick={() => props.onFilterChange("all")}
              active={props.activeFilter === "all"}
            />
          </div>

          <Show when={props.scrapeStats}>
            <PipelineConnector />

            {/* Pipeline Stages */}
            <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                label="HTML"
                value={props.scrapeStats!.scraped}
                color="slate"
                icon="html"
                sublabel="Pages cached"
                onClick={() => props.onFilterChange("scraped")}
                active={props.activeFilter === "scraped"}
              />
              <StatCard
                label="Raw Data"
                value={props.scrapeStats!.rawData ?? 0}
                color="cyan"
                icon="code"
                sublabel="Extracted"
                onClick={() => props.onFilterChange("has_raw")}
                active={props.activeFilter === "has_raw"}
              />
              <StatCard
                label="AI Data"
                value={props.scrapeStats!.aiData ?? 0}
                color="violet"
                icon="sparkle"
                sublabel="Normalized"
                onClick={() => props.onFilterChange("has_ai")}
                active={props.activeFilter === "has_ai"}
              />
            </div>

            <PipelineConnector />

            {/* Validation Results */}
            <div class="grid grid-cols-2 gap-3 lg:w-64 shrink-0">
              <StatCard
                label="Valid"
                value={props.scrapeStats!.valid}
                color="emerald"
                icon="check"
                onClick={() => props.onFilterChange("valid")}
                active={props.activeFilter === "valid"}
              />
              <StatCard
                label="Errors"
                value={props.scrapeStats!.corrupted}
                color="rose"
                icon="x"
                onClick={() => props.onFilterChange("corrupted")}
                active={props.activeFilter === "corrupted"}
              />
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
