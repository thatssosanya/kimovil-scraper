import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Header } from "../../components/Header";
import {
  getTelegramBackfillReadiness,
  listTelegramFeedItems,
  listTelegramFeedLinks,
  listTelegramBackfillJobs,
  reprocessTelegramLinks,
  startTelegramBackfill,
  type TelegramBackfillJob,
  type TelegramFeedItemOverview,
  type TelegramFeedLink,
  type TelegramLinkProcessingState,
} from "../../api/telegram";

const formatDateTime = (timestamp: number | null): string => {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp * 1000).toLocaleString();
};

const statusClass = (status: TelegramBackfillJob["status"]): string => {
  if (status === "done") {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  }
  if (status === "running") {
    return "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
  }
  if (status === "error") {
    return "bg-rose-500/10 text-rose-300 border-rose-500/30";
  }
  return "bg-amber-500/10 text-amber-300 border-amber-500/30";
};

const linkStateClass = (state: TelegramLinkProcessingState): string => {
  if (state === "done") {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  }
  if (state === "processing") {
    return "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
  }
  if (state === "error") {
    return "bg-rose-500/10 text-rose-300 border-rose-500/30";
  }
  if (state === "ignored") {
    return "bg-zinc-500/10 text-zinc-300 border-zinc-500/30";
  }
  return "bg-amber-500/10 text-amber-300 border-amber-500/30";
};

const ellipsize = (value: string, max = 88): string =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

export default function TelegramBackfill() {
  const [channelsInput, setChannelsInput] = createSignal("");
  const [maxPostsPerChannel, setMaxPostsPerChannel] = createSignal(500);
  const [sinceDays, setSinceDays] = createSignal(30);
  const [loading, setLoading] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);
  const [jobs, setJobs] = createSignal<TelegramBackfillJob[]>([]);
  const [feedItems, setFeedItems] = createSignal<TelegramFeedItemOverview[]>(
    [],
  );
  const [feedLinks, setFeedLinks] = createSignal<TelegramFeedLink[]>([]);
  const [linksFilter, setLinksFilter] = createSignal<
    "all" | TelegramLinkProcessingState
  >("all");
  const [reprocessingAll, setReprocessingAll] = createSignal(false);
  const [reprocessingLinkId, setReprocessingLinkId] = createSignal<
    number | null
  >(null);
  const [readiness, setReadiness] = createSignal<{
    ready: boolean;
    missing: string[];
  } | null>(null);

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const parseChannels = (): string[] => [
    ...new Set(
      channelsInput()
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  const refreshData = async (): Promise<void> => {
    setRefreshing(true);
    try {
      const stateFilter = linksFilter();
      const [nextReadiness, nextJobs, nextFeedItems, nextFeedLinks] =
        await Promise.all([
          getTelegramBackfillReadiness(),
          listTelegramBackfillJobs(30),
          listTelegramFeedItems(20),
          listTelegramFeedLinks({
            limit: 50,
            state: stateFilter === "all" ? undefined : stateFilter,
          }),
        ]);
      setReadiness(nextReadiness);
      setJobs(nextJobs);
      setFeedItems(nextFeedItems);
      setFeedLinks(nextFeedLinks);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to fetch backfill status",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const startJob = async (): Promise<void> => {
    const channels = parseChannels();
    if (channels.length === 0) {
      setError("Provide at least one channel username/link/id");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const now = Math.floor(Date.now() / 1000);
      const days = Math.max(0, sinceDays());
      const sinceTs = days > 0 ? now - days * 24 * 60 * 60 : null;

      const result = await startTelegramBackfill({
        channels,
        maxPostsPerChannel: Math.max(
          1,
          Math.min(5000, maxPostsPerChannel() || 500),
        ),
        sinceTs,
      });

      setSuccess(`Started backfill job #${result.jobId}`);
      await refreshData();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to start backfill job",
      );
    } finally {
      setLoading(false);
    }
  };

  const requeueFailedLinks = async (): Promise<void> => {
    setReprocessingAll(true);
    setError(null);
    try {
      const result = await reprocessTelegramLinks({
        states: ["error", "ignored"],
        resetAttempts: true,
      });
      setSuccess(`Requeued ${result.updated} links from error/ignored states`);
      await refreshData();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to requeue Telegram links",
      );
    } finally {
      setReprocessingAll(false);
    }
  };

  const requeueSingleLink = async (linkId: number): Promise<void> => {
    setReprocessingLinkId(linkId);
    setError(null);
    try {
      const result = await reprocessTelegramLinks({
        linkIds: [linkId],
        resetAttempts: true,
      });
      setSuccess(`Requeued link #${linkId} (${result.updated} updated)`);
      await refreshData();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `Failed to requeue link #${linkId}`,
      );
    } finally {
      setReprocessingLinkId(null);
    }
  };

  onMount(() => {
    void refreshData();
    pollInterval = setInterval(() => {
      void refreshData();
    }, 5000);
  });

  onCleanup(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });

  return (
    <div class="min-h-screen bg-zinc-50 dark:bg-slate-950 text-zinc-900 dark:text-slate-200">
      <Header currentPage="telegram" />

      <main class="max-w-6xl mx-auto p-6 md:px-12 md:py-8 space-y-6">
        <section class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h1 class="text-xl font-semibold">
                Telegram Historical Backfill
              </h1>
              <p class="text-sm text-zinc-500 dark:text-slate-400 mt-1">
                Fetch old channel posts via MTProto and queue links for existing
                Telegram/Yandex processing.
              </p>
            </div>
            <button
              onClick={() => void refreshData()}
              disabled={refreshing()}
              class="px-3 py-2 rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-100 dark:bg-slate-800/70 text-sm hover:bg-zinc-200 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <Show when={refreshing()} fallback="Refresh">
                Refreshing...
              </Show>
            </button>
          </div>

          <Show when={readiness() && !readiness()!.ready}>
            <div class="rounded-xl border border-amber-300/50 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              Missing MTProto env vars: {readiness()!.missing.join(", ")}
            </div>
          </Show>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="space-y-1">
              <span class="text-sm text-zinc-600 dark:text-slate-300">
                Max posts per channel
              </span>
              <input
                type="number"
                min={1}
                max={5000}
                value={maxPostsPerChannel()}
                onInput={(event) =>
                  setMaxPostsPerChannel(
                    Number.parseInt(event.currentTarget.value, 10) || 500,
                  )
                }
                class="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </label>
            <label class="space-y-1">
              <span class="text-sm text-zinc-600 dark:text-slate-300">
                Backfill only last N days (0 = full limit)
              </span>
              <input
                type="number"
                min={0}
                max={3650}
                value={sinceDays()}
                onInput={(event) =>
                  setSinceDays(
                    Number.parseInt(event.currentTarget.value, 10) || 0,
                  )
                }
                class="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </label>
          </div>

          <label class="space-y-1 block">
            <span class="text-sm text-zinc-600 dark:text-slate-300">
              Channels (one per line; username, invite link, or numeric ID)
            </span>
            <textarea
              value={channelsInput()}
              onInput={(event) => setChannelsInput(event.currentTarget.value)}
              rows={6}
              placeholder="@my_channel\nhttps://t.me/another_channel\n-1001234567890"
              class="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </label>

          <div class="flex items-center justify-between gap-3 flex-wrap">
            <p class="text-xs text-zinc-500 dark:text-slate-400">
              Parsed channels: {parseChannels().length}
            </p>
            <button
              onClick={() => void startJob()}
              disabled={loading() || !readiness()?.ready}
              class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              <Show when={loading()} fallback="Start Historical Backfill">
                Starting...
              </Show>
            </button>
          </div>
        </section>

        <Show when={error()}>
          <section class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error()}
          </section>
        </Show>

        <Show when={success()}>
          <section class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success()}
          </section>
        </Show>

        <section class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div class="px-5 py-3 border-b border-zinc-200 dark:border-slate-800 text-sm text-zinc-500 dark:text-slate-400">
            Recent backfill jobs ({jobs().length})
          </div>

          <Show
            when={jobs().length > 0}
            fallback={
              <div class="p-8 text-sm text-zinc-500 dark:text-slate-400">
                No jobs yet.
              </div>
            }
          >
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-zinc-100/80 dark:bg-slate-800/60">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Job</th>
                    <th class="px-4 py-3 text-left font-medium">Status</th>
                    <th class="px-4 py-3 text-left font-medium">Window</th>
                    <th class="px-4 py-3 text-left font-medium">Messages</th>
                    <th class="px-4 py-3 text-left font-medium">Created</th>
                    <th class="px-4 py-3 text-left font-medium">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={jobs()}>
                    {(job) => (
                      <tr class="border-t border-zinc-100 dark:border-slate-800 align-top">
                        <td class="px-4 py-3">
                          <div class="font-semibold">#{job.id}</div>
                          <div class="text-xs text-zinc-500 dark:text-slate-400 mt-1">
                            channels: {job.channels.join(", ")}
                          </div>
                          <div class="text-xs text-zinc-500 dark:text-slate-400">
                            max/channel: {job.maxPostsPerChannel}
                          </div>
                          <Show when={job.errorMessage}>
                            <div class="text-xs text-rose-400 mt-1">
                              {job.errorMessage}
                            </div>
                          </Show>
                        </td>
                        <td class="px-4 py-3">
                          <span
                            class={`inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${statusClass(job.status)}`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-xs">
                          <div>since: {formatDateTime(job.sinceTs)}</div>
                          <div>until: {formatDateTime(job.untilTs)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs">
                          <div>processed: {job.processedMessages}</div>
                          <div>inserted: {job.insertedMessages}</div>
                          <div>updated: {job.updatedMessages}</div>
                          <div>skipped: {job.skippedMessages}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-slate-400">
                          {formatDateTime(job.createdAt)}
                        </td>
                        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-slate-400">
                          {formatDateTime(job.completedAt)}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </section>

        <section class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div class="px-5 py-3 border-b border-zinc-200 dark:border-slate-800 text-sm text-zinc-500 dark:text-slate-400">
            Recent Telegram feed items ({feedItems().length})
          </div>

          <Show
            when={feedItems().length > 0}
            fallback={
              <div class="p-8 text-sm text-zinc-500 dark:text-slate-400">
                No feed items ingested yet.
              </div>
            }
          >
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-zinc-100/80 dark:bg-slate-800/60">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Channel</th>
                    <th class="px-4 py-3 text-left font-medium">Message</th>
                    <th class="px-4 py-3 text-left font-medium">Posted</th>
                    <th class="px-4 py-3 text-left font-medium">Links</th>
                    <th class="px-4 py-3 text-left font-medium">Seen</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={feedItems()}>
                    {(item) => (
                      <tr class="border-t border-zinc-100 dark:border-slate-800 align-top">
                        <td class="px-4 py-3 text-xs">
                          <div class="font-semibold text-zinc-800 dark:text-slate-100">
                            {item.title || item.username || item.chatId}
                          </div>
                          <div class="text-zinc-500 dark:text-slate-400 mt-1">
                            {item.transport} · {item.chatId}
                          </div>
                        </td>
                        <td class="px-4 py-3 text-xs">
                          <div>feed #{item.id}</div>
                          <div>message #{item.messageId}</div>
                          <Show when={item.editedAt}>
                            <div class="text-zinc-500 dark:text-slate-400">
                              edited: {formatDateTime(item.editedAt)}
                            </div>
                          </Show>
                        </td>
                        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-slate-400">
                          {formatDateTime(item.postedAt)}
                        </td>
                        <td class="px-4 py-3 text-xs">
                          <div>total: {item.linksTotal}</div>
                          <div>pending: {item.pendingLinks}</div>
                          <div>processing: {item.processingLinks}</div>
                          <div>done: {item.doneLinks}</div>
                          <div>error: {item.errorLinks}</div>
                          <div>ignored: {item.ignoredLinks}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-slate-400">
                          <div>first: {formatDateTime(item.firstSeenAt)}</div>
                          <div>last: {formatDateTime(item.lastSeenAt)}</div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </section>

        <section class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div class="px-5 py-3 border-b border-zinc-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div class="text-sm text-zinc-500 dark:text-slate-400">
              Recent Telegram links ({feedLinks().length})
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <select
                value={linksFilter()}
                onChange={(event) => {
                  const value = event.currentTarget.value as
                    | "all"
                    | TelegramLinkProcessingState;
                  setLinksFilter(value);
                  void refreshData();
                }}
                class="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-100 dark:bg-slate-800/70 text-xs"
              >
                <option value="all">all states</option>
                <option value="pending">pending</option>
                <option value="processing">processing</option>
                <option value="done">done</option>
                <option value="error">error</option>
                <option value="ignored">ignored</option>
              </select>
              <button
                onClick={() => void requeueFailedLinks()}
                disabled={reprocessingAll()}
                class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                <Show when={reprocessingAll()} fallback="Requeue error/ignored">
                  Requeueing...
                </Show>
              </button>
            </div>
          </div>

          <Show
            when={feedLinks().length > 0}
            fallback={
              <div class="p-8 text-sm text-zinc-500 dark:text-slate-400">
                No links for current filter.
              </div>
            }
          >
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-zinc-100/80 dark:bg-slate-800/60">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">State</th>
                    <th class="px-4 py-3 text-left font-medium">Source</th>
                    <th class="px-4 py-3 text-left font-medium">Link</th>
                    <th class="px-4 py-3 text-left font-medium">
                      Yandex Snapshot
                    </th>
                    <th class="px-4 py-3 text-left font-medium">Attempts</th>
                    <th class="px-4 py-3 text-left font-medium">Updated</th>
                    <th class="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={feedLinks()}>
                    {(link) => (
                      <tr class="border-t border-zinc-100 dark:border-slate-800 align-top">
                        <td class="px-4 py-3">
                          <span
                            class={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${linkStateClass(link.processingState)}`}
                          >
                            {link.processingState}
                          </span>
                          <div class="text-[11px] text-zinc-500 dark:text-slate-400 mt-1">
                            link #{link.id} · feed #{link.feedItemId}
                          </div>
                        </td>
                        <td class="px-4 py-3 text-xs">
                          <div>{link.transport}</div>
                          <div class="text-zinc-500 dark:text-slate-400 mt-1">
                            chat: {link.chatId}
                          </div>
                          <div class="text-zinc-500 dark:text-slate-400">
                            msg: {link.messageId}
                          </div>
                        </td>
                        <td class="px-4 py-3 text-xs max-w-[360px]">
                          <a
                            href={link.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                            title={link.originalUrl}
                          >
                            {ellipsize(link.originalUrl)}
                          </a>
                          <Show when={link.resolvedUrl}>
                            <div
                              class="mt-1 text-zinc-500 dark:text-slate-400 break-all"
                              title={link.resolvedUrl || ""}
                            >
                              resolved: {ellipsize(link.resolvedUrl || "")}
                            </div>
                          </Show>
                          <Show when={link.lastError}>
                            <div
                              class="mt-1 text-rose-400 break-all"
                              title={link.lastError || ""}
                            >
                              {ellipsize(link.lastError || "", 110)}
                            </div>
                          </Show>
                        </td>
                        <td class="px-4 py-3 text-xs">
                          <div>
                            {link.isYandexMarket
                              ? `card: ${link.yandexExternalId || "yes"}`
                              : "not yandex"}
                          </div>
                          <Show when={link.imageUrl}>
                            <a
                              href={link.imageUrl || ""}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="mt-2 inline-block"
                              title={link.imageUrl || ""}
                            >
                              <img
                                src={link.imageUrl || ""}
                                alt={link.title || "Yandex product image"}
                                loading="lazy"
                                class="h-14 w-14 rounded-md border border-zinc-200 dark:border-slate-700 object-cover"
                              />
                            </a>
                          </Show>
                          <Show when={link.title}>
                            <div class="text-zinc-500 dark:text-slate-400 mt-1 break-all">
                              {link.title}
                            </div>
                          </Show>
                          <Show when={link.priceMinorUnits !== null}>
                            <div class="text-zinc-500 dark:text-slate-400">
                              price:{" "}
                              {Math.round((link.priceMinorUnits || 0) / 100)}{" "}
                              {link.currency || "RUB"}
                            </div>
                          </Show>
                          <Show when={link.bonusMinorUnits !== null}>
                            <div class="text-emerald-500 dark:text-emerald-400">
                              bonus:{" "}
                              {Math.round((link.bonusMinorUnits || 0) / 100)} ₽
                            </div>
                          </Show>
                        </td>
                        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-slate-400">
                          <div>attempt: {link.attemptCount}</div>
                          <div>next: {formatDateTime(link.nextAttemptAt)}</div>
                          <div>lock: {formatDateTime(link.lockedUntil)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-zinc-500 dark:text-slate-400">
                          <div>posted: {formatDateTime(link.postedAt)}</div>
                          <div>updated: {formatDateTime(link.updatedAt)}</div>
                          <div>scraped: {formatDateTime(link.scrapedAt)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs">
                          <button
                            onClick={() => void requeueSingleLink(link.id)}
                            disabled={reprocessingLinkId() === link.id}
                            class="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
                          >
                            <Show
                              when={reprocessingLinkId() === link.id}
                              fallback="Requeue"
                            >
                              ...
                            </Show>
                          </button>
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
