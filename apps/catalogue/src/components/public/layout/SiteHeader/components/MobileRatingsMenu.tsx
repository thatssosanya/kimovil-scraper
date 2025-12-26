import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/src/utils/api";
import { ChevronDown, Smartphone } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";

type MobileRatingsMenuProps = {
  onItemClick?: () => void;
  isActive?: boolean;
};

const MobileRatingsMenu = ({ onItemClick, isActive }: MobileRatingsMenuProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: ratingPages, isLoading } = api.ratingsPage.getAllPages.useQuery();

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  if (isLoading || !ratingPages?.length) {
    return (
      <Link
        href="/ratings"
        className={`block w-full py-3 text-left text-base font-medium transition-colors ${
          isActive
            ? "text-primary font-semibold"
            : "text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white focus:text-gray-900 dark:focus:text-white"
        }`}
        onClick={onItemClick}
      >
        Рейтинги
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <motion.button
        onClick={handleToggle}
        className={`flex w-full items-center justify-between py-3 text-left text-base font-medium transition-colors ${
          isActive
            ? "text-primary font-semibold"
            : "text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white focus:text-gray-900 dark:focus:text-white"
        }`}
        whileHover={{
          x: 4,
          transition: { duration: 0.15, ease: [0.4, 0.0, 0.2, 1] },
        }}
        whileTap={{
          scale: 0.98,
          transition: { duration: 0.1 },
        }}
      >
        <span>Рейтинги</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-4 space-y-1 border-l border-gray-200 pl-4 dark:border-gray-700">
              {ratingPages.map((page) => (
                <Link
                  key={page.id}
                  href={`/ratings/${page.slug}`}
                  className="flex items-center gap-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  onClick={onItemClick}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    {page.iconName ? (
                      <DynamicIcon
                        name={page.iconName as "replace"}
                        className="h-4 w-4 text-primary"
                        fallback={() => (
                          <Smartphone className="h-4 w-4 text-primary" />
                        )}
                      />
                    ) : (
                      <Smartphone className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span>{page.name}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileRatingsMenu;