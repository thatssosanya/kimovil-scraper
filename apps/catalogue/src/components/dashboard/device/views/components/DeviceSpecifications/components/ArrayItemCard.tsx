import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/src/components/ui/Button";

interface ArrayItemCardProps {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
}

export function ArrayItemCard({
  title,
  badge,
  children,
  onRemove,
  className,
}: ArrayItemCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 mt-2 ml-3",
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {title}
          </span>
          {badge}
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

interface ArrayItemBadgeProps {
  children: ReactNode;
  variant?: "blue" | "purple" | "green" | "orange";
}

export function ArrayItemBadge({ children, variant = "blue" }: ArrayItemBadgeProps) {
  const variants = {
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", variants[variant])}>
      {children}
    </span>
  );
}
