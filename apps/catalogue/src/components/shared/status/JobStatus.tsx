import { useScraperClient } from "@/src/components/dashboard/scraping/hooks/useScraper";
import { useEffect, useState, useCallback } from "react";
import {
  Check,
  Loader2,
  Plus,
  RefreshCw,
  AlertTriangle,
  X,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { api } from "@/src/utils/api";
import type { ScrapeJob } from "@/src/types/scraper";

const STEPS = [
  { key: "searching", label: "Поиск в базе" },
  { key: "selecting", label: "Выбор модели" },
  { key: "scraping", label: "Импорт" },
  { key: "done", label: "Готово" },
] as const;

type CanonicalStep =
  | (typeof STEPS)[number]["key"]
  | "error"
  | "slug_conflict"
  | "interrupted";

const AI_ESTIMATE_MS = 40000;

type AiProgressState = {
  startedAt: number;
  estimatedDurationMs: number;
};

const normalizeStep = (step: ScrapeJob["step"]): CanonicalStep => {
  return step;
};

interface JobStatusProps {
  job?: ScrapeJob;
}

const StepTimeline = ({ currentStep }: { currentStep: CanonicalStep }) => {
  const isErrorLike =
    currentStep === "error" || currentStep === "slug_conflict";
  const currentIndex = isErrorLike
    ? STEPS.findIndex((s) => s.key === "scraping")
    : STEPS.findIndex((s) => s.key === currentStep);

  return (
    <ol className="mt-4 flex items-center gap-1 text-xs">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === STEPS.length - 1;

        return (
          <li key={step.key} className="flex flex-1 items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={[
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium transition-colors",
                  isDone && "bg-primary text-primary-foreground border-primary",
                  isCurrent &&
                    !isDone &&
                    "border-primary text-primary bg-primary/10",
                  !isDone &&
                    !isCurrent &&
                    "border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-500",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isDone ? <Check className="h-3 w-3" /> : index + 1}
              </div>
              <span
                className={[
                  "hidden whitespace-nowrap sm:inline",
                  isCurrent
                    ? "font-medium text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={[
                  "min-w-4 mx-2 h-px flex-1",
                  isDone ? "bg-primary" : "bg-gray-200 dark:bg-gray-800",
                ].join(" ")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

const HeaderRow = ({ step }: { step: CanonicalStep }) => {
  const isError = step === "error";
  const isConflict = step === "slug_conflict";
  const isDone = step === "done";
  const isInterrupted = step === "interrupted";

  const isSelecting = step === "selecting";

  const icon = isError ? (
    <AlertTriangle className="h-5 w-5 text-red-500" />
  ) : isInterrupted ? (
    <AlertTriangle className="h-5 w-5 text-orange-500" />
  ) : isConflict ? (
    <AlertTriangle className="h-5 w-5 text-amber-500" />
  ) : isDone ? (
    <Check className="text-primary h-5 w-5" />
  ) : isSelecting ? (
    <MousePointerClick className="text-primary h-5 w-5" />
  ) : (
    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
  );

  const title = isInterrupted
    ? "Процесс прерван"
    : isError
    ? "Ошибка импорта"
    : isConflict
    ? "Дубликат в базе"
    : step === "searching"
    ? "Поиск устройства"
    : step === "selecting"
    ? "Выберите модель"
    : step === "scraping"
    ? "Загрузка спецификаций"
    : step === "done"
    ? "Импорт завершён"
    : "Инициализация...";

  const subtitle = isInterrupted
    ? "Сервер перезагрузился. Попробуйте повторить."
    : isError
    ? null
    : isConflict
    ? null
    : step === "searching"
    ? "Ищем совпадения по названию"
    : step === "selecting"
    ? "Укажите точную модель"
    : step === "scraping"
    ? "Парсинг и анализ данных"
    : step === "done"
    ? "Данные сохранены"
    : null;

  return (
    <header className="flex items-center gap-2">
      {icon}
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </div>
        )}
      </div>
    </header>
  );
};

const ScrapingProgressPanel = ({
  job,
  step,
  aiProgress,
  onAiStageStart,
}: {
  job: ScrapeJob;
  step: "scraping" | "searching";
  aiProgress: AiProgressState | null;
  onAiStageStart: () => void;
}) => {
  const isAiStage =
    job.progressStage === "ai_processing" || job.progressStage === "parsing";

  useEffect(() => {
    if (isAiStage && !aiProgress) {
      onAiStageStart();
    }
  }, [isAiStage, aiProgress, onAiStageStart]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isAiStage || !aiProgress) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [isAiStage, aiProgress]);

  const elapsedMs = aiProgress ? now - aiProgress.startedAt : 0;
  // Use ease-out curve: starts faster, slows near end. Feels more responsive.
  const linearProgress = aiProgress
    ? Math.min(1, elapsedMs / aiProgress.estimatedDurationMs)
    : 0;
  const aiPercent = Math.round(Math.sqrt(linearProgress) * 95);

  const hasRealPercent =
    typeof job.progressPercent === "number" && job.progressPercent > 0;

  if (isAiStage && aiProgress) {
    const elapsedSec = Math.floor(elapsedMs / 1000);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-700 dark:text-gray-300">
            AI обрабатывает страницу
          </span>
          <span className="tabular-nums text-gray-500 dark:text-gray-400">
            {elapsedSec}с / ~40с
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="bg-primary h-full transition-[width] duration-500 ease-out"
            style={{ width: `${aiPercent}%` }}
          />
        </div>
      </div>
    );
  }

  if (hasRealPercent) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-700 dark:text-gray-300">
            {job.progressStage || "Загрузка страницы"}
          </span>
          <span className="tabular-nums text-gray-500 dark:text-gray-400">
            {job.progressPercent}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="bg-primary h-full transition-[width] duration-300"
            style={{ width: `${job.progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // No extra spinner here - HeaderRow already shows one
  return (
    <div className="text-xs text-gray-500 dark:text-gray-400">
      {step === "searching" ? "Поиск совпадений..." : "Загрузка страницы..."}
    </div>
  );
};

const SelectionPanel = ({
  job,
  onSlugSelect,
  onImportExisting,
  onSearchKimovil,
  isSearchingKimovil,
}: {
  job: ScrapeJob;
  onSlugSelect: (
    slug: string,
    name: string,
    skipConfirmation?: boolean
  ) => void;
  onImportExisting: (slug: string, name: string) => void;
  onSearchKimovil?: () => void;
  isSearchingKimovil?: boolean;
}) => {
  const [selectedSlug, setSelectedSlug] = useState<{
    slug: string;
    name: string;
    isExisting?: boolean;
  } | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [isCustomInputActive, setIsCustomInputActive] = useState(false);

  const handleSlugSelect = (
    slug: string,
    name: string,
    skipConfirmation = false,
    isExisting = false
  ) => {
    if (skipConfirmation || (selectedSlug?.slug === slug && selectedSlug?.isExisting === isExisting)) {
      if (isExisting) {
        onImportExisting(slug, name);
      } else {
        onSlugSelect(slug, name, true);
      }
      setSelectedSlug(null);
    } else {
      setSelectedSlug({ slug, name, isExisting });
    }
  };

  const hasExistingMatches = job.existingMatches && job.existingMatches.length > 0;
  const hasKimovilOptions = job.autocompleteOptions && job.autocompleteOptions.length > 0;

  // No local matches and no Kimovil results yet - show search options
  if (!hasExistingMatches && !hasKimovilOptions) {
    return (
      <div className="space-y-3">
        <div className="py-2 text-center text-xs text-gray-500 dark:text-gray-400">
          Совпадений в базе не найдено
        </div>

        {/* Search Kimovil button */}
        {!job.error && onSearchKimovil && (
          <button
            onClick={onSearchKimovil}
            disabled={isSearchingKimovil}
            className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              {isSearchingKimovil ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Поиск в Kimovil...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  <span>Поиск в Kimovil</span>
                </>
              )}
            </div>
          </button>
        )}

        {/* Error from Kimovil */}
        {job.error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-800/40 dark:bg-amber-900/20">
            <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 mr-1.5" />
            <span className="text-[11px] text-amber-700 dark:text-amber-300">
              {job.error}
            </span>
          </div>
        )}

        {/* Custom input */}
        <div className="pt-2">
          {isCustomInputActive ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Название устройства"
                className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customInput.trim()) {
                    const slug = customInput.toLowerCase().replace(/\s+/g, "-");
                    handleSlugSelect(slug, customInput, true);
                    setCustomInput("");
                    setIsCustomInputActive(false);
                  }
                  if (e.key === "Escape") {
                    setIsCustomInputActive(false);
                    setCustomInput("");
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (customInput.trim()) {
                    const slug = customInput.toLowerCase().replace(/\s+/g, "-");
                    handleSlugSelect(slug, customInput, true);
                    setCustomInput("");
                    setIsCustomInputActive(false);
                  }
                }}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                OK
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsCustomInputActive(true)}
              className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-3 w-3" />
                <span>Ввести вручную</span>
              </div>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Warning banner when Kimovil failed but local options exist */}
      {job.error && hasExistingMatches && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-800/40 dark:bg-amber-900/20">
          <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 mr-1.5" />
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            {job.error}
          </span>
        </div>
      )}

      {/* Existing matches - instant import */}
      {hasExistingMatches && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            <span>Готовые данные (мгновенно)</span>
          </div>
          {job.existingMatches!.map((match) => (
            <button
              key={`existing-${match.slug}`}
              onClick={() => handleSlugSelect(match.slug, match.name, false, true)}
              className={[
                "w-full rounded-md px-3 py-2 text-left text-xs transition-colors",
                selectedSlug?.slug === match.slug && selectedSlug?.isExisting
                  ? "bg-emerald-100 ring-1 ring-emerald-500 dark:bg-emerald-900/50"
                  : "bg-emerald-50/50 hover:bg-emerald-100/50 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-900 dark:text-gray-200">
                  {match.name}
                  {match.brand && (
                    <span className="ml-1 text-gray-500 dark:text-gray-400">
                      ({match.brand})
                    </span>
                  )}
                </span>
                {selectedSlug?.slug === match.slug && selectedSlug?.isExisting && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    Нажмите ещё раз
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Kimovil options - full scrape */}
      {hasKimovilOptions && (
        <div className="space-y-1">
          {hasExistingMatches && (
            <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Или выберите из Kimovil:
            </div>
          )}
          {job.autocompleteOptions!.map((option) => (
            <button
              key={`kimovil-${option.slug}`}
              onClick={() => handleSlugSelect(option.slug, option.name)}
              className={[
                "w-full rounded-md px-3 py-2 text-left text-xs transition-colors",
                selectedSlug?.slug === option.slug && !selectedSlug?.isExisting
                  ? "bg-emerald-50 ring-1 ring-emerald-500/50 dark:bg-emerald-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-900 dark:text-gray-200">
                  {option.name}
                </span>
                {selectedSlug?.slug === option.slug && !selectedSlug?.isExisting && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    Нажмите ещё раз
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search Kimovil button (only if not searched yet and no error) */}
      {!hasKimovilOptions && !job.error && onSearchKimovil && (
        <button
          onClick={onSearchKimovil}
          disabled={isSearchingKimovil}
          className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            {isSearchingKimovil ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Поиск в Kimovil...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                <span>Поиск в Kimovil</span>
              </>
            )}
          </div>
        </button>
      )}

      <div className="pt-2">
        {isCustomInputActive ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Название устройства"
              className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && customInput.trim()) {
                  const slug = customInput.toLowerCase().replace(/\s+/g, "-");
                  handleSlugSelect(slug, customInput, true);
                  setCustomInput("");
                  setIsCustomInputActive(false);
                }
                if (e.key === "Escape") {
                  setIsCustomInputActive(false);
                  setCustomInput("");
                }
              }}
            />
            <Button
              onClick={() => {
                if (customInput.trim()) {
                  const slug = customInput.toLowerCase().replace(/\s+/g, "-");
                  handleSlugSelect(slug, customInput, true);
                  setCustomInput("");
                  setIsCustomInputActive(false);
                }
              }}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              OK
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsCustomInputActive(true)}
            className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-3 w-3" />
              <span>Свой вариант</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

const SuccessPanel = ({ onRefresh }: { onRefresh: () => void }) => (
  <div className="space-y-4">
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Характеристики успешно импортированы и готовы к просмотру.
    </p>

    <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
      <Button
        onClick={onRefresh}
        variant="outline"
        size="sm"
        className="w-full text-xs font-medium"
      >
        Обновить страницу
      </Button>
    </div>
  </div>
);

const ErrorPanel = ({
  job,
  onRetry,
  onCancel,
  onCustomSearch,
}: {
  job: ScrapeJob;
  onRetry: () => void;
  onCancel: () => void;
  onCustomSearch?: (searchString: string) => void;
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [searchTerm, setSearchTerm] = useState(job.deviceName || "");
  const [isSearching, setIsSearching] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    onRetry();
  };

  const handleCancel = () => {
    setIsCancelling(true);
    onCancel();
  };

  const handleCustomSearch = () => {
    if (!searchTerm.trim() || !onCustomSearch) return;
    setIsSearching(true);
    onCustomSearch(searchTerm);
  };

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800/40 dark:bg-red-900/20">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-red-800 dark:text-red-200">
            Не удалось завершить импорт
          </div>
          <div className="mt-1 break-words text-[11px] text-red-700 dark:text-red-300">
            {job.error || "Произошла ошибка при загрузке данных."}
          </div>
          {job.attempts && job.attempts > 1 && (
            <div className="mt-1 text-[11px] text-red-600/70 dark:text-red-400/70">
              Попыток: {job.attempts}
            </div>
          )}
        </div>
      </div>

      {/* Custom search input */}
      {onCustomSearch && (
        <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800/40">
          <div className="text-[11px] text-gray-600 dark:text-gray-400 mb-2">
            Попробуйте другой поисковый запрос:
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Samsung Galaxy S24"
              className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              onKeyDown={(e) => e.key === "Enter" && handleCustomSearch()}
              disabled={isSearching}
            />
            <Button
              onClick={handleCustomSearch}
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={isSearching || !searchTerm.trim()}
            >
              {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Искать"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          disabled={isRetrying}
          onClick={handleRetry}
          size="sm"
          variant="outline"
          className="flex-1 gap-1 text-xs"
        >
          {isRetrying ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {isRetrying ? "Повтор..." : "Повторить"}
        </Button>
        <Button
          disabled={isCancelling}
          onClick={handleCancel}
          size="sm"
          variant="outline"
          className="flex-1 gap-1 text-xs"
        >
          {isCancelling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
          {isCancelling ? "..." : "Закрыть"}
        </Button>
      </div>
    </div>
  );
};

const SlugConflictPanel = ({
  job,
  onCancel,
}: {
  job: ScrapeJob;
  onCancel: () => void;
}) => {
  const [isCancelling, setIsCancelling] = useState(false);

  if (!job.slugConflict) return null;

  const { existingDeviceId, existingDeviceName } = job.slugConflict;

  const handleCancel = () => {
    setIsCancelling(true);
    onCancel();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
          Это устройство уже импортировано:
        </p>
        <a
          href={`/dashboard/devices/${existingDeviceId}`}
          className="text-primary hover:text-primary/80 text-sm font-semibold transition-colors"
        >
          {existingDeviceName || "Открыть устройство"} →
        </a>
      </div>

      {job.lastLog && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {job.lastLog}
        </p>
      )}

      <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          disabled={isCancelling}
          onClick={handleCancel}
        >
          {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {isCancelling ? "Закрытие..." : "Закрыть задачу"}
        </Button>
      </div>
    </div>
  );
};

const FooterMeta = ({ job, step }: { job: ScrapeJob; step: CanonicalStep }) => {
  // slug_conflict handles its own timing display
  if (!job.lastLog || step === "slug_conflict") return null;

  // For terminal states, show timing inline and subtle
  const isTerminal = step === "done" || step === "error";

  return (
    <div
      className={[
        "text-[11px] text-gray-400 dark:text-gray-500",
        isTerminal
          ? "mt-2 text-center"
          : "mt-3 truncate border-t border-gray-100 pt-2 dark:border-gray-800",
      ].join(" ")}
    >
      {job.lastLog}
    </div>
  );
};

const JobStatus = ({ job }: JobStatusProps = {}) => {
  const scraper = useScraperClient();
  const utils = api.useUtils();
  const scrapeJob = job || scraper.selectedDeviceJob;

  const [aiProgress, setAiProgress] = useState<AiProgressState | null>(null);

  const retryMutation = api.scraping.retryJob.useMutation({
    onSuccess: () => {
      void utils.scraping.getJobs.invalidate();
    },
  });

  const cancelMutation = api.scraping.cancelJob.useMutation({
    onSuccess: () => {
      void utils.scraping.getJobs.invalidate();
    },
  });

  const importExistingMutation = api.scraping.importExisting.useMutation({
    onSuccess: () => {
      void utils.scraping.getJobs.invalidate();
    },
  });

  const searchKimovilMutation = api.scraping.searchKimovil.useMutation({
    onSuccess: () => {
      void utils.scraping.getJobs.invalidate();
    },
  });

  const handleAiStageStart = useCallback(() => {
    setAiProgress({
      startedAt: Date.now(),
      estimatedDurationMs: AI_ESTIMATE_MS,
    });
  }, []);

  useEffect(() => {
    if (!scrapeJob) return;
    const step = normalizeStep(scrapeJob.step);
    if (step !== "scraping") {
      setAiProgress(null);
    }
  }, [scrapeJob?.step, scrapeJob]);

  if (!scrapeJob) return null;

  const step = normalizeStep(scrapeJob.step);

  const handleRetry = () => {
    if (!scrapeJob.deviceId) return;
    retryMutation.mutate({ deviceId: scrapeJob.deviceId });
  };

  const handleCancel = () => {
    if (!scrapeJob.deviceId) return;
    cancelMutation.mutate({ deviceId: scrapeJob.deviceId });
  };

  const handleSlugSelect = (
    slug: string,
    _name: string,
    skipConfirmation = false
  ) => {
    if (skipConfirmation) {
      void scraper.confirmSlugSelection(slug);
    }
  };

  const handleImportExisting = (slug: string, _name: string) => {
    if (!scrapeJob.deviceId) return;
    importExistingMutation.mutate({ deviceId: scrapeJob.deviceId, slug });
  };

  const handleRefresh = () => {
    void utils.device.getDeviceCharacteristic.invalidate();
  };

  const handleCustomSearch = (searchString: string) => {
    if (!scrapeJob.deviceId) return;
    retryMutation.mutate({
      deviceId: scrapeJob.deviceId,
      searchString,
    });
  };

  const handleSearchKimovil = () => {
    if (!scrapeJob.deviceId) return;
    searchKimovilMutation.mutate({ deviceId: scrapeJob.deviceId });
  };

  // Show selection panel when:
  // 1. In "selecting" step (Kimovil search complete)
  // 2. In "searching" step but has existing matches (fast path ready)
  const hasExistingMatches = scrapeJob.existingMatches && scrapeJob.existingMatches.length > 0;
  const showSelection = step === "selecting" || (step === "searching" && hasExistingMatches);

  const renderBody = () => {
    if (step === "error" || step === "interrupted") {
      return (
        <ErrorPanel
          job={scrapeJob}
          onRetry={handleRetry}
          onCancel={handleCancel}
          onCustomSearch={handleCustomSearch}
        />
      );
    }

    if (step === "slug_conflict") {
      return <SlugConflictPanel job={scrapeJob} onCancel={handleCancel} />;
    }

    if (showSelection) {
      return (
        <SelectionPanel
          job={scrapeJob}
          onSlugSelect={handleSlugSelect}
          onImportExisting={handleImportExisting}
          onSearchKimovil={handleSearchKimovil}
          isSearchingKimovil={searchKimovilMutation.isPending}
        />
      );
    }

    if (step === "scraping" || step === "searching") {
      return (
        <ScrapingProgressPanel
          job={scrapeJob}
          step={step}
          aiProgress={aiProgress}
          onAiStageStart={handleAiStageStart}
        />
      );
    }

    if (step === "done") {
      return <SuccessPanel onRefresh={handleRefresh} />;
    }

    return null;
  };

  const showStepTimeline =
    step !== "error" && step !== "slug_conflict" && step !== "done" && step !== "interrupted";

  // Override step display when showing selection during searching
  const displayStep = showSelection && step === "searching" ? "selecting" : step;

  return (
    <div>
      <HeaderRow step={displayStep as CanonicalStep} />
      {showStepTimeline && <StepTimeline currentStep={displayStep as CanonicalStep} />}
      <div className="mt-4">{renderBody()}</div>
      <FooterMeta job={scrapeJob} step={step} />
    </div>
  );
};

export default JobStatus;
