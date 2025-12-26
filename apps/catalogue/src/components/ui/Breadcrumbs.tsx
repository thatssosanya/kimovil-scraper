import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/src/utils/cn";

interface BreadcrumbItem {
  label: string;
  href: string;
  disabled?: boolean;
  isHighlighted?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => {
  return (
    <nav
      className={cn("mb-4 hidden md:block", className)}
      aria-label="Навигация по разделам"
    >
      <ol className=" flex items-center gap-1" role="list">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center">
            {index > 0 && (
              <ChevronRight
                className="mx-1 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              />
            )}
            {item.disabled ? (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  index === items.length - 1
                    ? "hover:text-primary text-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                  item.isHighlighted && "text-primary dark:text-primary"
                )}
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
