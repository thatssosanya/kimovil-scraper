import type { ReactNode } from "react";

interface InfoCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}

export function InfoCard({ 
  title, 
  children, 
  className = "", 
  headerActions 
}: InfoCardProps) {
  return (
    <div 
      className={`rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-[hsl(0_0%_9%)] ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-200">{title}</h3>
          {headerActions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}