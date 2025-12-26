import React from "react";
import { cn } from "@/src/utils/cn";
import type { RatingType } from "@/src/server/db/schema";
import { motion } from "framer-motion";

type RatingTypeTabsProps = {
  ratingTypes: RatingType[];
  selectedRatingType: string | null;
  onRatingTypeChange: (ratingType: string) => void;
};

export const RatingTypeTabs: React.FC<RatingTypeTabsProps> = ({
  ratingTypes,
  selectedRatingType,
  onRatingTypeChange,
}) => {
  if (ratingTypes.length <= 1) return null;

  return (
    <motion.div
      className="flex flex-wrap gap-1.5"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
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
            aria-controls={`panel-type-${type.id}`}
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
    </motion.div>
  );
};
