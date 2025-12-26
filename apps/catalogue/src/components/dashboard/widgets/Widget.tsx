import { type ReactNode } from "react";
import { Expand, Minimize2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface WidgetProps {
  title: string;
  loading?: boolean;
  error?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children: ReactNode;
  className?: string;
}

interface WidgetSkeletonProps {
  expanded?: boolean;
}

function WidgetSkeleton({ expanded }: WidgetSkeletonProps) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      {expanded && (
        <>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        </>
      )}
    </div>
  );
}

function WidgetError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
    </div>
  );
}

export function Widget({
  title,
  loading,
  error,
  expanded = false,
  onToggleExpand,
  children,
  className,
}: WidgetProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 transition-all",
        "dark:border-gray-800 dark:bg-[hsl(0_0%_9%)]",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold dark:text-gray-200">{title}</h2>
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={expanded ? "Свернуть" : "Развернуть"}
            type="button"
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <Expand className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        )}
      </div>
      {loading ? (
        <WidgetSkeleton expanded={expanded} />
      ) : error ? (
        <WidgetError message={error} />
      ) : (
        children
      )}
    </div>
  );
}
