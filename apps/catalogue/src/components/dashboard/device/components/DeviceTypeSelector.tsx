"use client";

import { Smartphone, Tv, Laptop, Tablet, Gamepad2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/utils/api";

export interface DeviceTypeSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

// Device type icons mapping (same as in DeviceTable)
const deviceTypeIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  Смартфон: Smartphone,
  Телевизор: Tv,
  "Портативная приставка": Gamepad2,
  Ноутбук: Laptop,
  Планшет: Tablet,
};

export function DeviceTypeSelector({
  value,
  onChange,
  placeholder: _placeholder = "Выберите тип устройства",
  disabled = false,
  className,
}: DeviceTypeSelectorProps) {
  // Fetch device types from database
  const { data: deviceTypes = [], isPending } = api.device.getDeviceTypes.useQuery();

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="grid max-h-80 grid-cols-1 gap-1 overflow-auto pr-1 bg-popover text-popover-foreground">
        {isPending ? (
          <div className="py-2 px-2 text-sm text-muted-foreground">Загрузка…</div>
        ) : deviceTypes.length === 0 ? (
          <div className="py-2 px-2 text-sm text-muted-foreground">Список типов устройств пуст</div>
        ) : (
          deviceTypes.map((type) => {
            const Icon = deviceTypeIcons[type];
            return (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => onChange(type)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-sm px-2 text-sm cursor-pointer",
                  value === type
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/40 dark:hover:bg-gray-800/60"
                )}
              >
                {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />}
                {type}
              </button>
            );
          })
        )}
        {value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("")}
            className="mt-1 inline-flex h-8 items-center rounded-sm bg-zinc-100 px-2 text-sm hover:bg-zinc-200 dark:bg-[hsl(0_0%_20%)] dark:hover:bg-[hsl(0_0%_25%)] cursor-pointer"
          >
            Сбросить тип (Все)
          </button>
        )}
      </div>
    </div>
  );
}