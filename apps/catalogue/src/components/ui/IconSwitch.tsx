"use client";

import { Switch } from "@/src/components/ui/Switch";
import { type LucideIcon } from "lucide-react";
import { useId } from "react";

interface IconSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  leftIcon: LucideIcon;
  rightIcon: LucideIcon;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
}

export function IconSwitch({
  checked,
  onCheckedChange,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  leftLabel,
  rightLabel,
  className,
}: IconSwitchProps) {
  const id = useId();

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5">
        <LeftIcon
          size={16}
          strokeWidth={2}
          className={checked ? "text-muted-foreground" : "text-primary"}
          aria-hidden="true"
        />
        {leftLabel && (
          <span
            className={`text-sm ${
              checked ? "text-muted-foreground" : "font-medium text-primary"
            }`}
          >
            {leftLabel}
          </span>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="Toggle switch"
      />
      <div className="flex items-center gap-1.5">
        <RightIcon
          size={16}
          strokeWidth={2}
          className={checked ? "text-primary" : "text-muted-foreground"}
          aria-hidden="true"
        />
        {rightLabel && (
          <span
            className={`text-sm ${
              checked ? "font-medium text-primary" : "text-muted-foreground"
            }`}
          >
            {rightLabel}
          </span>
        )}
      </div>
    </div>
  );
}
