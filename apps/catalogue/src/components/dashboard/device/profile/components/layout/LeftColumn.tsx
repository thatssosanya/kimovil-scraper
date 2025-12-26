import type { ReactNode } from "react";

interface LeftColumnProps {
  children: ReactNode;
  className?: string;
}

export function LeftColumn({ children, className = "" }: LeftColumnProps) {
  return (
    <div
      className={`h-full space-y-6 p-4 lg:p-6 ${className}`}
    >
      {children}
    </div>
  );
}
