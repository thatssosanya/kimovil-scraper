import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/src/utils/api";
import {
  type ParsedUrl,
  parseUrl,
  isYandexMarketUrl,
  isAliExpressUrl,
} from "../utils/link-utils";

interface UseLinkAnalyzerOptions {
  onAnalysisStart?: () => void;
}

export function useLinkAnalyzer({
  onAnalysisStart,
}: UseLinkAnalyzerOptions = {}) {
  const [url, setUrl] = useState("");
  const [parsedUrl, setParsedUrl] = useState<ParsedUrl | null>(null);

  const unshortenMutation = api.link.unshorten.useMutation({
    onSuccess: (result) => {
      try {
        if (!result.resolvedUrl) {
          toast.error("Не удалось получить конечную ссылку");
          setParsedUrl(null);
          return;
        }

        // Check if it's AliExpress URL
        if (isAliExpressUrl(result.resolvedUrl)) {
          const parsed = parseUrl(result.resolvedUrl, result.title);
          setParsedUrl(parsed);

          // Fetch commission data for AliExpress
          void checkAliExpressCommission
            .mutateAsync({
              urls: [result.resolvedUrl],
            })
            .then((commissionResult) => {
              if (
                commissionResult.success &&
                commissionResult.data.commission_rates.length > 0
              ) {
                const commissionData =
                  commissionResult.data.commission_rates[0];
                setParsedUrl((prev) =>
                  prev
                    ? {
                        ...prev,
                        aliExpressCommission: commissionData,
                      }
                    : null
                );
              }
            })
            .catch((error) => {
              console.error("Failed to fetch AliExpress commission:", error);
              // Don't show error to user, just continue without commission data
            });
          return;
        }

        // Try to parse the URL for Yandex Market
        if (isYandexMarketUrl(result.resolvedUrl)) {
          setParsedUrl(parseUrl(result.resolvedUrl, result.title));
        } else {
          console.log(
            "Ссылка не ведет на Яндекс.Маркет или AliExpress",
            result.resolvedUrl
          );
          toast.error("Ссылка не ведет на Яндекс.Маркет или AliExpress");
          setParsedUrl(null);
        }
      } catch (_error) {
        toast.error("Не удалось разобрать ссылку");
        setParsedUrl(null);
      }
    },
    onError: (error) => {
      // Extract only the message from the error, ignoring validation details
      const errorMessage = error.message.includes("[")
        ? "Некорректный формат ссылки"
        : error.message;

      toast.error("Ошибка", {
        description: errorMessage,
      });
      setParsedUrl(null);
    },
  });

  const checkAliExpressCommission =
    api.link.checkAliExpressCommission.useMutation();

  const handleAnalyze = () => {
    if (!url) {
      toast.error("Введите ссылку");
      return;
    }

    setParsedUrl(null);
    onAnalysisStart?.();

    try {
      // Try to parse the URL first to validate format
      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

      // Check if it's AliExpress URL
      if (isAliExpressUrl(normalizedUrl)) {
        const parsed = parseUrl(normalizedUrl);
        setParsedUrl(parsed);

        // Fetch commission data for AliExpress
        void checkAliExpressCommission
          .mutateAsync({
            urls: [normalizedUrl],
          })
          .then((commissionResult) => {
            if (
              commissionResult.success &&
              commissionResult.data.commission_rates.length > 0
            ) {
              const commissionData = commissionResult.data.commission_rates[0];
              setParsedUrl((prev) =>
                prev
                  ? {
                      ...prev,
                      aliExpressCommission: commissionData,
                    }
                  : null
              );
            }
          })
          .catch((error) => {
            console.error("Failed to fetch AliExpress commission:", error);
            // Don't show error to user, just continue without commission data
          });
        return;
      }

      // If it's already a Yandex Market URL, parse it directly
      if (isYandexMarketUrl(normalizedUrl)) {
        setParsedUrl(parseUrl(normalizedUrl));
      } else {
        // For other URLs, try to unshorten
        void unshortenMutation.mutateAsync({ url: normalizedUrl });
      }
    } catch (_error) {
      toast.error("Некорректный формат ссылки");
    }
  };

  return {
    url,
    setUrl,
    parsedUrl,
    handleAnalyze,
    isLoading:
      unshortenMutation.isPending || checkAliExpressCommission.isPending,
  };
}
