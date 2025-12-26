import { Loader2 } from "lucide-react";

export function LoadingStates() {
  return {
    ProfileSkeleton: () => (
      <div className="h-full w-full animate-pulse">
        <div className="flex h-full gap-6">
          <div className="min-w-0 flex-1 space-y-6 p-6">
            <div className="h-32 rounded-lg dark:bg-gray-800" />
            <div className="h-64 rounded-lg dark:bg-gray-800" />
            <div className="h-48 rounded-lg dark:bg-gray-800" />
          </div>
          <div className="w-80 space-y-4 p-6">
            <div className="h-40 rounded-lg dark:bg-gray-800" />
            <div className="h-32 rounded-lg dark:bg-gray-800" />
            <div className="h-24 rounded-lg dark:bg-gray-800" />
          </div>
        </div>
      </div>
    ),

    Spinner: ({ className = "" }: { className?: string }) => (
      <div className={`flex items-center justify-center ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin dark:text-gray-400" />
      </div>
    ),

    CardSkeleton: ({ className = "" }: { className?: string }) => (
      <div className={`animate-pulse rounded-lg dark:bg-gray-800 ${className}`} />
    ),
  };
}