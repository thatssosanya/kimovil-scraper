import type { InferSelectModel } from "drizzle-orm";
import type { link } from "@/src/server/db/schema";

type Link = InferSelectModel<typeof link>;
import {
  getAgeStyle,
  formatRelativeTime,
  type AgeCategory,
} from "@/src/utils/utils";
import { cn } from "@/src/lib/utils";
import { AlertTriangle, Clock, Smartphone } from "lucide-react";

interface PriceRangeChipProps {
  links: Link[];
}

const pricePlaceholder = (
  <div className="inline-flex flex-col items-start gap-0.5 opacity-0">
    <span className="text-base font-semibold dark:text-gray-100">123</span>
    <div className="flex items-center gap-1">
      <span className={cn("text-xs")}>123</span>
      <Smartphone className={cn("h-3 w-3")} />
    </div>
  </div>
);

export function PriceRangeChip({ links }: PriceRangeChipProps) {
  if (!links || !links.length) return pricePlaceholder;

  const prices = links
    .map((link) => link.price)
    .filter(
      (price): price is number => typeof price === "number" && !isNaN(price)
    );

  if (!prices.length) return pricePlaceholder;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const validDates = links
    .map((link) => link.updatedAt)
    .filter(Boolean)
    .map((date) => {
      // Convert to Date if it's a string, otherwise assume it's already a Date
      const convertedDate =
        typeof date === "string" ? new Date(date) : (date as Date);
      return !isNaN(convertedDate.getTime()) ? convertedDate : null;
    })
    .filter((date): date is Date => date !== null);

  const lastUpdate =
    validDates.length > 0
      ? new Date(Math.max(...validDates.map((date) => date.getTime())))
      : new Date(); // fallback to current date if no valid dates

  const ageStyle: AgeCategory = getAgeStyle(lastUpdate);

  const Icon =
    ageStyle === "aging" || ageStyle === "old"
      ? AlertTriangle
      : ageStyle === "very-old"
      ? Clock
      : null;

  const dateColors: Record<AgeCategory, string> = {
    fresh: "text-emerald-600 dark:text-emerald-400",
    recent: "text-blue-600 dark:text-blue-400",
    aging: "text-yellow-600 dark:text-yellow-500",
    old: "text-orange-600 dark:text-orange-400",
    "very-old": "text-red-600 dark:text-red-400",
  };

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span className="text-base font-semibold dark:text-gray-100">
        {minPrice === maxPrice
          ? `${minPrice.toLocaleString()} ₽`
          : `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} ₽`}
      </span>
      <div className="flex items-center gap-1">
        <span className={cn("text-xs", dateColors[ageStyle])}>
          {formatRelativeTime(lastUpdate)}
        </span>
        {Icon && <Icon className={cn("h-3 w-3", dateColors[ageStyle])} />}
      </div>
    </div>
  );
}
