import { cn } from "@/src/utils/cn";
import { RankBadge } from "./RankBadge";

interface RatingBadgeProps {
  position: number;
  categoryName?: string;
  variant?: "card" | "profile";
  size?: "small" | "default" | "large";
  className?: string;
}

export const RatingBadge = ({
  position,
  categoryName,
  variant = "profile",
  size = "default",
  className,
}: RatingBadgeProps) => {
  const sizeConfigs = {
    small: {
      badge: "small" as const,
      gap: "gap-2.5",
      position: "text-lg font-bold tabular-nums",
      label: "text-sm font-medium tracking-tight",
      description: "text-xs",
    },
    default: {
      badge: "default" as const,
      gap: "gap-3",
      position: "text-xl font-bold tabular-nums lg:text-2xl",
      label: "text-sm font-medium tracking-tight lg:text-base",
      description: "text-xs lg:text-sm",
    },
    large: {
      badge: "large" as const,
      gap: "gap-4",
      position: "text-2xl font-bold tabular-nums lg:text-3xl",
      label: "text-base font-medium tracking-tight lg:text-lg",
      description: "text-sm",
    },
  };

  const config = sizeConfigs[size];

  if (variant === "card") {
    return (
      <RankBadge rank={position} size={config.badge} className={className} />
    );
  }

  return (
    <div className={cn("flex items-center", config.gap, className)}>
      <RankBadge rank={position} size={config.badge} />
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(config.position, "text-gray-900 dark:text-white")}
          >
            {position}
          </span>
          <span
            className={cn(config.label, "text-gray-600 dark:text-gray-300")}
          >
            место в рейтинге
          </span>
        </div>
        {categoryName && (
          <span
            className={cn(
              "text-gray-500 dark:text-gray-400",
              config.description
            )}
          >
            {categoryName}
          </span>
        )}
      </div>
    </div>
  );
};
