import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/src/lib/utils";

interface ToggleProps extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>, 'onChange'> {
  onChange?: (checked: boolean) => void;
}

export const Toggle = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  ToggleProps
>(({ className, onChange, onCheckedChange, ...props }, ref) => {
  const handleChange = (checked: boolean) => {
    onChange?.(checked);
    onCheckedChange?.(checked);
  };

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-full",
        "transition-all duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-green-500",
        "data-[state=unchecked]:bg-zinc-200 dark:data-[state=unchecked]:bg-zinc-700",
        className
      )}
      onCheckedChange={handleChange}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-[22px] w-[22px] rounded-full bg-white",
          "shadow-[0_2px_4px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.1)]",
          "ring-0 transition-transform duration-200 ease-in-out",
          "data-[state=checked]:translate-x-[22px]",
          "data-[state=unchecked]:translate-x-[2px]"
        )}
      />
    </SwitchPrimitives.Root>
  );
});

Toggle.displayName = "Toggle";
