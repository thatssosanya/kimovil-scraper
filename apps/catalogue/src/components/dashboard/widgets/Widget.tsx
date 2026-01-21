import { type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface WidgetProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

interface WidgetSkeletonProps {
  expanded?: boolean;
}

function WidgetSkeleton({ expanded }: WidgetSkeletonProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
      {expanded && (
        <>
          <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        </>
      )}
    </div>
  );
}

function WidgetError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200/60 bg-red-50 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/30">
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
    </div>
  );
}

export function Widget({
  title,
  subtitle,
  loading,
  error,
  expanded = false,
  onToggleExpand,
  children,
  className,
  headerAction,
}: WidgetProps) {
  return (
    <div
      className={cn(
        "group/widget relative flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm",
        "dark:border-gray-800 dark:bg-[hsl(0_0%_9%)] dark:shadow-none",
        expanded && "ring-1 ring-gray-200 dark:ring-gray-700",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-gray-800/60 dark:bg-[hsl(0_0%_7%)]">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          {subtitle && (
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-500">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {headerAction}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className={cn(
                "rounded-md p-1.5 text-gray-400 transition-colors",
                "hover:bg-gray-200/60 hover:text-gray-600",
                "dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              )}
              aria-label={expanded ? "Свернуть" : "Развернуть"}
              type="button"
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {loading ? (
          <WidgetSkeleton expanded={expanded} />
        ) : error ? (
          <WidgetError message={error} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
