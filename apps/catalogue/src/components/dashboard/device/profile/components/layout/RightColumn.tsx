import type { ReactNode } from "react";

interface RightColumnProps {
  children: ReactNode;
  className?: string;
}

export function RightColumn({ children, className = "" }: RightColumnProps) {
  return (
    <div className={`h-full p-4 lg:p-6 ${className}`}>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}