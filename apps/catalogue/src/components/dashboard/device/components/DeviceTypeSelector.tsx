"use client";

import { useState, useRef, useEffect } from "react";
import { Smartphone, Tv, Laptop, Tablet, Gamepad2, ChevronDown, Search } from "lucide-react";
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

// Device type icons mapping
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
  disabled = false,
  className,
  error,
}: DeviceTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch device types from database
  const { data: deviceTypes = [], isPending } = api.device.getDeviceTypes.useQuery();

  // Filter types based on search
  const filteredTypes = deviceTypes.filter((type) =>
    type.toLowerCase().includes(filter.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const SelectedIcon = value ? deviceTypeIcons[value] : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-9 px-3 rounded-lg text-sm flex items-center justify-between gap-2",
          "bg-white dark:bg-slate-800/50",
          "border border-zinc-200 dark:border-slate-700/50",
          "hover:border-zinc-300 dark:hover:border-slate-600",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
          error && "border-rose-500/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {SelectedIcon && (
            <SelectedIcon className="h-3.5 w-3.5 text-zinc-400 dark:text-slate-500" />
          )}
          <span className={value ? "text-zinc-900 dark:text-slate-100" : "text-zinc-400 dark:text-slate-500"}>
            {value || "Выберите тип"}
          </span>
        </span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-zinc-400 dark:text-slate-500 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-zinc-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-zinc-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Поиск..."
                className={cn(
                  "w-full h-7 pl-7 pr-2 text-xs rounded-md",
                  "bg-zinc-50 dark:bg-slate-800/50",
                  "border border-zinc-200 dark:border-slate-700/50",
                  "focus:outline-none focus:ring-1 focus:ring-indigo-500/30",
                  "placeholder:text-zinc-400 dark:placeholder:text-slate-500",
                  "text-zinc-900 dark:text-slate-100"
                )}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-auto p-1.5">
            {isPending ? (
              <div className="py-2 px-3 text-xs text-zinc-400 dark:text-slate-500">
                Загрузка...
              </div>
            ) : filteredTypes.length === 0 ? (
              <div className="py-2 px-3 text-xs text-zinc-400 dark:text-slate-500">
                {filter ? "Ничего не найдено" : "Нет типов"}
              </div>
            ) : (
              filteredTypes.map((type) => {
                const Icon = deviceTypeIcons[type];
                const isSelected = value === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onChange(isSelected ? "" : type);
                      setIsOpen(false);
                      setFilter("");
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer",
                      isSelected
                        ? "bg-indigo-500 text-white"
                        : "text-zinc-600 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800"
                    )}
                  >
                    {Icon && (
                      <Icon className={cn(
                        "h-3.5 w-3.5",
                        isSelected ? "text-white" : "text-zinc-400 dark:text-slate-500"
                      )} />
                    )}
                    {type}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
