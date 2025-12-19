import { For, Show } from "solid-js";
import type { FilterType, ScrapeStats } from "../types";

interface SearchBarProps {
  search: string;
  filter: FilterType;
  loading: boolean;
  scrapeStats: ScrapeStats | null;
  total: number;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: FilterType) => void;
  onSearch: () => void;
  onClear: () => void;
}

const filterButtons: { key: FilterType; label: string }[] = [
  { key: "all", label: "All Devices" },
  { key: "scraped", label: "Scraped" },
  { key: "valid", label: "Valid" },
  { key: "corrupted", label: "Corrupted" },
  { key: "unscraped", label: "Unscraped" },
];

export function SearchBar(props: SearchBarProps) {
  return (
    <div class="flex flex-col md:flex-row gap-4">
      <div class="flex-1 relative group">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <input
          type="text"
          value={props.search}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && props.onSearch()}
          placeholder="Search by name, slug, or brand..."
          class="w-full pl-10 pr-4 py-2.5 bg-slate-900 rounded-xl text-slate-200 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600"
        />
      </div>

      <div class="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
        <For each={filterButtons}>
          {(btn) => (
            <button
              class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                props.filter === btn.key
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              onClick={() => props.onFilterChange(btn.key)}
            >
              {btn.label}
              <Show when={btn.key !== "all" && props.scrapeStats}>
                <span
                  class={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    props.filter === btn.key
                      ? "bg-slate-600/50 text-white"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {btn.key === "corrupted"
                    ? props.scrapeStats!.corrupted
                    : btn.key === "valid"
                      ? props.scrapeStats!.valid
                      : btn.key === "scraped"
                        ? props.scrapeStats!.scraped
                        : props.total - props.scrapeStats!.scraped}
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>

      <div class="flex gap-2">
        <button
          class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          onClick={props.onSearch}
          disabled={props.loading}
        >
          Search
        </button>
        <button
          class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-700 transition-all active:scale-95 cursor-pointer"
          onClick={props.onClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
