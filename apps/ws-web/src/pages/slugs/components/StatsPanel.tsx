import { Show } from "solid-js";
import type { Stats, ScrapeStats } from "../types";

interface StatsPanelProps {
  stats: Stats | null;
  scrapeStats: ScrapeStats | null;
}

export function StatsPanel(props: StatsPanelProps) {
  return (
    <Show when={props.stats}>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
          <div class="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-colors"></div>
          <div class="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
            Total Devices
          </div>
          <div class="text-3xl font-bold text-slate-100">
            {props.stats!.devices.toLocaleString()}
          </div>
        </div>

        <Show when={props.scrapeStats}>
          <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-colors">
            <div class="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-colors"></div>
            <div class="text-sm font-medium text-cyan-500 uppercase tracking-wider mb-1">
              Scraped
            </div>
            <div class="text-3xl font-bold text-cyan-100">
              {props.scrapeStats!.scraped.toLocaleString()}
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div class="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-colors"></div>
            <div class="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-1">
              Valid
            </div>
            <div class="text-3xl font-bold text-emerald-100">
              {props.scrapeStats!.valid.toLocaleString()}
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-rose-500/30 transition-colors">
            <div class="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-colors"></div>
            <div class="text-sm font-medium text-rose-500 uppercase tracking-wider mb-1">
              Corrupted
            </div>
            <div class="text-3xl font-bold text-rose-100">
              {props.scrapeStats!.corrupted.toLocaleString()}
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
