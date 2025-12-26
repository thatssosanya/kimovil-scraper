import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/src/utils/api";
import { Smartphone } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";

type RatingsDropdownProps = {
  children: React.ReactNode;
  isMobile?: boolean;
  onDropdownStateChange?: (isOpen: boolean) => void;
};

const RatingsDropdown = ({
  children,
  isMobile = false,
  onDropdownStateChange,
}: RatingsDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: ratingPages, isLoading } =
    api.ratingsPage.getAllPages.useQuery();

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
    onDropdownStateChange?.(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      onDropdownStateChange?.(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (isLoading || !ratingPages?.length) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={dropdownRef}
    >
      <motion.div
        className="flex cursor-pointer items-center"
        whileHover={{ scale: isMobile ? 1 : 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
            className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2"
            style={{ minWidth: "600px" }}
          >
            <div className="relative rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              {/* Triangle that appears to be part of the dropdown container */}
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                {/* Border triangle - matches dropdown border color */}
                <div className="h-0 w-0 border-b-[10px] border-l-[10px] border-r-[10px] border-b-gray-200 border-l-transparent border-r-transparent dark:border-b-gray-700"></div>
                {/* Background triangle - matches dropdown background, positioned to overlap perfectly */}
                <div className="absolute left-1/2 top-[1px] h-0 w-0 -translate-x-1/2 border-b-[9px] border-l-[9px] border-r-[9px] border-b-white border-l-transparent border-r-transparent dark:border-b-gray-800"></div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ratingPages.map((page, index) => (
                  <Link
                    key={page.id}
                    href={`/ratings/${page.slug}`}
                    className={`hover:border-primary dark:hover:border-primary group relative overflow-hidden rounded-lg border bg-gradient-to-br from-gray-50 to-gray-100 p-4 transition-all duration-200 dark:border-gray-600 dark:from-gray-700 dark:to-gray-800 ${
                      index === 0 ? "row-span-2" : ""
                    }`}
                  >
                    <div className={`flex h-full flex-col justify-start`}>
                      <div
                        className={`font-semibold text-gray-900 dark:text-white ${
                          index === 0 ? "text-lg" : "text-sm"
                        }`}
                      >
                        {page.name}
                      </div>
                      <div className="mt-auto flex justify-end">
                        <div
                          className={`bg-primary/10 rounded-full ${
                            index === 0 ? "p-3" : "p-2"
                          }`}
                        >
                          {page.iconName ? (
                            <DynamicIcon
                              name={page.iconName as "replace"}
                              className={`text-primary ${
                                index === 0 ? "h-6 w-6" : "h-4 w-4"
                              }`}
                              fallback={() => (
                                <Smartphone
                                  className={`text-primary ${
                                    index === 0 ? "h-6 w-6" : "h-4 w-4"
                                  }`}
                                />
                              )}
                            />
                          ) : (
                            <Smartphone
                              className={`text-primary ${
                                index === 0 ? "h-6 w-6" : "h-4 w-4"
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RatingsDropdown;
