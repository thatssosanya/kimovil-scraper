import React, { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

type SpecificationSectionProps = {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
};

export const SpecificationSection: React.FC<SpecificationSectionProps> = ({
  title,
  icon: Icon,
  children,
}) => {
  return (
    <div className="flex flex-col items-start gap-4">
      <div className=" flex items-center gap-2">
        <Icon
          className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        />
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
};
