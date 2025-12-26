import { cn } from "@/src/lib/utils";
import React from "react";

// Compact logo: a simple monogram "p" that inherits currentColor
// Designed to be crisp at small sizes (e.g. 24-32px)
const LogoCompact = ({ className }: { className?: string }) => {
  return <span className={cn(className, "text-2xl font-bold")}>П</span>;
};

export default LogoCompact;
