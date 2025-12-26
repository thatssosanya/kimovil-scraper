import React from "react";
import { cn } from "@/src/utils/cn";
import { type RouterOutputs } from "@/src/utils/api";
import { motion } from "framer-motion";

type RatingSelectorProps = {
  options: {
    label: string;
    value: string;
    rating: RouterOutputs['rating']['getAllRatings'][0];
  }[];
  selectedRating: string;
  onRatingChange: (rating: string) => void;
};

export const RatingSelector: React.FC<RatingSelectorProps> = ({
  options,
  selectedRating,
  onRatingChange,
}) => {
  // Group options by price range for better organization
  const groupedOptions = React.useMemo(() => {
    // Sort options by price (assuming the label contains price information)
    const sortedOptions = [...options].sort((a, b) => {
      // Extract numeric values from labels if possible
      const aNum = parseInt(a.label.replace(/[^\d]/g, "")) || 0;
      const bNum = parseInt(b.label.replace(/[^\d]/g, "")) || 0;
      return aNum - bNum;
    });

    return sortedOptions;
  }, [options]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-wrap gap-1.5">
        {groupedOptions.map((option) => {
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
    </motion.div>
  );
};

export default RatingSelector;
