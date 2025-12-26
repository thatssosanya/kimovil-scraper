import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/DropdownMenu";
import {
  Eye,
  EyeOff,
  FileText,
  Archive,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  PUBLISH_STATUS,
  PUBLISH_STATUS_LABELS,
} from "@/src/constants/publishStatus";
import type { PublishStatus } from "@/src/constants/publishStatus";
import { cn } from "@/src/lib/utils";

interface RatingStatusToggleProps {
  currentStatus: string;
  onStatusChange: (status: PublishStatus) => void;
  isLoading?: boolean;
  label?: string;
}

const statusConfig = {
  [PUBLISH_STATUS.DRAFT]: {
    label: PUBLISH_STATUS_LABELS[PUBLISH_STATUS.DRAFT],
    icon: FileText,
    className:
      "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700",
  },
  [PUBLISH_STATUS.PUBLISHED]: {
    label: PUBLISH_STATUS_LABELS[PUBLISH_STATUS.PUBLISHED],
    icon: Eye,
    className:
      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50",
  },
  [PUBLISH_STATUS.PRIVATE]: {
    label: PUBLISH_STATUS_LABELS[PUBLISH_STATUS.PRIVATE],
    icon: EyeOff,
    className:
      "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50",
  },
  [PUBLISH_STATUS.ARCHIVED]: {
    label: PUBLISH_STATUS_LABELS[PUBLISH_STATUS.ARCHIVED],
    icon: Archive,
    className:
      "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50",
  },
};

export const RatingStatusToggle: React.FC<RatingStatusToggleProps> = ({
  currentStatus,
  onStatusChange,
  isLoading = false,
  label,
}) => {
  const currentConfig =
    statusConfig[currentStatus as PublishStatus] ||
    statusConfig[PUBLISH_STATUS.DRAFT];
  const Icon = currentConfig.icon;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isLoading}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
              currentConfig.className
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{currentConfig.label}</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40 p-1">
          {Object.entries(statusConfig).map(([status, config]) => {
            const StatusIcon = config.icon;
            const isSelected = status === currentStatus;

            return (
              <DropdownMenuItem
                key={status}
                onClick={() => onStatusChange(status as PublishStatus)}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs"
                disabled={isSelected || isLoading}
              >
                <StatusIcon className="h-3 w-3" />
                <span>{config.label}</span>
                {isSelected && (
                  <Check className="text-muted-foreground ml-auto h-3 w-3" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
