import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import { IconSwitch } from "@/src/components/ui/IconSwitch";
import {
  Copy,
  Send,
  Settings,
  Wand2,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  VID_OPTIONS,
  highlightUrlParts,
  identifyLinkType,
  isAliExpressUrl,
} from "../utils/link-utils";
import type { ParsedUrl } from "../utils/link-utils";

interface LinkGeneratorProps {
  parsedUrl: ParsedUrl;
  vid: string;
  setVid: (vid: string) => void;
  customVid: string;
  setCustomVid: (vid: string) => void;
  isCustomVid: boolean;
  setIsCustomVid: (isCustom: boolean) => void;
  generatedLink: { url: string; shortUrl: string } | undefined;
  isLoading: boolean;
  onGenerateLink: (type: "telegram" | "website") => void;
}

interface AliExpressDeeplinkResult {
  url: string;
  deeplink: string;
  status: string;
}

interface CreateDeeplinksResponse {
  success: boolean;
  data?: AliExpressDeeplinkResult;
  error?: string;
}

export function LinkGenerator({
  parsedUrl,
  vid,
  setVid,
  customVid,
  setCustomVid,
  isCustomVid,
  setIsCustomVid,
  generatedLink,
  isLoading,
  onGenerateLink,
}: LinkGeneratorProps) {
  const [aliExpressDeeplink, setAliExpressDeeplink] =
    useState<AliExpressDeeplinkResult | null>(null);
  const [isGeneratingDeeplink, setIsGeneratingDeeplink] = useState(false);

  const isAliExpress = isAliExpressUrl(parsedUrl.url);

  const generateAliExpressDeeplink = async () => {
    setIsGeneratingDeeplink(true);
    try {
      const response = await fetch("/api/extension/create-deeplinks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: "s2jq43us23n%EeeAbs2!@#mUt", // For internal use - replace with actual secret in production
          url: parsedUrl.url,
        }),
      });

      const result = (await response.json()) as CreateDeeplinksResponse;

      if (result.success && result.data) {
        setAliExpressDeeplink(result.data);
        toast.success("Партнерская ссылка AliExpress создана!");
      } else {
        toast.error(result.error || "Не удалось создать партнерскую ссылку");
      }
    } catch (error) {
      console.error("Error generating AliExpress deeplink:", error);
      toast.error("Ошибка при создании партнерской ссылки");
    } finally {
      setIsGeneratingDeeplink(false);
    }
  };

  if (isAliExpress) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold">
          Партнерские ссылки AliExpress
        </h2>

        <div className="space-y-4">
          {/* AliExpress Info */}
          <div className="rounded-lg border bg-gradient-to-r from-orange-50 to-amber-50 p-4 dark:from-orange-950/20 dark:to-amber-950/20">
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-0.5 h-5 w-5 text-orange-500" />
              <div className="space-y-2">
                <h3 className="font-semibold text-orange-700 dark:text-orange-300">
                  AliExpress партнерская программа
                </h3>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Создайте партнерскую ссылку через Admitad для получения
                  комиссии. Данная ссылка уже проанализирована на предмет
                  комиссии.
                </p>

                {parsedUrl.aliExpressCommission && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Базовая комиссия:
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {parsedUrl.aliExpressCommission.commission_rate !== null
                          ? `${parsedUrl.aliExpressCommission.commission_rate}%`
                          : "Не доступно"}
                      </span>
                    </div>

                    {parsedUrl.aliExpressCommission.is_hot && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Горячий товар:
                        </span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {parsedUrl.aliExpressCommission
                            .hot_commission_rate !== null
                            ? `${parsedUrl.aliExpressCommission.hot_commission_rate}%`
                            : "Не доступно"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons for AliExpress */}
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-orange-500 text-white shadow-sm hover:bg-orange-600"
              onClick={() => void generateAliExpressDeeplink()}
              disabled={isGeneratingDeeplink}
              size="lg"
            >
              {isGeneratingDeeplink ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Создание...</span>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  Создать партнерскую ссылку
                  <Wand2 className="h-4 w-4" />
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                window.open("https://www.admitad.com/ru/webmaster/", "_blank");
              }}
              size="lg"
            >
              <span className="flex items-center gap-2">
                Admitad партнерка
                <ExternalLink className="h-4 w-4" />
              </span>
            </Button>
          </div>

          {/* Generated deeplink display */}
          {aliExpressDeeplink && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">Партнерская ссылка</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    <TrendingUp className="h-3 w-3" />
                    AliExpress
                  </span>
                </div>
              </div>
              <div className="grid gap-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Партнерская ссылка
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          aliExpressDeeplink.deeplink
                        );
                        toast.success("Партнерская ссылка скопирована");
                      }}
                      className="h-8 gap-1.5 text-muted-foreground hover:text-primary"
                    >
                      <Copy className="h-4 w-4" />
                      Копировать
                    </Button>
                  </div>
                  <div className="break-all rounded-md bg-card p-3 text-xs leading-relaxed tracking-wide shadow-sm">
                    {aliExpressDeeplink.deeplink}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Original URL display */}
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Исходная ссылка</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(parsedUrl.url);
                  toast.success("Ссылка скопирована");
                }}
                className="h-8 gap-1.5 text-muted-foreground hover:text-primary"
              >
                <Copy className="h-4 w-4" />
                Копировать
              </Button>
            </div>
            <div className="break-all rounded-md bg-card p-3 text-xs leading-relaxed tracking-wide shadow-sm">
              {parsedUrl.url}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Original Yandex Market logic
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold">
        Создание партнерских ссылок
      </h2>
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Настройка VID
            </span>
            <IconSwitch
              checked={isCustomVid}
              onCheckedChange={setIsCustomVid}
              leftIcon={Wand2}
              rightIcon={Settings}
              leftLabel="Пресет"
              rightLabel="Свой"
            />
          </div>
          {!isCustomVid ? (
            <Select value={vid} onValueChange={setVid}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Выберите VID" />
              </SelectTrigger>
              <SelectContent>
                {VID_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Введите пользовательский VID"
              value={customVid}
              onChange={(e) => setCustomVid(e.target.value)}
              className="h-11"
            />
          )}
        </div>

        <div className="flex gap-3">
          <Button
            className="flex-1 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
            onClick={() => onGenerateLink("website")}
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? (
              "Создание..."
            ) : (
              <span className="flex items-center gap-2">
                Создать для сайта
                <Wand2 className="h-4 w-4" />
              </span>
            )}
          </Button>
          <Button
            className="flex-1 bg-blue-500 text-white shadow-sm hover:bg-blue-600"
            onClick={() => onGenerateLink("telegram")}
            disabled={isLoading}
            size="lg"
          >
            <span className="flex items-center gap-2">
              {isLoading ? (
                "Создание..."
              ) : (
                <>
                  Создать для Telegram
                  <Send className="h-4 w-4" />
                </>
              )}
            </span>
          </Button>
        </div>

        {generatedLink && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-medium">Созданные ссылки</h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full ${
                    identifyLinkType({
                      clid: generatedLink.url.includes("2913665")
                        ? "2913665"
                        : "2510955",
                    }).bgColor
                  } px-3 py-1 text-sm font-medium ${
                    identifyLinkType({
                      clid: generatedLink.url.includes("2913665")
                        ? "2913665"
                        : "2510955",
                    }).color
                  }`}
                >
                  {
                    identifyLinkType({
                      clid: generatedLink.url.includes("2913665")
                        ? "2913665"
                        : "2510955",
                    }).icon
                  }
                  {
                    identifyLinkType({
                      clid: generatedLink.url.includes("2913665")
                        ? "2913665"
                        : "2510955",
                    }).description
                  }
                </span>
              </div>
            </div>
            <div className="grid gap-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Полная ссылка</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(generatedLink.url);
                      toast.success("Полная ссылка скопирована");
                    }}
                    className="h-8 gap-1.5 text-muted-foreground hover:text-primary"
                  >
                    <Copy className="h-4 w-4" />
                    Копировать
                  </Button>
                </div>
                <div className="break-all rounded-md bg-card p-3 text-xs leading-relaxed tracking-wide shadow-sm">
                  {highlightUrlParts(generatedLink.url)}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Короткая ссылка</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        generatedLink.shortUrl
                      );
                      toast.success("Короткая ссылка скопирована");
                    }}
                    className="h-8 gap-1.5 text-muted-foreground hover:text-primary"
                  >
                    <Copy className="h-4 w-4" />
                    Копировать
                  </Button>
                </div>
                <div className="break-all rounded-md bg-card p-3 text-xs leading-relaxed tracking-wide shadow-sm">
                  {generatedLink.shortUrl}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
