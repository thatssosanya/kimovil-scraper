import React from "react";
import { XIcon, PlusIcon } from "lucide-react";
import { cn } from "@/src/utils/cn";

interface ArrayInputProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  initialValue?: string | null | undefined;
  isDirty?: boolean;
  isEditing?: boolean;
  borderless?: boolean;
}

export function ArrayInput({
  value,
  onChange,
  disabled,
  placeholder = "Добавить...",
  className,
  initialValue,
  isDirty,
  isEditing = !disabled,
  borderless = false,
}: ArrayInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isValueChanged = value !== initialValue;

  const values = React.useMemo(() => {
    const strValue = value || "";
    return strValue === ""
      ? []
      : strValue
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue) {
      e.preventDefault();
      const newValues = [...values, inputValue];
      onChange(newValues.join("|"));
      setInputValue("");
    }
  };

  const handleRemoveValue = (index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues.join("|"));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5",
        !borderless && "min-h-[38px] rounded-md border border-zinc-300 bg-white dark:border-gray-800 dark:bg-transparent p-1.5",
        !borderless && disabled && "cursor-not-allowed bg-zinc-50 dark:bg-gray-800/50",
        !borderless && isValueChanged && isEditing && "border-blue-500",
        !borderless && isDirty && isEditing && "bg-blue-50 dark:bg-blue-950/30",
        className
      )}
    >
      {values.map((value, index) => (
        <span
          key={index}
          className={cn(
            "flex items-center gap-1 rounded bg-zinc-200 dark:bg-zinc-700 px-2 py-1 text-sm text-zinc-800 dark:text-zinc-200",
            disabled && "opacity-50"
          )}
        >
          {value}
          {isEditing && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Remove item"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRemoveValue(index);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRemoveValue(index);
                }
              }}
              className="cursor-pointer rounded-full p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-600 focus:outline-none focus:ring-0"
            >
              <XIcon className="h-3 w-3" />
            </div>
          )}
        </span>
      ))}
      {isEditing && (
        <div className="flex flex-1 items-center gap-1">
          <PlusIcon className="h-4 w-4 text-zinc-400 dark:text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 border-none bg-transparent p-0 text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-gray-600 dark:text-gray-200"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
