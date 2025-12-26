import React, { useMemo } from "react";
import { cn } from "@/src/utils/cn";
import type { RatingType } from "@/src/server/db/schema";
import { motion } from "framer-motion";
import { type RouterOutputs } from "@/src/utils/api";

type CombinedRatingSelectorProps = {
  ratingTypes: RatingType[];
  selectedRatingType: string | null;
  onRatingTypeChange: (ratingType: string) => void;
  ratings: {
    label: string;
    value: string;
    rating: RouterOutputs['rating']['getAllRatings'][0];
  }[];
  selectedRating: string;
  onRatingChange: (rating: string) => void;
};

export const CombinedRatingSelector: React.FC<CombinedRatingSelectorProps> = ({
  ratingTypes,
  selectedRatingType,
  onRatingTypeChange,
  ratings,
  selectedRating,
  onRatingChange,
}) => {
  // Sort ratings by price
  const sortedRatings = useMemo(() => {
    return [...ratings].sort((a, b) => {
      const aNum = parseInt(a.label.replace(/[^\d]/g, "")) || 0;
      const bNum = parseInt(b.label.replace(/[^\d]/g, "")) || 0;
      return aNum - bNum;
    });
  }, [ratings]);

  // Don't render anything if no data
  if (ratingTypes.length === 0 && ratings.length === 0) return null;

  return (
    <div className="w-full">
      {/* Rating Types Section */}
      {ratingTypes.length > 1 ? (
        <div className="overflow-hidden border-b border-zinc-200 bg-zinc-100 p-2 ">
          <div className="flex flex-wrap gap-1.5">
            {ratingTypes.map((type) => {
              const isActive = type.name === selectedRatingType;
              return (
                <motion.button
                  key={type.id}
                  onClick={() => onRatingTypeChange(type.name)}
                  className={cn(
                    "relative rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-card text-foreground hover:bg-accent/50"
                  )}
                  aria-selected={isActive}
                  role="tab"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {type.displayName || type.name}
                  {isActive && (
                    <motion.span
                      className="absolute inset-0 rounded-md border-2 border-primary"
                      layoutId="activeRatingType"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border-b border-zinc-200 bg-zinc-100 p-2 px-3">
          <div className=" border border-transparent py-1.5 text-xs font-medium text-muted-foreground">
            Выберите рейтинг
          </div>
        </div>
      )}

      {/* Ratings/Budget Section */}
      {ratings.length > 0 && (
        <div className="p-2">
          <div className="flex flex-wrap gap-1.5">
            {sortedRatings.map((option) => {
              const isActive = option.value === selectedRating;
              return (
                <motion.button
                  key={option.value}
                  onClick={() => onRatingChange(option.value)}
                  className={cn(
                    "relative rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-foreground hover:border-border/80 hover:bg-accent/50"
                  )}
                  aria-pressed={isActive}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  layout
                >
                  {option.label}
                  {isActive && (
                    <motion.span
                      className="absolute inset-0 rounded-md border-2 border-primary"
                      layoutId="activeRating"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ zIndex: 1 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinedRatingSelector;
