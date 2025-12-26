import { Check, ChevronsUpDown } from "lucide-react";
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

interface EditableSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showConfirmation?: boolean;
  label?: string;
  isLoading?: boolean;
}

export function EditableSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  className,
  showConfirmation = false,
  label,
  isLoading = false,
}: EditableSelectProps) {
  const [open, setOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const listboxId = useId();

  const selectedOption = options.find((option) => option.value === value);
  const pendingOption = pendingValue
    ? options.find((opt) => opt.value === pendingValue)
    : selectedOption;

  const handleSelect = (newValue: string) => {
    if (showConfirmation) {
      setPendingValue(newValue);
      // Don't close the popover when confirmation is needed
    } else {
      onChange(newValue);
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    if (pendingValue) {
      onChange(pendingValue);
      setPendingValue(null);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingValue(null);
    setOpen(false);
  };

  const hasChanges = pendingValue && pendingValue !== value;

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
            setPendingValue(value);
          } else {
            setPendingValue(null);
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
              !value && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">
              {pendingOption?.label || placeholder}
            </span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-1" align="start" sideOffset={4}>
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
                    <Check
                      className={cn(
                        "h-3 w-3 shrink-0",
                        (pendingValue || value) === option.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
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
