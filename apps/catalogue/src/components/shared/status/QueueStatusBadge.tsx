import { type ScrapeJob } from "@/src/types/scraper";
import { Loader2, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface QueueStatusBadgeProps {
  currentJob?: ScrapeJob;
  isLoading?: boolean;
  hasProfile?: boolean;
}

const statusConfig: Record<string, { label: string; icon: typeof Search | null; className: string }> = {
  uninitialized: {
    label: "Не в очереди",
    icon: null,
    className: "bg-zinc-100 text-zinc-700",
  },
  searching: {
    label: "Поиск устройства",
    icon: Search,
    className: "bg-blue-100 text-blue-700 animate-pulse",
  },
  selecting: {
    label: "Требуется подтверждение",
    icon: AlertCircle,
    className: "bg-yellow-100 text-yellow-700",
  },
  scraping: {
    label: "Получение данных",
    icon: Loader2,
    className: "bg-blue-100 text-blue-700",
  },
  done: {
    label: "Профиль создан",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700",
  },
  error: {
    label: "Ошибка",
    icon: AlertCircle,
    className: "bg-red-100 text-red-700",
  },
  slug_conflict: {
    label: "Дубликат",
    icon: AlertCircle,
    className: "bg-amber-100 text-amber-700",
  },
  interrupted: {
    label: "Прервано",
    icon: AlertCircle,
    className: "bg-orange-100 text-orange-700",
  },
};

export default function QueueStatusBadge({
  currentJob,
  isLoading,
  hasProfile,
}: QueueStatusBadgeProps) {
  if (isLoading) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
        role="status"
        aria-label="Загрузка статуса"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Загрузка...</span>
      </div>
    );
  }

  if (hasProfile) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
        role="status"
        aria-label="Профиль создан"
      >
        <CheckCircle2 className="h-3 w-3" />
        <span>Профиль создан</span>
      </div>
    );
  }

  const status = currentJob?.step || "uninitialized";
  const config = statusConfig[status] ?? statusConfig["uninitialized"]!;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.className
      )}
      role="status"
      aria-label={config.label}
    >
      {Icon && (
        <Icon
          className={cn("h-3 w-3", {
            "animate-spin": status === "searching" || status === "scraping",
          })}
        />
      )}
      <span>{config.label}</span>
      {currentJob?.error && (
        <span className="ml-1 text-[10px] text-red-600">
          {currentJob.error}
        </span>
      )}
    </div>
  );
}
