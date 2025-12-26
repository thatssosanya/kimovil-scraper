import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, onCheckedChange, checked, ...rest }, ref) => {
  const memoizedClassName = React.useMemo(
    () =>
      cn(
        "peer h-[22px] w-[22px] rounded-[4px] border",
        // Light mode
        "border-zinc-200 bg-white",
        "hover:border-zinc-300 hover:bg-zinc-50/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/10 focus-visible:ring-offset-2",
        // Dark mode
        "dark:border-gray-800 dark:bg-[hsl(0_0%_9%)]",
        "dark:hover:border-gray-700 dark:hover:bg-gray-700/20",
        "dark:focus-visible:ring-0 dark:focus-visible:ring-offset-0",
        // Checked state
        "data-[state=checked]:border-zinc-950 data-[state=checked]:bg-zinc-950",
        "dark:data-[state=checked]:border-[hsl(354_73%_56%)] dark:data-[state=checked]:bg-[hsl(354_73%_56%)]",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      ),
    [className]
  );

  const stableOnCheckedChange = React.useCallback(
    (newChecked: boolean) => {
      if (onCheckedChange) {
        onCheckedChange(newChecked);
      }
    },
    [onCheckedChange]
  );

  return (
    <div className="relative flex h-7 w-7 items-center justify-center">
      <CheckboxPrimitive.Root
        ref={ref}
        className={memoizedClassName}
        checked={checked}
        onCheckedChange={stableOnCheckedChange}
        // Explicitly pass only the necessary props
        disabled={rest.disabled}
        // Add other explicitly needed props here
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white dark:text-white">
          <Check className="h-4 w-4 stroke-[2.5px]" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </div>
  );
});

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
