import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/src/utils/cn";
import { type CategoryWithRatings } from "@/src/components/dashboard/device/CategoryView";

type RatingCategoryTabsProps = {
  categories: CategoryWithRatings[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  widgetIconDict: { [key: string]: JSX.Element };
};

export const RatingCategoryTabs: React.FC<RatingCategoryTabsProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  widgetIconDict,
}) => {
  // Create a scrollable ref to allow programmatic scrolling
  const mobileTabsRef = useRef<HTMLDivElement>(null);

  // Scroll selected category into view when it changes on mobile
  useEffect(() => {
    if (mobileTabsRef.current) {
      const container = mobileTabsRef.current;
      const selectedButton = container.querySelector(
        `[data-category="${selectedCategory}"]`
      );

      if (selectedButton) {
        const buttonElement = selectedButton as HTMLElement;

        // Calculate scroll position to center the button
        const scrollLeft =
          buttonElement.offsetLeft -
          container.offsetWidth / 2 +
          buttonElement.offsetWidth / 2;

        container.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        });
      }
    }
  }, [selectedCategory]);

  return (
    <>
      {/* Desktop view - Container and vertical list */}
      <div className="hidden h-full lg:block">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="h-full flex-grow flex-col space-y-1 ">
            {categories.map((category) => {
              const isActive = category.slug === selectedCategory;
              return (
                <motion.button
                  key={category.id}
                  data-category={category.slug}
                  onClick={() => onCategoryChange(category.slug)}
                  className={cn(
                    "group relative flex w-full items-center justify-start rounded-md px-2 py-1.5 text-left transition-all duration-200",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-accent/50"
                  )}
                  aria-selected={isActive}
                  role="tab"
                  aria-controls={`panel-${category.slug}`}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="mr-1.5 flex h-4 w-4 items-center justify-center">
                    {widgetIconDict[category.name] || null}
                  </span>
                  <span className="text-xs">{category.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicatorDesktop"
                      className="absolute bottom-0 left-0 top-0 w-1 rounded-r-md bg-primary"
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
      </div>

      {/* Mobile view - iOS style bottom tab bar */}
      <div className="pb-safe-or-2 fixed bottom-0 left-0 right-0 z-40 bg-background/80 shadow-md backdrop-blur-lg lg:hidden">
        {/* Conditional rendering based on category count */}
        {categories.length <= 5 ? (
          // Fixed grid for 5 or fewer categories
          <div className="flex w-full items-center justify-between px-2 py-2">
            {categories.map((category) => {
              const isActive = category.slug === selectedCategory;
              return (
                <motion.button
                  key={category.id}
                  data-category={category.slug}
                  onClick={() => onCategoryChange(category.slug)}
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center py-1",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  whileTap={{ scale: 0.92 }}
                  aria-selected={isActive}
                  role="tab"
                >
                  <div className="flex h-6 w-6 items-center justify-center">
                    {widgetIconDict[category.name] || null}
                  </div>

                  <span className="mt-0.5 w-full truncate px-1 text-center text-[10px] font-medium">
                    {category.name}
                  </span>

                  {isActive && (
                    <motion.div
                      layoutId="mobileTabIndicator"
                      className="absolute -bottom-1 h-1 w-10 rounded-full bg-primary"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                      }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        ) : (
          // Scrollable container for more than 5 categories
          <div
            ref={mobileTabsRef}
            className="no-scrollbar flex touch-pan-x items-center overflow-x-auto py-2"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex min-w-full px-2">
              {categories.map((category) => {
                const isActive = category.slug === selectedCategory;
                // Calculate flex basis to make items take equal width
                const flexBasis = `${100 / Math.min(categories.length, 5)}%`;
                return (
                  <motion.button
                    key={category.id}
                    data-category={category.slug}
                    onClick={() => onCategoryChange(category.slug)}
                    className={cn(
                      "relative flex flex-col items-center justify-center py-1",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                    style={{ flex: `0 0 ${flexBasis}` }}
                    whileTap={{ scale: 0.92 }}
                    aria-selected={isActive}
                    role="tab"
                  >
                    <div className="flex h-6 w-6 items-center justify-center">
                      {widgetIconDict[category.name] || null}
                    </div>

                    <span className="mt-0.5 w-full truncate px-1 text-center text-[10px] font-medium">
                      {category.name}
                    </span>

                    {isActive && (
                      <motion.div
                        layoutId="mobileTabIndicator"
                        className="absolute -bottom-1 h-1 w-10 rounded-full bg-primary"
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 25,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Gradient edges for scroll indication - only show for scrollable version */}
        {categories.length > 5 && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background/80 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background/80 to-transparent" />
          </>
        )}
      </div>
    </>
  );
};

// You may need to add these utilities to your global CSS or tailwind config:
// .no-scrollbar::-webkit-scrollbar {
//   display: none;
// }
//
// @layer utilities {
//   .pb-safe-or-2 {
//     padding-bottom: max(env(safe-area-inset-bottom), 0.5rem);
//   }
// }
