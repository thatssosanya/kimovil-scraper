import type { ReactNode } from "react";

interface TwoColumnLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  className?: string;
}

export function TwoColumnLayout({ 
  leftColumn, 
  rightColumn, 
  className = "" 
}: TwoColumnLayoutProps) {
  return (
    <div className={`h-full w-full ${className}`}>
      {/* Desktop: Two columns side by side */}
      <div className="hidden lg:flex h-full gap-6 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-auto">
          {leftColumn}
        </div>
        <div className="w-80 shrink-0 overflow-auto border-l border-gray-200 dark:border-gray-800">
          {rightColumn}
        </div>
      </div>
      
      {/* Mobile: Single column stack */}
      <div className="lg:hidden h-full overflow-auto">
        <div className="space-y-6">
          {leftColumn}
          <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
            {rightColumn}
          </div>
        </div>
      </div>
    </div>
  );
}