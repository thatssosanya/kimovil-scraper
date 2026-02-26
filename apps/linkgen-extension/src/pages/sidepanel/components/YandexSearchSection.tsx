import React, { useState, useCallback, useEffect } from "react";
import {
  linkService,
  type YandexSearchLinkResult,
  type YandexSearchLinksResponse,
  type YandexRecentSearchesResponse,
} from "@src/services/LinkService";
import { CopyButton } from "./CopyButton";

const SEARCH_LIMIT_MAX = 12;
const SEARCH_MIN_QUERY_LENGTH = 4;

// --- Local icons ---

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const Spinner: React.FC<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// --- Helpers ---

const formatPrice = (value: number | undefined): string | null => {
  if (value === undefined) return null;
  return value.toLocaleString("ru-RU");
};

const pluralizeResults = (n: number): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "результат";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "результата";
  return "результатов";
};

// --- Skeleton ---

const SkeletonCard: React.FC = () => (
  <div className="rounded-lg border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 p-3" aria-hidden="true">
    <div className="flex items-start gap-2.5 animate-pulse">
      <div className="shrink-0 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
        <div className="h-2.5 bg-gray-100 dark:bg-gray-700/60 rounded w-3/5" />
      </div>
    </div>
    <div className="mt-2.5 ml-7 flex items-center gap-2 animate-pulse">
      <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-5 w-20 bg-gray-100 dark:bg-gray-700/60 rounded" />
    </div>
    <div className="mt-2 ml-7 animate-pulse">
      <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded w-2/3" />
    </div>
  </div>
);

// --- Result Card ---

interface GeneratedLinksData {
  siteLink: string;
  siteLinkLong?: string;
  telegramLink?: string;
  telegramLinkLong?: string;
}

interface ResultCardProps {
  item: YandexSearchLinkResult;
  index: number;
  copy: (text: string, field: string) => void;
  isCopied: (field: string) => boolean;
  onSelectResult?: (item: YandexSearchLinkResult) => void | Promise<void>;
  isSelecting: boolean;
  isSelected: boolean;
  generatedLinks?: GeneratedLinksData | null;
  isGeneratingLinks?: boolean;
  isCachedLinks?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({
  item,
  index,
  copy,
  isCopied,
  onSelectResult,
  isSelecting,
  isSelected,
  generatedLinks,
  isGeneratingLinks,
  isCachedLinks,
}) => {
  const price = formatPrice(item.priceRubles);
  const bonus = formatPrice(item.bonusRubles);
  const hasBonus = item.bonusRubles !== undefined && item.bonusRubles > 0;
  const showLinkLoading = isSelected && (isSelecting || isGeneratingLinks);
  const showLinks = isSelected && !isSelecting && !isGeneratingLinks && generatedLinks;

  const handleClick = onSelectResult
    ? (event: React.MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest("[data-no-card-select='true']")) return;
        void onSelectResult(item);
      }
    : undefined;

  const handleKeyDown = onSelectResult
    ? (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void onSelectResult(item);
        }
      }
    : undefined;

  const ariaLabel = [
    `${index + 1}.`,
    item.title || item.matchedText || item.externalId,
    price ? `${price} рублей` : null,
    hasBonus ? `бонус ${bonus} рублей` : null,
    isSelected ? "выбрано" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role={onSelectResult ? "button" : undefined}
      tabIndex={onSelectResult ? 0 : -1}
      aria-pressed={isSelected || undefined}
      aria-busy={showLinkLoading || undefined}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        "group relative rounded-lg border transition-all duration-150",
        onSelectResult ? "cursor-pointer" : "",
        isSelected
          ? "bg-blue-50/80 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/70 shadow-sm"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      ].join(" ")}
    >
      <div className="p-2.5">
        {/* Title */}
        <div className="flex items-start gap-2 min-w-0">
          <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700/80 text-[10px] font-medium text-gray-400 dark:text-gray-500 flex items-center justify-center tabular-nums select-none">
            {index + 1}
          </span>
          <p className="text-[13px] leading-snug font-medium text-gray-900 dark:text-gray-100 line-clamp-2 min-w-0 flex-1">
            {item.title || item.matchedText || item.externalId}
          </p>
        </div>

        {/* Price & bonus */}
        {(price !== null || hasBonus) && (
          <div className="mt-1.5 ml-7 flex items-center gap-1.5 flex-wrap">
            {price !== null && (
              <span className="inline-flex items-center text-xs tabular-nums px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 font-medium">
                {price}&nbsp;₽
              </span>
            )}
            {hasBonus && (
              <span
                className="inline-flex items-center text-xs tabular-nums font-semibold px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: "#6839CF" }}
              >
                +{bonus}&nbsp;₽
              </span>
            )}
          </div>
        )}

        {/* External link */}
        <div className="mt-1.5 ml-7 flex items-center min-w-0">
          <a
            data-no-card-select="true"
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate min-w-0 transition-colors"
            title={item.url}
            aria-label={`Открыть ${item.externalId} на Яндекс Маркете`}
          >
            <ExternalLinkIcon />
            <span className="truncate">{item.externalId}</span>
          </a>
        </div>
      </div>

      {/* Generated links — loading */}
      {showLinkLoading && (
        <div className="mx-2.5 mb-2.5 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-3 py-2 animate-slideDown">
          <div className="flex items-center gap-2">
            <Spinner />
            <span className="text-xs text-blue-600 dark:text-blue-400">Генерируем ссылки…</span>
          </div>
        </div>
      )}

      {/* Generated links — ready */}
      {showLinks && (
        <div
          className="mx-2.5 mb-2.5 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 divide-y divide-blue-100 dark:divide-blue-800/30 animate-slideDown"
          data-no-card-select="true"
        >
          {/* Site link */}
          <div className="flex items-center gap-2 px-3 py-2 min-w-0">
            <GlobeIcon />
            <span
              className="text-xs text-blue-700 dark:text-blue-300 font-medium truncate flex-1 min-w-0"
              title={generatedLinks.siteLink}
            >
              {generatedLinks.siteLink}
            </span>
            <CopyButton
              text={generatedLinks.siteLink}
              field="searchSiteLink"
              onCopy={copy}
              isCopied={isCopied}
              label="Копировать ссылку для сайта"
            />
          </div>

          {/* Telegram link */}
          {generatedLinks.telegramLink && (
            <div className="flex items-center gap-2 px-3 py-2 min-w-0">
              <SendIcon />
              <span
                className="text-xs text-blue-700 dark:text-blue-300 font-medium truncate flex-1 min-w-0"
                title={generatedLinks.telegramLink}
              >
                {generatedLinks.telegramLink}
              </span>
              <CopyButton
                text={generatedLinks.telegramLink}
                field="searchTelegramLink"
                onCopy={copy}
                isCopied={isCopied}
                label="Копировать ссылку для Телеграм"
              />
            </div>
          )}

          {/* Cache indicator */}
          {isCachedLinks && (
            <div className="px-3 py-1">
              <span className="text-[10px] text-blue-400 dark:text-blue-500">из кэша</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

interface YandexSearchSectionProps {
  copy: (text: string, field: string) => void;
  isCopied: (field: string) => boolean;
  onSelectResult?: (item: YandexSearchLinkResult) => void | Promise<void>;
  selectingExternalId?: string | null;
  selectedResult?: YandexSearchLinkResult | null;
  fullHeight?: boolean;
  generatedLinks?: GeneratedLinksData | null;
  isGeneratingLinks?: boolean;
  isCachedLinks?: boolean;
}

export const YandexSearchSection: React.FC<YandexSearchSectionProps> = ({
  copy,
  isCopied,
  onSelectResult,
  selectingExternalId,
  selectedResult,
  fullHeight = false,
  generatedLinks,
  isGeneratingLinks,
  isCachedLinks,
}) => {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<YandexSearchLinkResult[]>([]);
  const [cacheHit, setCacheHit] = useState(false);
  const [stale, setStale] = useState(false);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [partialResults, setPartialResults] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentEntries, setRecentEntries] = useState<YandexSearchLinksResponse[]>([]);

  const applySearchResponse = useCallback((response: YandexSearchLinksResponse) => {
    const sorted = [...response.links].sort((a, b) => {
      const aBonus = typeof a.bonusRubles === "number" ? a.bonusRubles : 0;
      const bBonus = typeof b.bonusRubles === "number" ? b.bonusRubles : 0;
      if (aBonus !== bBonus) return bBonus - aBonus;

      const aPrice = typeof a.priceRubles === "number" ? a.priceRubles : Number.POSITIVE_INFINITY;
      const bPrice = typeof b.priceRubles === "number" ? b.priceRubles : Number.POSITIVE_INFINITY;
      return aPrice - bPrice;
    });

    setResults(sorted);
    setCacheHit(Boolean(response.cacheHit));
    setStale(Boolean(response.stale));
    setSearchWarning(response.warning ?? null);
    setSearchDurationMs(
      typeof response.meta?.scrapeDurationMs === "number" ? response.meta.scrapeDurationMs : null,
    );
    setPartialResults(Boolean(response.meta?.partial));
  }, []);

  const loadRecentEntries = useCallback(async () => {
    try {
      const recent: YandexRecentSearchesResponse = await linkService.getRecentYandexSearches(SEARCH_LIMIT_MAX);
      setRecentEntries(recent.entries.filter((entry) => entry.query.trim().length > 0));
    } catch {
      setRecentEntries([]);
    }
  }, []);

  useEffect(() => {
    void loadRecentEntries();
  }, [loadRecentEntries]);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (trimmed.length < SEARCH_MIN_QUERY_LENGTH) {
      setError(`Введите минимум ${SEARCH_MIN_QUERY_LENGTH} символа`);
      return;
    }

    setLoading(true);
    setError(null);
    setSearchWarning(null);
    setCacheHit(false);
    setStale(false);
    setSearchDurationMs(null);
    setPartialResults(false);
    setHasSearched(true);

    try {
      const result = await linkService.searchYandexLinks(trimmed, Math.min(limit, SEARCH_LIMIT_MAX));
      applySearchResponse(result);
      void loadRecentEntries();
    } catch (cause) {
      setResults([]);
      setError(cause instanceof Error ? cause.message : "Поиск не удался");
    } finally {
      setLoading(false);
    }
  }, [applySearchResponse, limit, loadRecentEntries, query]);

  const handleLoadRecent = useCallback((entry: YandexSearchLinksResponse) => {
    setQuery(entry.query);
    setError(null);
    setHasSearched(true);
    applySearchResponse(entry);
  }, [applySearchResponse]);

  const handleBackToRecent = useCallback(() => {
    setHasSearched(false);
    setError(null);
    setResults([]);
    setCacheHit(false);
    setStale(false);
    setSearchWarning(null);
    setSearchDurationMs(null);
    setPartialResults(false);
  }, []);

  const bonusCount = results.filter((r) => r.bonusRubles !== undefined && r.bonusRubles > 0).length;
  const showResults = hasSearched && !loading && !error && results.length > 0;
  const showEmpty = hasSearched && !loading && !error && results.length === 0;

  // Metadata segments
  const metaSegments: Array<{ text: string; warn?: boolean }> = [];
  if (showResults) {
    metaSegments.push({ text: `${results.length} ${pluralizeResults(results.length)}` });
    if (cacheHit) {
      metaSegments.push({ text: stale ? "кэш (устарел)" : "кэш", warn: stale });
    }
    if (searchDurationMs !== null) {
      metaSegments.push({ text: `${(searchDurationMs / 1000).toFixed(1)}с` });
    }
    if (bonusCount > 0) {
      metaSegments.push({ text: `${bonusCount} с бонусом` });
    }
    if (partialResults) {
      metaSegments.push({ text: "частично", warn: true });
    }
  }

  return (
    <div
      className={`flex flex-col overflow-hidden ${
        fullHeight
          ? "flex-1 min-h-0"
          : "rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      }`}
    >
      {/* Header */}
      <div
        className={`shrink-0 px-3 py-2 flex items-center gap-2 ${
          fullHeight
            ? "bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
            : "bg-gray-50 dark:bg-gray-700/80 border-b border-gray-200 dark:border-gray-600"
        }`}
      >
        <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
          <SearchIcon />
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Поиск Яндекс Маркет</h2>
      </div>

      {/* Search form */}
      <div className="shrink-0 p-3 space-y-2 bg-white dark:bg-gray-800" role="search" aria-label="Поиск товаров на Яндекс Маркете">
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="ym-search-input">
            Поисковый запрос
          </label>
          <input
            id="ym-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                e.preventDefault();
                void handleSearch();
              }
            }}
            placeholder="iPhone 15 Pro Max"
            className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md py-1.5 px-2.5 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent transition-shadow"
            autoComplete="off"
            spellCheck={false}
          />
          <label className="sr-only" htmlFor="ym-search-limit">
            Количество результатов
          </label>
          <input
            id="ym-search-limit"
            type="number"
            min={1}
            max={SEARCH_LIMIT_MAX}
            value={limit}
            onChange={(e) =>
              setLimit(Math.max(1, Math.min(SEARCH_LIMIT_MAX, Number.parseInt(e.target.value, 10) || 10)))
            }
            className="w-12 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md py-1.5 px-1.5 text-sm text-center tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent transition-shadow"
          />
        </div>

        <button
          onClick={() => void handleSearch()}
          disabled={loading || !query.trim()}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label={loading ? "Поиск выполняется" : "Найти ссылки на Яндекс Маркете"}
        >
          {loading ? (
            <>
              <Spinner />
              <span>Ищем…</span>
            </>
          ) : (
            <>
              <SearchIcon />
              <span>Найти ссылки</span>
            </>
          )}
        </button>
      </div>

      {fullHeight && hasSearched && !loading && (
        <div className="shrink-0 px-3 pb-2">
          <button
            type="button"
            onClick={handleBackToRecent}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeftIcon />
            <span>Назад к недавним запросам</span>
          </button>
        </div>
      )}

      {/* Recent cached requests */}
      {fullHeight && !hasSearched && !loading && recentEntries.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 hide-scrollbar">
          <div className="px-1 pb-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Недавние запросы (кэш)
          </div>
          <div className="space-y-1.5">
              {recentEntries.map((entry, index) => (
                <button
                  key={`${entry.query}:${entry.meta?.createdAt ?? 0}:${entry.meta?.expiresAt ?? 0}`}
                  type="button"
                  onClick={() => handleLoadRecent(entry)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm px-2.5 py-2 text-left transition-all duration-150"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700/80 text-[10px] font-medium text-gray-400 dark:text-gray-500 flex items-center justify-center tabular-nums select-none">
                      {index + 1}
                    </span>
                    <span className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">
                      {entry.query}
                    </span>
                  </div>
                  <div className="mt-1.5 ml-7 flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                    <span className="inline-flex items-center text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700/80 text-gray-500 dark:text-gray-300">
                      {entry.links.length}
                    </span>
                    {typeof entry.meta?.createdAt === "number" && (
                      <span>
                        {new Date(entry.meta.createdAt * 1000).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {entry.stale && <span className="text-amber-500 dark:text-amber-400">устарел</span>}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="shrink-0 mx-3 mb-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50"
          role="alert"
        >
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="flex-1 min-h-0 overflow-hidden p-2 space-y-1.5" role="status">
          <span className="sr-only">Загрузка результатов поиска…</span>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Metadata */}
      {metaSegments.length > 0 && (
        <div
          className="shrink-0 px-3 py-1.5 border-t border-gray-100 dark:border-gray-800"
          role="status"
          aria-label="Информация о результатах поиска"
        >
          <p className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
            {metaSegments.map((seg, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span className="mx-1 select-none" aria-hidden="true">
                    ·
                  </span>
                )}
                <span className={seg.warn ? "text-amber-500 dark:text-amber-400" : ""}>{seg.text}</span>
              </React.Fragment>
            ))}
          </p>
          {searchWarning && (
            <p className="mt-0.5 text-[10px] text-amber-500 dark:text-amber-400">{searchWarning}</p>
          )}
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div
          className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 hide-scrollbar"
          role="list"
          aria-label={`${results.length} ${pluralizeResults(results.length)} поиска`}
        >
          {results.map((item, i) => (
            <div role="listitem" key={`${item.externalId}:${item.url}:${i}`}>
              <ResultCard
                item={item}
                index={i}
                copy={copy}
                isCopied={isCopied}
                onSelectResult={onSelectResult}
                isSelecting={selectingExternalId === item.externalId}
                isSelected={selectedResult?.externalId === item.externalId}
                generatedLinks={
                  selectedResult?.externalId === item.externalId ? generatedLinks : undefined
                }
                isGeneratingLinks={
                  selectedResult?.externalId === item.externalId ? isGeneratingLinks : undefined
                }
                isCachedLinks={
                  selectedResult?.externalId === item.externalId ? isCachedLinks : undefined
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div className="flex-1 flex items-center justify-center px-3 pb-4 pt-6">
          <div className="text-center">
            <div className="text-2xl mb-2" aria-hidden="true">
              🔍
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Ничего не найдено</p>
            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
              Попробуйте изменить запрос
            </p>
          </div>
        </div>
      )}

      {/* Initial state (fullHeight only) */}
      {fullHeight && !hasSearched && !loading && recentEntries.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-blue-400 dark:text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-[200px]">
            Введите название устройства для поиска ссылок на Яндекс Маркете
          </p>
        </div>
      )}
    </div>
  );
};
