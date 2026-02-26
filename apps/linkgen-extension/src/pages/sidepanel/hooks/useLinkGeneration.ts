import { useState, useCallback, useEffect, useRef } from "react";
import { linkService, YandexLinkResult } from "@src/services/LinkService";
import { VidAuthor } from "@src/shared/storages/vidStorage";
import { AliExpressCommissionRate } from "@src/shared/utils/utils";

type LinkHookError = {
  code?: string;
  retryable?: boolean;
  userMessage?: string;
  message?: string;
};

interface LinkGenerationState {
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  retryable: boolean;
  retryCount: number;
  yandexLinks: {
    siteLink: string;
    siteLinkLong?: string;
    telegramLink?: string;
    telegramLinkLong?: string;
  } | null;
  aliExpressLink: string | null;
  aliExpressLinkLong: string | null;
  aliExpressCommission: AliExpressCommissionRate | null;
  commissionLoading: boolean;
  commissionError: string | null;
  priceRuLink: string | null;
  priceRuLinkLong: string | null;
  isCached: boolean;
}

export function useLinkGeneration(
  tabId: number | null,
  url: string,
  selectedAuthor: VidAuthor,
) {
  const yandexLinksByUrlRef = useRef<Map<string, YandexLinkResult>>(new Map());
  const [state, setState] = useState<LinkGenerationState>({
    loading: false,
    error: null,
    errorCode: null,
    retryable: false,
    retryCount: 0,
    yandexLinks: null,
    aliExpressLink: null,
    aliExpressLinkLong: null,
    aliExpressCommission: null,
    commissionLoading: false,
    commissionError: null,
    priceRuLink: null,
    priceRuLinkLong: null,
    isCached: false,
  });

  const urlInfo = linkService.parseUrl(url);

  const getYandexCacheKey = useCallback(
    (targetUrl: string) => `${selectedAuthor.id}::${targetUrl.trim()}`,
    [selectedAuthor.id],
  );

  const generateYandexLinks = useCallback(async (targetUrl?: string) => {
    if (!tabId) return;

    const urlToUse = targetUrl ?? url;
    const targetUrlInfo = linkService.parseUrl(urlToUse);
    if (targetUrlInfo.type !== "yandex") return;

    const cacheKey = getYandexCacheKey(urlToUse);
    const cachedLinks = yandexLinksByUrlRef.current.get(cacheKey);
    if (cachedLinks) {
      setState((prev) => ({
        ...prev,
        loading: false,
        yandexLinks: cachedLinks,
        error: null,
        errorCode: null,
        isCached: true,
      }));
      return;
    }

    const persistedCachedLinks = await linkService.getCachedYandexLinksByUrl(
      selectedAuthor.id,
      urlToUse,
    );
    if (persistedCachedLinks) {
      yandexLinksByUrlRef.current.set(cacheKey, persistedCachedLinks);
      setState((prev) => ({
        ...prev,
        loading: false,
        yandexLinks: persistedCachedLinks,
        error: null,
        errorCode: null,
        isCached: true,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      errorCode: null,
      retryable: false,
      isCached: false,
    }));

    try {
      const links = await linkService.generateYandexLinks(urlToUse, selectedAuthor);
      await Promise.all([
        linkService.saveYandexLinks(tabId, selectedAuthor.id, links),
        linkService.saveYandexLinksByUrl(selectedAuthor.id, urlToUse, links),
      ]);
      yandexLinksByUrlRef.current.set(cacheKey, links);

      setState((prev) => ({
        ...prev,
        loading: false,
        yandexLinks: links,
        error: null,
        errorCode: null,
        retryCount: 0,
      }));
    } catch (error: unknown) {
      console.error('Hook caught error:', error);
      
      const parsedError = (error && typeof error === 'object') ? (error as LinkHookError) : null;
      const isLinkError = !!parsedError?.code;
      const userMessage = parsedError?.userMessage
        ? parsedError.userMessage
        : `Ошибка при генерации ссылок: ${parsedError?.message || String(error)}`;
      
      console.log('Setting error state:', {
        userMessage,
        errorCode: isLinkError ? parsedError?.code : 'UNKNOWN_ERROR',
        retryable: isLinkError ? (parsedError?.retryable ?? true) : true,
        retryCount: 'will be incremented'
      });
      
      setState((prev) => ({
        ...prev,
        loading: false,
        error: userMessage,
        errorCode: isLinkError ? (parsedError?.code ?? 'UNKNOWN_ERROR') : 'UNKNOWN_ERROR',
        retryable: isLinkError ? (parsedError?.retryable ?? true) : true,
        retryCount: prev.retryCount + 1,
      }));
    }
  }, [tabId, url, selectedAuthor, getYandexCacheKey]);

  const checkAliExpressCommission = useCallback(async () => {
    if (urlInfo.type !== "aliexpress") return;

    setState((prev) => ({
      ...prev,
      commissionLoading: true,
      commissionError: null,
    }));

    try {
      const commission = await linkService.checkAliExpressCommission(url);
      setState((prev) => ({
        ...prev,
        commissionLoading: false,
        aliExpressCommission: commission,
        commissionError: null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        commissionLoading: false,
        commissionError:
          "Ошибка при проверке комиссии AliExpress. Попробуйте еще раз.",
      }));
    }
  }, [url, urlInfo.type]);

  const generateAliExpressLink = useCallback(async () => {
    if (!tabId || urlInfo.type !== "aliexpress") return;

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      isCached: false,
    }));

    try {
      const result = await linkService.generateAliExpressLink(url);
      await linkService.saveAliExpressLink(
        tabId,
        result,
        state.aliExpressCommission || undefined,
      );

      setState((prev) => ({
        ...prev,
        loading: false,
        aliExpressLink: result.link,
        aliExpressLinkLong: result.linkLong,
        error: null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          "Ошибка при генерации ссылки AliExpress. Пожалуйста, попробуйте снова.",
      }));
    }
  }, [tabId, url, urlInfo.type, state.aliExpressCommission]);

  const generatePriceRuLink = useCallback(async () => {
    if (!tabId || urlInfo.type !== "priceru") return;

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      isCached: false,
    }));

    try {
      const result = await linkService.generatePriceRuLink(url);
      await linkService.savePriceRuLink(tabId, result);

      setState((prev) => ({
        ...prev,
        loading: false,
        priceRuLink: result.link,
        priceRuLinkLong: result.linkLong,
        error: null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          "Ошибка при генерации ссылки price.ru. Пожалуйста, попробуйте снова.",
      }));
    }
  }, [tabId, url, urlInfo.type]);

  const loadCachedLinks = useCallback(async () => {
    if (!tabId) return;

    setState((prev) => ({
      ...prev,
      yandexLinks: null,
      aliExpressLink: null,
      aliExpressLinkLong: null,
      aliExpressCommission: null,
      commissionError: null,
      priceRuLink: null,
      priceRuLinkLong: null,
      isCached: false,
      error: null,
      errorCode: null,
      retryable: false,
      retryCount: 0,
    }));

    if (urlInfo.type === "yandex") {
      const cached = await linkService.getCachedLinks(tabId, selectedAuthor.id);
      if (cached && cached.linkType === "yandex") {
        const links = {
          siteLink: cached.siteLink,
          siteLinkLong: cached.siteLinkLong,
          telegramLink: cached.telegramLink,
          telegramLinkLong: cached.telegramLinkLong,
        };
        yandexLinksByUrlRef.current.set(getYandexCacheKey(url), links);
        await linkService.saveYandexLinksByUrl(selectedAuthor.id, url, links);

        setState((prev) => ({
          ...prev,
          yandexLinks: links,
          isCached: true,
        }));
      }
    } else if (urlInfo.type === "aliexpress") {
      const cached = await linkService.getCachedLinks(tabId, "aliexpress");
      if (cached && cached.linkType === "aliexpress") {
        setState((prev) => ({
          ...prev,
          aliExpressLink: cached.aliExpressLink || cached.siteLink,
          aliExpressLinkLong: cached.aliExpressLinkLong || cached.siteLinkLong,
          aliExpressCommission:
            cached.commissionRate !== undefined
              ? {
                  url: url,
                  product_name: cached.productName || null,
                  commission_rate: cached.commissionRate,
                  hot_commission_rate: cached.hotCommissionRate || null,
                  is_hot: cached.isHot || false,
                }
              : null,
          isCached: true,
        }));
      }
    } else if (urlInfo.type === "priceru") {
      const cached = await linkService.getCachedLinks(tabId, "priceru");
      if (cached && cached.linkType === "priceru") {
        setState((prev) => ({
          ...prev,
          priceRuLink: cached.priceRuLink || cached.siteLink,
          priceRuLinkLong: cached.priceRuLinkLong || cached.siteLinkLong,
          isCached: true,
        }));
      }
    }
  }, [tabId, url, selectedAuthor.id, urlInfo.type, getYandexCacheKey]);

  useEffect(() => {
    loadCachedLinks();
  }, [loadCachedLinks]);

  // Reset commission data when URL changes
  useEffect(() => {
    if (urlInfo.type !== "aliexpress") {
      setState((prev) => ({
        ...prev,
        aliExpressCommission: null,
        commissionError: null,
        commissionLoading: false,
      }));
    }
  }, [url, urlInfo.type]);

  useEffect(() => {
    if (
      urlInfo.type === "aliexpress" &&
      !state.aliExpressCommission &&
      !state.commissionLoading &&
      !state.commissionError
    ) {
      checkAliExpressCommission();
    }
  }, [
    url,
    urlInfo.type,
    state.aliExpressCommission,
    state.commissionLoading,
    state.commissionError,
    checkAliExpressCommission,
  ]);

  return {
    ...state,
    urlInfo,
    generateYandexLinks,
    generateAliExpressLink,
    generatePriceRuLink,
    checkAliExpressCommission,
    loadCachedLinks,
  };
}
