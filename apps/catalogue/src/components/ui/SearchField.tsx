import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/src/utils/cn";
import { useDebounce } from "@/src/hooks/useDebounce";

interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  className?: string;
  debounceMs?: number;
  value?: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    { className, debounceMs = 400, value, onChange, onValueChange, ...props },
    ref
  ) => {
    const [localValue, setLocalValue] = React.useState(value ?? "");
    const debouncedValue = useDebounce(localValue, debounceMs);

    React.useEffect(() => {
      if (value !== undefined && value !== localValue) {
        setLocalValue(value);
      }
    }, [value, localValue]);

    React.useEffect(() => {
      onValueChange?.(debouncedValue);
    }, [debouncedValue, onValueChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange?.(newValue);
    };

    return (
      <div className="relative w-full">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          className={cn(
            "h-9 w-full rounded-md border bg-background pl-9 pr-4 text-sm transition-colors",
            "placeholder:text-muted-foreground/60",
            "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
            "hover:border-muted-foreground/25",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);

SearchField.displayName = "SearchField";
