import { useState, useCallback, useEffect, forwardRef } from "react";
import { cn } from "@/src/lib/utils";

interface InlineEditableInputProps {
  type?: "input" | "textarea";
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  uniqueKey?: string;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  style?: React.CSSProperties;
}

export const InlineEditableInput = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InlineEditableInputProps
>(({
  type = "input",
  value: propValue,
  onSave,
  placeholder,
  disabled = false,
  className,
  uniqueKey,
  rows = 2,
  onKeyDown,
  style,
}, ref) => {
  const [localValue, setLocalValue] = useState(propValue || "");
  const [originalValue, setOriginalValue] = useState(propValue || "");

  // Update local state when prop value changes
  useEffect(() => {
    setLocalValue(propValue || "");
    setOriginalValue(propValue || "");
  }, [propValue]);

  // Track when user starts editing to capture original value
  const handleFocus = useCallback(() => {
    setOriginalValue(localValue);
  }, [localValue]);

  // Save on blur - compare against original value from focus
  const handleBlur = useCallback(() => {
    const trimmedValue = localValue.trim();
    if (trimmedValue !== originalValue) {
      onSave(trimmedValue);
    }
  }, [localValue, originalValue, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (type === "input" && e.key === "Enter") {
      (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).blur();
    }
    if (e.key === "Escape") {
      (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).blur();
    }
    onKeyDown?.(e);
  }, [type, onKeyDown]);

  const baseClassName = cn(
    "w-full bg-transparent border-none outline-none p-0 m-0 transition-all duration-150",
    "placeholder:text-gray-400 dark:placeholder:text-gray-600",
    "focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 focus:rounded focus:px-2 focus:py-1",
    "focus:bg-white dark:focus:bg-gray-800",
    "text-gray-900 dark:text-gray-200",
    disabled ? "cursor-wait opacity-70" : "cursor-text",
    className
  );

  const defaultStyle: React.CSSProperties = {
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    minHeight: type === "input" ? "1.5rem" : "2.5rem",
    ...style,
  };

  if (type === "textarea") {
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        key={uniqueKey}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        onKeyDown={handleKeyDown}
        className={cn(baseClassName, "resize-none")}
        style={defaultStyle}
      />
    );
  }

  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      key={uniqueKey}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      className={baseClassName}
      style={defaultStyle}
    />
  );
});

InlineEditableInput.displayName = "InlineEditableInput";