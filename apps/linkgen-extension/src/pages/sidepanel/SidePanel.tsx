import React, { useEffect, useState, useCallback } from "react";
import "@pages/sidepanel/SidePanel.css";
import withSuspense from "@src/shared/hoc/withSuspense";
import withErrorBoundary from "@src/shared/hoc/withErrorBoundary";
import vidStorage, { AUTHORS, VidAuthor } from "@src/shared/storages/vidStorage";
import linksStorage from "@src/shared/storages/linksStorage";
import { linkService, YandexSearchLinkResult } from "@src/services/LinkService";
import { YandexMarketParams, AliExpressParams } from "@src/shared/utils/utils";

// Hooks
import { useCurrentTab } from './hooks/useCurrentTab';
import { useClipboard } from './hooks/useClipboard';
import { useLinkGeneration } from './hooks/useLinkGeneration';

// Components
import { 
  ShoppingIcon, 
  AliExpressIcon, 
  UserIcon, 
  PercentIcon, 
  LinkIcon,
  LoadingSpinner
} from './components/Icons';
import { CopyButton } from './components/CopyButton';
import { ProductInfo } from './components/ProductInfo';
import { GeneratedLink } from './components/GeneratedLink';
import { YandexSearchSection } from './components/YandexSearchSection';

const SidePanel = () => {
  // State
  const [selectedAuthor, setSelectedAuthor] = useState<VidAuthor>(
    vidStorage.getSelectedAuthor(),
  );
  const [selectingSearchExternalId, setSelectingSearchExternalId] = useState<string | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<YandexSearchLinkResult | null>(null);

  // Custom Hooks
  const { url, title, id: tabId, refreshCurrentTab } = useCurrentTab();
  const { copy, isCopied } = useClipboard();
  const linkGeneration = useLinkGeneration(tabId, url, selectedAuthor);

  const {
    loading,
    error,
    errorCode,
    retryable,
    retryCount,
    yandexLinks,
    aliExpressLink,
    aliExpressLinkLong,
    aliExpressCommission,
    commissionLoading,
    commissionError,
    priceRuLink,
    priceRuLinkLong,
    isCached,
    urlInfo,
    generateYandexLinks,
    generateAliExpressLink,
    generatePriceRuLink,
    checkAliExpressCommission,
    loadCachedLinks
  } = linkGeneration;

  const isValid = urlInfo.type !== 'invalid';
  const isYandexValid = urlInfo.type === 'yandex';
  const isAliExpressValid = urlInfo.type === 'aliexpress';
  const isPriceRuValid = urlInfo.type === 'priceru';

  const handleSelectSearchResult = useCallback(async (item: YandexSearchLinkResult) => {
    if (selectingSearchExternalId) {
      return;
    }

    setSelectedSearchResult(item);
    setSelectingSearchExternalId(item.externalId);
    try {
      await generateYandexLinks(item.url);
    } finally {
      setSelectingSearchExternalId(null);
    }
  }, [generateYandexLinks, selectingSearchExternalId]);

  // Event Handlers
  const handleAuthorChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const authorId = e.target.value;
    await vidStorage.setSelectedAuthor(authorId);
  };

  // Keyboard shortcut handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Alt+G: Generate links
      if (e.altKey && e.key.toLowerCase() === "g" && isValid && !loading) {
        e.preventDefault();
        if (isYandexValid) {
          generateYandexLinks();
        } else if (isAliExpressValid) {
          generateAliExpressLink();
        } else if (isPriceRuValid) {
          generatePriceRuLink();
        }
      }

      // Alt+R: Check AliExpress commission
      if (
        e.altKey &&
        e.key.toLowerCase() === "r" &&
        isAliExpressValid &&
        !commissionLoading
      ) {
        e.preventDefault();
        checkAliExpressCommission();
      }

      // Alt+C: Copy site link
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (isYandexValid && yandexLinks?.siteLink) {
          copy(yandexLinks.siteLink, "siteLink");
        } else if (isAliExpressValid && aliExpressLink) {
          copy(aliExpressLink, "aliExpressLink");
        } else if (isPriceRuValid && priceRuLink) {
          copy(priceRuLink, "priceRuLink");
        }
      }

      // Alt+T: Copy Telegram link
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        if (isYandexValid && yandexLinks?.telegramLink) {
          copy(yandexLinks.telegramLink, "telegramLink");
        } else if (isAliExpressValid && aliExpressLink) {
          copy(aliExpressLink, "aliExpressLink");
        } else if (isPriceRuValid && priceRuLink) {
          copy(priceRuLink, "priceRuLink");
        }
      }
    },
    [
      isValid,
      isYandexValid,
      isAliExpressValid,
      isPriceRuValid,
      loading,
      commissionLoading,
      yandexLinks,
      aliExpressLink,
      priceRuLink,
      generateYandexLinks,
      generateAliExpressLink,
      generatePriceRuLink,
      checkAliExpressCommission,
      copy,
    ],
  );

  // Effects
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const unsubscribe = vidStorage.subscribe(() => {
      const newAuthor = vidStorage.getSelectedAuthor();
      setSelectedAuthor(newAuthor);
      if (tabId) {
        loadCachedLinks();
      }
    });

    const unsubscribeLinks = linksStorage.subscribe(() => {
      if (tabId) {
        loadCachedLinks();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeLinks();
    };
  }, [tabId, loadCachedLinks]);

  useEffect(() => {
    if (tabId && url) {
      // Clear cache when URL changes
      const urlInfo = linkService.parseUrl(url);
      if (urlInfo.type === 'invalid') {
        linksStorage.clearLinksForTab(tabId);
      }
    }
  }, [url, tabId]);

  // Search-only mode: no valid URL detected
  if (!isValid) {
    return (
      <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <YandexSearchSection
          copy={copy}
          isCopied={isCopied}
          onSelectResult={handleSelectSearchResult}
          selectingExternalId={selectingSearchExternalId}
          selectedResult={selectedSearchResult}
          fullHeight
          generatedLinks={yandexLinks}
          isGeneratingLinks={loading}
          isCachedLinks={isCached}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-md">
              {isAliExpressValid ? <AliExpressIcon /> : isPriceRuValid ? <PercentIcon /> : <ShoppingIcon />}
            </div>
            <span>Инфо</span>
          </h1>
          <div className="text-xs px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-medium">
              {isYandexValid ? "Яндекс Маркет URL" : isAliExpressValid ? "AliExpress URL" : "Price.ru URL"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* URL Display */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
            <h2 className="text-sm font-medium">Текущий URL</h2>
            <CopyButton
              text={url}
              field="url"
              onCopy={copy}
              isCopied={isCopied}
              label="Копировать URL"
            />
          </div>
          <div className="p-3 line-clamp-3 text-xs font-mono break-all max-h-24 overflow-auto">
            {url}
          </div>
        </div>

        {isYandexValid && urlInfo.params && (
          <div className="rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium flex items-center gap-1">
                  Формат:
                </h2>
                <pre className="text-sm">
                  {('isCardFormat' in urlInfo.params && urlInfo.params.isCardFormat) ? "/card" : "/product"}
                </pre>
              </div>
              {!('isCardFormat' in urlInfo.params && urlInfo.params.isCardFormat) && (
                <button
                  onClick={refreshCurrentTab}
                  className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center gap-1"
                  title="Обновить страницу для загрузки в card формате"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Обновить для /card
                </button>
              )}
            </div>
          </div>
        )}

        {/* Author Selection for Yandex Market */}
        {isYandexValid && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <h2 className="text-sm font-medium flex items-center gap-1">
                <UserIcon /> Автор (VID: {selectedAuthor.vid})
              </h2>
            </div>
            <div className="p-3">
              <select
                value={selectedAuthor.id}
                onChange={handleAuthorChange}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Выбрать автора"
              >
                {AUTHORS.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name} (VID: {author.vid})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* AliExpress Commission Display */}
        {isAliExpressValid && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
              <h2 className="text-sm font-medium flex items-center gap-1">
                <PercentIcon /> Комиссия AliExpress
              </h2>
              {!commissionLoading && (
                <button
                  onClick={checkAliExpressCommission}
                  className={`text-xs px-3 py-1 rounded-full transition-colors flex items-center gap-1 ${
                    commissionError 
                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800' 
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                  }`}
                  title="Alt+R"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {commissionError ? 'Повторить' : 'Обновить'}
                </button>
              )}
            </div>
            <div className="p-3">
              {commissionLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <LoadingSpinner />
                  Проверяем комиссию...
                </div>
              ) : commissionError ? (
                <div className="space-y-2">
                  <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    {commissionError}
                  </div>
                </div>
              ) : aliExpressCommission ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Базовая комиссия:
                    </span>
                    <span className="text-sm font-medium">
                      {aliExpressCommission.commission_rate
                        ? `${aliExpressCommission.commission_rate}%`
                        : "Н/Д"}
                    </span>
                  </div>
                  {aliExpressCommission.hot_commission_rate && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Горячая комиссия:
                      </span>
                      <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        {aliExpressCommission.hot_commission_rate}%
                      </span>
                    </div>
                  )}
                  {aliExpressCommission.is_hot && (
                    <div className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full inline-block">
                      🔥 Горячий товар
                    </div>
                  )}
                  {aliExpressCommission.commission_rate === 0 && (
                    <div className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded-full">
                      ⚠️ Комиссия 0% - генерация ссылки недоступна
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Загрузка информации о комиссии...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Information */}
        {urlInfo.params && ((urlInfo.type === 'yandex' && isYandexValid) || (urlInfo.type === 'aliexpress' && isAliExpressValid)) && (
          <ProductInfo
            type={urlInfo.type as 'yandex' | 'aliexpress'}
            params={urlInfo.params as YandexMarketParams | AliExpressParams}
            title={aliExpressCommission?.product_name || title}
            onCopy={copy}
            isCopied={isCopied}
          />
        )}

        {/* Action Buttons */}
        {isYandexValid && (
          <button
            onClick={() => void generateYandexLinks()}
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-md relative overflow-hidden"
            aria-label="Сгенерировать ссылки"
            title="Alt+G"
          >
            {loading && (
              <span className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                <LoadingSpinner />
              </span>
            )}
            <span
              className={`flex items-center justify-center gap-2 ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
            >
              <LinkIcon />
              Сгенерировать ссылки
            </span>
          </button>
        )}

        {isAliExpressValid &&
          aliExpressCommission &&
          aliExpressCommission.commission_rate &&
          aliExpressCommission.commission_rate > 0 && (
            <button
              onClick={generateAliExpressLink}
              disabled={loading}
              className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-md relative overflow-hidden"
              aria-label="Сгенерировать AliExpress ссылку"
              title="Alt+G"
            >
              {loading && (
                <span className="absolute inset-0 bg-orange-500 bg-opacity-20 flex items-center justify-center">
                  <LoadingSpinner />
                </span>
              )}
              <span
                className={`flex items-center justify-center gap-2 ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
              >
                <LinkIcon />
                Сгенерировать AliExpress ссылку
              </span>
            </button>
          )}

        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
            Debug: loading={loading.toString()}, error={error ? 'exists' : 'null'}, errorCode={errorCode}, retryable={retryable.toString()}, retryCount={retryCount}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            <div className="flex items-start gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <div className="font-medium">
                  {errorCode === 'INVALID_URL' ? 'Неверная ссылка' :
                   errorCode === 'NETWORK_ERROR' ? 'Проблема соединения' :
                   errorCode === 'API_ERROR' ? 'Сервис недоступен' : 'Ошибка'}
                </div>
                <div className="mt-1 text-red-500 dark:text-red-300">
                  {error}
                </div>
                {retryCount > 0 && (
                  <div className="mt-1 text-xs opacity-75">
                    Попытка {retryCount}
                  </div>
                )}
              </div>
            </div>
            
            {retryable && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => isYandexValid ? generateYandexLinks() : isAliExpressValid ? generateAliExpressLink() : generatePriceRuLink()}
                  disabled={loading}
                  className="text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 font-medium text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {loading ? 'Повторяем...' : 'Попробовать еще раз'}
                </button>
              </div>
            )}
          </div>
        )}

        {isPriceRuValid && (
          <button
            onClick={generatePriceRuLink}
            disabled={loading}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-md relative overflow-hidden"
            aria-label="Сгенерировать price.ru ссылку"
            title="Alt+G"
          >
            {loading && (
              <span className="absolute inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center">
                <LoadingSpinner />
              </span>
            )}
            <span
              className={`flex items-center justify-center gap-2 ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
            >
              <LinkIcon />
              Сгенерировать price.ru ссылку
            </span>
          </button>
        )}

        {/* Generated Links for Yandex (direct URL only, not search selection) */}
        {yandexLinks && !loading && !selectedSearchResult && (
          <div className="space-y-4 animate-fadeIn">
            <GeneratedLink
              title="Ссылка для сайта"
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              }
              link={yandexLinks.siteLink}
              linkLong={yandexLinks.siteLinkLong}
              field="siteLink"
              onCopy={copy}
              isCopied={isCopied}
              isCached={isCached}
              color="blue"
            />

            {yandexLinks.telegramLink && (
              <GeneratedLink
                title="Ссылка для Телеграм"
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                }
                link={yandexLinks.telegramLink}
                linkLong={yandexLinks.telegramLinkLong}
                field="telegramLink"
                onCopy={copy}
                isCopied={isCopied}
                isCached={isCached}
                color="blue"
              />
            )}
          </div>
        )}

        {/* Yandex Search Links */}
        <YandexSearchSection
          copy={copy}
          isCopied={isCopied}
          onSelectResult={handleSelectSearchResult}
          selectingExternalId={selectingSearchExternalId}
          selectedResult={selectedSearchResult}
          generatedLinks={yandexLinks}
          isGeneratingLinks={loading}
          isCachedLinks={isCached}
        />

        {/* Generated Link for AliExpress */}
        {aliExpressLink && !loading && isAliExpressValid && (
          <div className="animate-fadeIn">
            <GeneratedLink
              title="Партнерская ссылка AliExpress"
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              }
              link={aliExpressLink}
              linkLong={aliExpressLinkLong}
              field="aliExpressLink"
              onCopy={copy}
              isCopied={isCopied}
              isCached={isCached}
              color="orange"
            />
          </div>
        )}

        {/* Generated Link for Price.ru */}
        {priceRuLink && !loading && isPriceRuValid && (
          <div className="animate-fadeIn">
            <GeneratedLink
              title="Партнерская ссылка Price.ru"
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              link={priceRuLink}
              linkLong={priceRuLinkLong}
              field="priceRuLink"
              onCopy={copy}
              isCopied={isCopied}
              isCached={isCached}
              color="green"
            />
          </div>
        )}


      </div>
    </div>
  );
};

export default withErrorBoundary(
  withSuspense(
    SidePanel,
    <div className="flex h-full items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <div className="animate-pulse flex space-x-4">
        <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-10 w-10"></div>
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    </div>,
  ),
  <div className="flex h-full items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
    <div className="text-center">
      <div className="text-red-500 text-xl mb-2">⚠️</div>
      <h3 className="text-lg font-medium mb-2">Что-то пошло не так</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Пожалуйста, обновите страницу и попробуйте снова
      </p>
    </div>
  </div>,
);
