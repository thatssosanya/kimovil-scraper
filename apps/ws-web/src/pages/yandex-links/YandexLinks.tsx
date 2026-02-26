import { createSignal, For, Show } from "solid-js";
import { Header } from "../../components/Header";
import {
  searchYandexLinks,
  invalidateYandexSearchCacheByPrefix,
  invalidateYandexSearchCacheAll,
} from "../../api/yandex";

type SearchResultItem = {
  url: string;
  externalId: string;
  priceRubles?: number;
  bonusRubles?: number;
  matchedText?: string;
};

export default function YandexLinks() {
  const [query, setQuery] = createSignal("");
  const [limit, setLimit] = createSignal(10);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [cacheError, setCacheError] = createSignal<string | null>(null);
  const [cacheMessage, setCacheMessage] = createSignal<string | null>(null);
  const [cachePrefix, setCachePrefix] = createSignal("");
  const [cacheInvalidateLoading, setCacheInvalidateLoading] = createSignal(false);
  const [cacheInvalidateAllLoading, setCacheInvalidateAllLoading] = createSignal(false);
  const [results, setResults] = createSignal<SearchResultItem[]>([]);
  const [searchedQuery, setSearchedQuery] = createSignal<string | null>(null);

  const hasExtensionSecret = Boolean(import.meta.env.VITE_EXTENSION_SECRET);

  const handleSearch = async () => {
    const trimmedQuery = query().trim();
    if (!trimmedQuery) return;

    setLoading(true);
    setError(null);

    try {
      const response = await searchYandexLinks({
        query: trimmedQuery,
        limit: Math.max(1, Math.min(30, limit() || 10)),
      });

      if (!response.success) {
        setResults([]);
        setError(response.error ?? "Search failed");
      } else {
        setResults([...(response.links ?? [])]);
        setSearchedQuery(response.query ?? trimmedQuery);
      }
    } catch (cause) {
      setResults([]);
      setError(cause instanceof Error ? cause.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInvalidatePrefix = async () => {
    const prefix = cachePrefix().trim();
    if (!prefix) {
      setCacheError("Prefix is required");
      return;
    }

    setCacheInvalidateLoading(true);
    setCacheError(null);
    setCacheMessage(null);

    try {
      const result = await invalidateYandexSearchCacheByPrefix(prefix);
      setCacheMessage(
        `Invalidated ${result.deleted} entries for prefix "${result.normalizedPrefix}"`,
      );
    } catch (cause) {
      setCacheError(cause instanceof Error ? cause.message : "Failed to invalidate cache by prefix");
    } finally {
      setCacheInvalidateLoading(false);
    }
  };

  const handleInvalidateAll = async () => {
    setCacheInvalidateAllLoading(true);
    setCacheError(null);
    setCacheMessage(null);

    try {
      const result = await invalidateYandexSearchCacheAll();
      setCacheMessage(`Invalidated all cache entries (${result.deleted})`);
    } catch (cause) {
      setCacheError(cause instanceof Error ? cause.message : "Failed to invalidate all cache entries");
    } finally {
      setCacheInvalidateAllLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-zinc-50 dark:bg-slate-950 text-zinc-900 dark:text-slate-200">
      <Header currentPage="yandex-links" />

      <main class="max-w-5xl mx-auto p-6 md:px-12 md:py-8 space-y-6">
        <section class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 class="text-xl font-semibold">Yandex Search Links</h1>
              <p class="text-sm text-zinc-500 dark:text-slate-400 mt-1">
                Search product cards and fetch referral bonus from each card.
              </p>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3">
            <input
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading()) {
                  void handleSearch();
                }
              }}
              placeholder='Search query, e.g. "iPhone 17 Pro"'
              class="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
            <input
              type="number"
              min={1}
              max={30}
              value={limit()}
              onInput={(event) => setLimit(Number.parseInt(event.currentTarget.value, 10) || 10)}
              class="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
            <button
              onClick={() => void handleSearch()}
              disabled={loading() || !query().trim()}
              class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors cursor-pointer"
            >
              <Show when={loading()} fallback={"Search"}>
                Searching...
              </Show>
            </button>
          </div>
        </section>

        <section class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h2 class="text-base font-semibold">Extension Search Cache</h2>
            <p class="text-sm text-zinc-500 dark:text-slate-400 mt-1">
              Manual invalidation for `/api/extension/yandex/search-links` shared cache.
            </p>
          </div>

          <Show when={!hasExtensionSecret}>
            <div class="rounded-xl border border-amber-300/50 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <code>VITE_EXTENSION_SECRET</code> is not configured. Invalidation controls are disabled.
            </div>
          </Show>

          <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <input
              value={cachePrefix()}
              onInput={(event) => setCachePrefix(event.currentTarget.value)}
              placeholder='Invalidate prefix, e.g. "iphone 15"'
              class="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
            <button
              onClick={() => void handleInvalidatePrefix()}
              disabled={!hasExtensionSecret || cacheInvalidateLoading() || cacheInvalidateAllLoading() || !cachePrefix().trim()}
              class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium transition-colors cursor-pointer"
            >
              <Show when={cacheInvalidateLoading()} fallback={"Invalidate Prefix"}>
                Invalidating...
              </Show>
            </button>
          </div>

          <div class="flex justify-end">
            <button
              onClick={() => void handleInvalidateAll()}
              disabled={!hasExtensionSecret || cacheInvalidateLoading() || cacheInvalidateAllLoading()}
              class="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium transition-colors cursor-pointer"
            >
              <Show when={cacheInvalidateAllLoading()} fallback={"Invalidate All"}>
                Invalidating All...
              </Show>
            </button>
          </div>

          <Show when={cacheError()}>
            <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {cacheError()}
            </div>
          </Show>

          <Show when={cacheMessage()}>
            <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {cacheMessage()}
            </div>
          </Show>
        </section>

        <Show when={error()}>
          <section class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error()}
          </section>
        </Show>

        <section class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div class="px-5 py-3 border-b border-zinc-200 dark:border-slate-800 text-sm text-zinc-500 dark:text-slate-400">
            <Show
              when={searchedQuery()}
              fallback={<span>Run a search to see results.</span>}
            >
              <span>
                Query: <span class="text-zinc-800 dark:text-slate-200 font-medium">{searchedQuery()}</span>
                {" · "}
                {results().length} results
              </span>
            </Show>
          </div>

          <Show when={results().length > 0} fallback={<div class="p-8 text-sm text-zinc-500 dark:text-slate-400">No results.</div>}>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-zinc-100/80 dark:bg-slate-800/60">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">External ID</th>
                    <th class="px-4 py-3 text-left font-medium">Price</th>
                    <th class="px-4 py-3 text-left font-medium">Bonus</th>
                    <th class="px-4 py-3 text-left font-medium">Matched Text</th>
                    <th class="px-4 py-3 text-left font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={results()}>
                    {(item) => (
                      <tr class="border-t border-zinc-100 dark:border-slate-800 align-top">
                        <td class="px-4 py-3 font-mono text-xs">{item.externalId}</td>
                        <td class="px-4 py-3">
                          <Show when={item.priceRubles !== undefined} fallback={<span class="text-zinc-400">—</span>}>
                            <span class="font-medium text-zinc-900 dark:text-slate-100">{item.priceRubles} ₽</span>
                          </Show>
                        </td>
                        <td class="px-4 py-3">
                          <Show when={item.bonusRubles !== undefined} fallback={<span class="text-zinc-400">—</span>}>
                            <span class="font-semibold text-emerald-600 dark:text-emerald-400">{item.bonusRubles} ₽</span>
                          </Show>
                        </td>
                        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-slate-400 max-w-[240px] break-all">
                          {item.matchedText ?? "—"}
                        </td>
                        <td class="px-4 py-3 text-xs">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                          >
                            {item.url}
                          </a>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </section>
      </main>
    </div>
  );
}
