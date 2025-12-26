import { Check, ListFilter } from "lucide-react";
import { cn } from "@/src/utils/cn";
import { Button } from "./Button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./Command";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { useState, useId } from "react";

interface Option {
  value: string;
  label: string;
}

interface EditableMultiSelectProps {
  values: string[];
  options: Option[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  showConfirmation?: boolean;
  label?: string;
  isLoading?: boolean;
}

export function EditableMultiSelect({
  values,
  options,
  onChange,
  placeholder = "Select...",
  className,
  showConfirmation = false,
  label,
  isLoading = false,
}: EditableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<string[] | null>(null);
  const listboxId = useId();

  const selectedOptions = options.filter((option) =>
    values.includes(option.value)
  );
  const displayOptions = pendingValues
    ? options.filter((option) => pendingValues.includes(option.value))
    : selectedOptions;

  const handleSelect = (value: string) => {
    const newValues = pendingValues || values;
    const updatedValues = newValues.includes(value)
      ? newValues.filter((v) => v !== value)
      : [...newValues, value];

    if (showConfirmation) {
      setPendingValues(updatedValues);
    } else {
      onChange(updatedValues);
    }
  };

  const handleConfirm = () => {
    if (pendingValues) {
      onChange(pendingValues);
      setPendingValues(null);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingValues(null);
    setOpen(false);
  };

  // Format display text for the trigger button
  const formatDisplayText = () => {
    if (!displayOptions.length) return placeholder;
    if (displayOptions.length === 1)
      return displayOptions[0]?.label ?? placeholder;
    return `${displayOptions[0]?.label ?? ""} +${displayOptions.length - 1}`;
  };

  const hasChanges =
    pendingValues &&
    (pendingValues.length !== values.length ||
      pendingValues.some((v) => !values.includes(v)));

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      )}
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            setPendingValues(values);
          } else {
            setPendingValues(null);
          }
          setOpen(isOpen);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            disabled={isLoading}
            className={cn(
              "bg-muted/50 hover:bg-muted inline-flex h-7 items-center justify-between gap-1.5 rounded-md px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
              !displayOptions.length && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">{formatDisplayText()}</span>
            <ListFilter className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-1" align="start" sideOffset={4}>
          <Command className="overflow-hidden rounded-[inherit]">
            <CommandList id={listboxId}>
              <CommandGroup className="max-h-[200px] overflow-auto p-0">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-xs"
                  >
                    <span className="truncate">{option.label}</span>
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        (pendingValues || values).includes(option.value)
                          ? "border-zinc-400 bg-zinc-700 text-white dark:border-zinc-500 dark:bg-zinc-300 dark:text-zinc-900"
                          : "border-zinc-300 dark:border-zinc-600"
                      )}
                    >
                      <Check
                        className={cn(
                          "h-2.5 w-2.5",
                          (pendingValues || values).includes(option.value)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {showConfirmation && (
              <>
                <CommandSeparator className="my-1" />
                <div className="flex items-center gap-1.5 px-1 pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 flex-1 text-xs"
                    onClick={handleCancel}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    onClick={handleConfirm}
                    disabled={!hasChanges}
                  >
                    Сохранить
                  </Button>
                </div>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
