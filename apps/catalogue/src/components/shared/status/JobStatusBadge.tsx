import { memo } from "react";
import { type ScrapeJob } from "@/src/types/scraper";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/Tooltip";

type Props = {
  deviceId: string;
  hasProfile: boolean;
  isLoading?: boolean;
  currentJob?: ScrapeJob;
};

// const statusConfig = {
//   waitingForSlugConfirmation: {
//     label: "Требуется подтверждение",
//   },
//   waitingForData: {
//     label: "Получение данных",
//   },
//   error: {
//     label: "Ошибка",
//   },
// } as const;

const JobStatusBadge = memo(function JobStatusBadge({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deviceId,
  hasProfile,
  isLoading,
  currentJob,
}: Props) {
  // Profile exists - show green dot
  if (hasProfile) {
    return (
      <div
        className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400"
        role="status"
        aria-label="Профиль создан"
      />
    );
  }

  // Loading - show spinner (searching or scraping in progress)
  if (
    isLoading ||
    currentJob?.step === "searching" ||
    currentJob?.step === "scraping"
  ) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div role="status" aria-label="Получение данных">
              <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Получение данных</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Needs confirmation - show exclamation mark (selecting state)
  if (currentJob?.step === "selecting") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
              role="status"
              aria-label="Требуется подтверждение"
            >
              <AlertCircle className="h-3 w-3 text-gray-600 dark:text-gray-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Требуется подтверждение</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Slug conflict state - duplicate detected
  if (currentJob?.step === "slug_conflict") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-900/30"
              role="status"
              aria-label="Дубликат"
            >
              <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {currentJob.slugConflict?.existingDeviceName
                ? `Дубликат: ${currentJob.slugConflict.existingDeviceName}`
                : "Обнаружен дубликат устройства"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Error state
  if (currentJob?.error || currentJob?.step === "error") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full bg-red-200 dark:bg-red-900/30"
              role="status"
              aria-label="Ошибка"
            >
              <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{currentJob?.error || "Ошибка"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // No status - return null
  return null;
});

export default JobStatusBadge;
