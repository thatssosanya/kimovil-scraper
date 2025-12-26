import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

interface SpecSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function SpecSection({ title, children, className, action }: SpecSectionProps) {
  return (
    <div className={cn("pt-4", className)}>
      <div className="flex items-center gap-2 mb-1 px-3">
        <span className="text-sm font-semibold text-black dark:text-white">
          {title}
        </span>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}
