import Link from "next/link";
import { clsx } from "clsx";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import RatingsDropdown from "./RatingsDropdown";
import MobileRatingsMenu from "./MobileRatingsMenu";

type MenuItem = {
  id: string;
  title: string;
  href: string;
  external?: boolean;
  hasDropdown?: boolean;
};

type NavItemProps = {
  item: MenuItem;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  isMobile?: boolean;
};

const NavItem = ({
  item,
  active,
  onClick,
  className = "",
  isMobile = false,
}: NavItemProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const baseClasses = isMobile
    ? "block w-full py-3 text-left text-base font-medium transition-colors"
    : "whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-medium transition-colors";

  const activeClasses = isMobile
    ? "text-primary font-semibold"
    : "pointer-events-none cursor-default bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white";

  const inactiveClasses = isMobile
    ? "text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white focus:text-gray-900 dark:focus:text-white"
    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 hover:text-gray-900 dark:hover:text-white";

  const linkClasses = clsx(
    baseClasses,
    active ? activeClasses : inactiveClasses,
    className
  );

  // Mobile hover animation props
  const mobileHoverProps = isMobile
    ? {
        whileHover: {
          x: 4,
          transition: { duration: 0.15, ease: [0.4, 0.0, 0.2, 1] },
        },
        whileTap: {
          scale: 0.98,
          transition: { duration: 0.1 },
        },
      }
    : {};

  // Handle dropdown items
  if (item.hasDropdown && item.id === "ratings") {
    // On mobile, show expandable menu
    if (isMobile) {
      return (
        <MobileRatingsMenu
          onItemClick={onClick}
          isActive={active}
        />
      );
    }

    // On desktop, wrap with dropdown
    const linkElement = item.external ? (
      <motion.a
        href={item.href}
        className={linkClasses}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        target="_blank"
        rel="noopener noreferrer"
        {...mobileHoverProps}
      >
        {item.title}
      </motion.a>
    ) : (
      <motion.div {...mobileHoverProps}>
        <Link
          href={item.href}
          className={clsx(linkClasses, "flex items-center gap-1")}
          aria-current={active ? "page" : undefined}
          onClick={onClick}
        >
          {item.title}
          <motion.div
            animate={{ rotate: isDropdownOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3 w-3" />
          </motion.div>
        </Link>
      </motion.div>
    );

    return (
      <RatingsDropdown 
        isMobile={isMobile}
        onDropdownStateChange={setIsDropdownOpen}
      >
        {linkElement}
      </RatingsDropdown>
    );
  }

  if (item.external) {
    return (
      <motion.a
        href={item.href}
        className={linkClasses}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        target="_blank"
        rel="noopener noreferrer"
        {...mobileHoverProps}
      >
        {item.title}
      </motion.a>
    );
  }

  return (
    <motion.div {...mobileHoverProps}>
      <Link
        href={item.href}
        className={linkClasses}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        {item.title}
      </Link>
    </motion.div>
  );
};

export default NavItem;
