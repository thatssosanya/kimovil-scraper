import { Copy, ExternalLink, TrendingUp, Flame } from "lucide-react";
import { toast } from "sonner";
import {
  type ParsedUrl,
  HIDDEN_PARAMS,
  identifyLinkType,
  isAliExpressUrl,
} from "../utils/link-utils";

interface LinkAnalysisProps {
  url: string;
  parsedUrl: ParsedUrl;
}

export function LinkAnalysis({ url, parsedUrl }: LinkAnalysisProps) {
  const isAliExpress = isAliExpressUrl(url);

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Анализ ссылки</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full ${
                isAliExpress
                  ? "bg-orange-500/10 text-orange-500"
                  : identifyLinkType(parsedUrl.params).bgColor
              } px-3 py-1 text-sm font-medium ${
                isAliExpress ? "" : identifyLinkType(parsedUrl.params).color
              }`}
            >
              {isAliExpress ? (
                <>
                  <TrendingUp className="h-3.5 w-3.5" />
                  AliExpress
                </>
              ) : (
                <>
                  {identifyLinkType(parsedUrl.params).icon}
                  {identifyLinkType(parsedUrl.params).label}
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
              Открыть
            </a>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Ссылка скопирована");
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              <Copy className="h-4 w-4" />
              Копировать
            </button>
          </div>
        </div>

        {/* AliExpress Commission Information */}
        {isAliExpress && parsedUrl.aliExpressCommission && (
          <div className="rounded-lg border bg-gradient-to-r from-orange-50 to-red-50 p-4 dark:from-orange-950/20 dark:to-red-950/20">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold text-orange-700 dark:text-orange-300">
                Информация о комиссии AliExpress
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {parsedUrl.aliExpressCommission.product_name && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Название товара
                  </span>
                  <p className="text-sm font-medium">
                    {parsedUrl.aliExpressCommission.product_name}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Базовая комиссия
                </span>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">
                  {parsedUrl.aliExpressCommission.commission_rate !== null
                    ? `${parsedUrl.aliExpressCommission.commission_rate}%`
                    : "Не доступно"}
                </p>
              </div>

              {parsedUrl.aliExpressCommission.is_hot && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Flame className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      Горячий товар
                    </span>
                  </div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">
                    {parsedUrl.aliExpressCommission.hot_commission_rate !== null
                      ? `${parsedUrl.aliExpressCommission.hot_commission_rate}%`
                      : "Не доступно"}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Статус товара
                </span>
                <div className="flex items-center gap-2">
                  {parsedUrl.aliExpressCommission.is_hot ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
                      <Flame className="h-3 w-3" />
                      Горячий товар
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Обычный товар
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border bg-muted/30">
          <div className="grid grid-cols-3 gap-px bg-muted">
            {parsedUrl.title && (
              <div className="col-span-3 bg-card p-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Название страницы
                </span>
                <p className="mt-1 text-sm font-medium">{parsedUrl.title}</p>
              </div>
            )}
            <div className="bg-card p-3">
              <span className="text-xs font-medium text-muted-foreground">
                Протокол
              </span>
              <p className="mt-1 text-sm">{parsedUrl.protocol}</p>
            </div>
            <div className="col-span-2 bg-card p-3">
              <span className="text-xs font-medium text-muted-foreground">
                Хост
              </span>
              <p className="mt-1 text-sm">{parsedUrl.hostname}</p>
            </div>
            <div className="col-span-3 bg-card p-3">
              <span className="text-xs font-medium text-muted-foreground">
                Путь
              </span>
              <p className="mt-1 text-sm">{parsedUrl.pathname}</p>
            </div>
          </div>
        </div>

        {/* Parameters */}
        {Object.entries(parsedUrl.params).filter(
          ([key]) => !HIDDEN_PARAMS.has(key)
        ).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Параметры</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(parsedUrl.params)
                .filter(([key]) => !HIDDEN_PARAMS.has(key))
                .map(([key, value]) => (
                  <div key={key} className="rounded-md bg-muted/30 p-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {key}
                    </span>
                    <p className="mt-1 break-all text-xs">{value}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
