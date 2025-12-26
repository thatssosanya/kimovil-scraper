import * as React from "react";
import { StatusSelector } from "./StatusSelector";
import { type PublishStatus } from "@/src/constants/publishStatus";
import { cn } from "@/src/lib/utils";

interface CompactStatusControlProps {
  status: PublishStatus;
  publishedAt?: Date | null;
  onStatusChange: (status: PublishStatus) => void;
  disabled?: boolean;
  className?: string;
}

export const CompactStatusControl = ({
  status,
  publishedAt,
  onStatusChange,
  disabled = false,
  className,
}: CompactStatusControlProps) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <StatusSelector
        value={status}
        onValueChange={onStatusChange}
        className="h-7 w-auto min-w-[140px] py-0"
        disabled={disabled}
      />
      {publishedAt && (
        <div className="text-xs text-muted-foreground">
          {publishedAt.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
};
