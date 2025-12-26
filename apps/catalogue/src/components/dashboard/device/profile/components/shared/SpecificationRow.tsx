import { useCallback, useMemo } from "react";
import Image from "next/image";
import {
  ExternalLink,
  ImageIcon,
  HelpCircle,
  Loader2,
  Wand2,
} from "lucide-react";
import { InlineEditableInput } from "@/src/components/ui/InlineEditableInput";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/src/components/ui/Tooltip";
import type { TableRowField } from "../../types";
import type { Link } from "@/src/server/db/schema";
import { api } from "@/src/utils/api";
import { toast } from "sonner";

interface SpecificationRowProps {
  field: TableRowField;
  onSave: (value: unknown) => void;
  deviceId: string;
  links?: LinkWithMarketplace[];
}

type LinkWithMarketplace = Link & {
  marketplace?: {
    id: string;
    name?: string | null;
  } | null;
};

function extractYandexMarketProductId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);

    const pathSegments = parsedUrl.pathname
      .split("/")
      .filter((segment) => segment.length > 0);

    const pathCandidate = [...pathSegments]
      .reverse()
      .find((segment) => /^\d+$/.test(segment));
    if (pathCandidate) {
      return pathCandidate;
    }

    const PARAM_CANDIDATES = ["sku", "productId", "product_id"];
    for (const param of PARAM_CANDIDATES) {
      const value = parsedUrl.searchParams.get(param);
      if (value && /^\d+$/.test(value)) {
        return value;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function SpecificationRow({
  field,
  onSave,
  deviceId,
  links,
}: SpecificationRowProps) {
  const unshortenMutation = api.link.unshorten.useMutation();

  const handleSave = useCallback((value: string) => {
    const processedValue = field.type === "number" ? 
      (value.trim() === "" ? null : Number(value)) : 
      (value.trim() === "" ? null : value);
    onSave(processedValue);
  }, [field.type, onSave]);

  const latestYandexDistributionLink = useMemo(() => {
    if (field.key !== "yandexId" || !links?.length) {
      return null;
    }

    const filteredLinks = links.filter((link) => {
      const marketplaceName = link.marketplace?.name?.trim().toLowerCase();
      return (
        marketplaceName === "яндекс.дистрибуция" &&
        typeof link.url === "string" &&
        link.url.trim().length > 0
      );
    });

    if (filteredLinks.length === 0) {
      return null;
    }

    const parseTimestamp = (value: Date | string | null | undefined) => {
      if (!value) return 0;
      const timestamp = new Date(value).getTime();
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    return filteredLinks.reduce<LinkWithMarketplace | null>((latest, link) => {
      if (!latest) return link;
      const latestTime = parseTimestamp(latest.updatedAt ?? latest.createdAt);
      const currentTime = parseTimestamp(link.updatedAt ?? link.createdAt);
      return currentTime > latestTime ? link : latest;
    }, null);
  }, [field.key, links]);

  const handleExtractYandexId = useCallback(async () => {
    if (!latestYandexDistributionLink?.url) {
      toast.error("Подходящая ссылка Яндекс.Дистрибуции не найдена");
      return;
    }

    try {
      const result = await unshortenMutation.mutateAsync({
        url: latestYandexDistributionLink.url,
      });

      const resolvedUrl =
        result.resolvedUrl || result.originalUrl || latestYandexDistributionLink.url;

      const extractedId = extractYandexMarketProductId(resolvedUrl);
      if (!extractedId) {
        toast.error("Не удалось извлечь Yandex ID из ссылки");
        return;
      }

      handleSave(extractedId);
      toast.success(`Yandex ID ${extractedId} извлечен из ссылки`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось обработать ссылку";
      toast.error("Ошибка при извлечении ID", {
        description: message,
      });
    }
  }, [handleSave, latestYandexDistributionLink, unshortenMutation]);

  const showExtractButton = field.key === "yandexId" && !!latestYandexDistributionLink;

  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <div className="flex items-center gap-1.5 w-32 shrink-0">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {field.label}
        </span>
        {(field.hint || showExtractButton) && (
          <div className="flex items-center gap-1">
            {field.hint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  {field.hint}
                </TooltipContent>
              </Tooltip>
            )}
            {showExtractButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleExtractYandexId}
                    disabled={unshortenMutation.isPending}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 transition-colors disabled:opacity-60 disabled:cursor-wait"
                    aria-label="Извлечь Yandex ID из ссылки Яндекс.Дистрибуции"
                  >
                    {unshortenMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  Извлечь ID из последней ссылки Яндекс.Дистрибуции
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {field.type === "select" && field.options ? (
          <select
            value={String(field.value ?? "")}
            onChange={(e) => handleSave(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 focus:rounded focus:px-2 focus:py-1 focus:bg-white dark:focus:bg-gray-800 cursor-pointer"
          >
            <option value="">—</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === "image" ? (
          <div className="flex items-center gap-2">
            {field.value ? (
              <>
                <div className="relative h-8 w-8 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <Image
                    src={String(field.value)}
                    alt="Device image preview"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="truncate max-w-[200px]">{String(field.value)}</span>
                  <a
                    href={String(field.value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Открыть изображение в новой вкладке"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <ImageIcon className="h-4 w-4" />
                <span>Используйте редактор изображений в заголовке</span>
              </div>
            )}
          </div>
        ) : (
          <InlineEditableInput
            type={field.type === "textarea" ? "textarea" : "input"}
            value={field.value ? String(field.value) : ""}
            onSave={handleSave}
            placeholder="—"
            uniqueKey={`${field.key}-${deviceId}`}
            className="text-sm"
            rows={field.type === "textarea" ? 2 : undefined}
          />
        )}
      </div>
    </div>
  );
}
