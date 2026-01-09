import { Show, For } from "solid-js";
import { useMappingModal } from "./MappingModalContext";

export function LeftColumn() {
  const ctx = useMappingModal();

  return (
    <div class="flex flex-col h-full overflow-hidden border-r border-zinc-200 dark:border-slate-800">
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Posts Section */}
        <div class="flex flex-col">
          <div class="flex items-baseline justify-between mb-4">
            <h3 class="text-[11px] font-semibold text-zinc-400 dark:text-slate-500 uppercase tracking-[0.08em]">
              Posts with this widget
            </h3>
            <span class="text-[11px] font-medium text-zinc-300 dark:text-slate-600 tabular-nums">
              {ctx.posts().length}
            </span>
          </div>
          <Show when={ctx.posts().length > 0} fallback={
            <div class="flex items-center justify-center py-8 px-4">
              <p class="text-sm text-zinc-400 dark:text-slate-500 italic">
                No posts found
              </p>
            </div>
          }>
            <div class="space-y-1.5 max-h-64 overflow-y-auto posts-scrollbar pr-1">
              <For each={ctx.posts()}>
                {(post) => (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-zinc-50/50 dark:bg-slate-800/40 border border-transparent hover:border-zinc-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/70 transition-all duration-150"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-[13px] font-medium text-zinc-700 dark:text-slate-300 truncate leading-snug group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                        {post.title}
                      </p>
                      <time class="text-[11px] text-zinc-400 dark:text-slate-500 tabular-nums mt-0.5 block">
                        {new Date(post.dateGmt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </time>
                    </div>
                    <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <svg class="w-4 h-4 text-zinc-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </div>
                  </a>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Suggested Matches - hide when already confirmed */}
        <Show when={ctx.mapping()?.status !== "confirmed"}>
          <div>
            <div class="text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Suggested Matches
            </div>
            <Show when={ctx.suggestions().length > 0} fallback={
              <div class="text-sm text-zinc-400 dark:text-slate-500 italic py-2">
                No matching devices found
              </div>
            }>
              <div class="space-y-1.5">
                <For each={ctx.suggestions()}>
                  {(suggestion, idx) => (
                    <button
                      onClick={() => ctx.selectSuggestion(suggestion)}
                      class={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 ${
                        ctx.selectedDeviceId() === suggestion.deviceId
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500/20"
                          : "border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-zinc-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div
                            class={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                              ctx.selectedDeviceId() === suggestion.deviceId
                                ? "border-indigo-500 bg-indigo-500"
                                : "border-zinc-300 dark:border-slate-600"
                            }`}
                          />
                          <div class="min-w-0">
                            <div class="flex items-center gap-2">
                              <span class="font-medium text-sm text-zinc-900 dark:text-white truncate">
                                {suggestion.name}
                              </span>
                              <Show when={idx() === 0 && suggestion.confidence >= 0.97}>
                                <span class="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-semibold uppercase">
                                  Best
                                </span>
                              </Show>
                            </div>
                            <div class="text-xs text-zinc-400 dark:text-slate-500 font-mono truncate">
                              {suggestion.slug}
                            </div>
                          </div>
                        </div>
                        <span
                          class={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                            suggestion.confidence >= 0.9
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                              : suggestion.confidence >= 0.7
                              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                              : "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-400"
                          }`}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </span>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* Device Search */}
        <div>
          <div class="text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Search All Devices
          </div>
          <div class="relative">
            <input
              type="text"
              placeholder="Search by name or slug..."
              value={ctx.deviceSearch()}
              onInput={(e) => ctx.handleDeviceSearch(e.currentTarget.value)}
              class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-slate-500"
            />
            <Show when={ctx.searchLoading()}>
              <div class="absolute right-3 top-1/2 -translate-y-1/2">
                <div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </Show>
          </div>
          <Show when={ctx.searchResults().length > 0}>
            <div class="mt-2 border border-zinc-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
              <For each={ctx.searchResults()}>
                {(result) => (
                  <button
                    onClick={() => ctx.selectSearchResult(result)}
                    class="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-slate-800 transition-colors border-b last:border-b-0 border-zinc-100 dark:border-slate-800"
                  >
                    <div class="flex items-center justify-between">
                      <div class="min-w-0">
                        <div class="font-medium text-zinc-900 dark:text-white text-sm truncate">
                          {result.name}
                        </div>
                        <div class="text-xs text-zinc-400 dark:text-slate-500 font-mono truncate">
                          {result.slug}
                        </div>
                      </div>
                      <Show when={result.brand}>
                        <span class="text-xs text-zinc-500 dark:text-slate-400 flex-shrink-0 ml-2 bg-zinc-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {result.brand}
                        </span>
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      {/* Actions Footer */}
      <div class="flex-shrink-0 p-4 bg-white dark:bg-slate-900 border-t border-zinc-200 dark:border-slate-800">
        <Show when={ctx.mapping()?.status === "confirmed"} fallback={
          <div class="flex items-center justify-between gap-3">
            <button
              onClick={ctx.closeModal}
              disabled={ctx.actionLoading()}
              class="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <div class="flex items-center gap-2">
              <button
                onClick={ctx.handleIgnore}
                disabled={ctx.actionLoading()}
                class="px-4 py-2 text-sm font-medium border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Show when={ctx.actionLoading()}>
                  <div class="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                </Show>
                Ignore
              </button>
              <button
                onClick={ctx.handleConfirm}
                disabled={ctx.actionLoading() || !ctx.selectedDeviceId()}
                class="px-5 py-2 text-sm font-semibold bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/25 flex items-center gap-2"
              >
                <Show when={ctx.actionLoading()}>
                  <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </Show>
                Confirm Match
              </button>
            </div>
          </div>
        }>
          {/* Simplified footer for confirmed mappings */}
          <div class="flex items-center justify-end">
            <button
              onClick={ctx.closeModal}
              class="px-5 py-2 text-sm font-medium bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-slate-700 transition-colors"
            >
              Done
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
