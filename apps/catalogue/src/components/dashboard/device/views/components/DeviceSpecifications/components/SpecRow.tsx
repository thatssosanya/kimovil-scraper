import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

interface SpecRowProps {
  label: string;
  children: ReactNode;
  isDirty?: boolean;
  className?: string;
}

export function SpecRow({ label, children, isDirty, className }: SpecRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-3 transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isDirty && "bg-blue-50/50 dark:bg-blue-950/20",
        className
      )}
    >
      <div className="flex items-center gap-1.5 w-32 shrink-0">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

interface SpecRowInputProps {
  label: string;
  isDirty?: boolean;
  className?: string;
  type?: "text" | "number";
  step?: string;
  placeholder?: string;
  value?: string | number | null;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  register?: object;
}

export function SpecRowInput({
  label,
  isDirty,
  className,
  type = "text",
  step,
  placeholder = "—",
  value,
  register,
  ...inputProps
}: SpecRowInputProps) {
  return (
    <SpecRow label={label} isDirty={isDirty} className={className}>
      <input
        type={type}
        step={step}
        placeholder={placeholder}
        value={value ?? ""}
        className={cn(
          "w-full bg-transparent border-none outline-none text-sm",
          "text-gray-900 dark:text-gray-200",
          "placeholder:text-gray-400 dark:placeholder:text-gray-500",
          "focus:ring-0",
          "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        )}
        {...register}
        {...inputProps}
      />
    </SpecRow>
  );
}

interface SpecRowToggleProps {
  label: string;
  isDirty?: boolean;
  children: ReactNode;
}

export function SpecRowToggle({ label, isDirty, children }: SpecRowToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-3 transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isDirty && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
    >
      <div className="flex items-center gap-1.5 w-32 shrink-0">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
