"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/utils/api";

export interface DeviceTypeSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  /** When true, renders only the content (search + options) without trigger button */
  inline?: boolean;
}

export function DeviceTypeSelector({
  value,
  onChange,
  disabled = false,
  className,
  error,
  inline = false,
}: DeviceTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(inline);
  const [filter, setFilter] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch device types from database
  const { data: deviceTypes = [], isPending } = api.device.getDeviceTypes.useQuery();

  // Filter types based on search
  const filteredTypes = deviceTypes.filter((t) =>
    t.type.toLowerCase().includes(filter.toLowerCase())
  );

  // Close on outside click (only for non-inline mode)
  useEffect(() => {
    if (inline) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inline]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Inline mode: render just the content
  if (inline) {
    return (
      <div className={cn("w-full", className)}>
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 dark:text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск типа..."
            className={cn(
              "w-full h-9 pl-8 pr-3 text-sm rounded-md",
              "bg-white dark:bg-slate-800",
              "border border-zinc-300 dark:border-slate-600",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500",
              "placeholder:text-zinc-400 dark:placeholder:text-slate-500",
              "text-zinc-900 dark:text-slate-100"
            )}
          />
        </div>

        {/* Options */}
        <div className="max-h-48 overflow-auto mt-2">
          {isPending ? (
            <div className="py-2 px-1 text-xs text-zinc-400 dark:text-slate-500">
              Загрузка...
            </div>
          ) : filteredTypes.length === 0 ? (
            <div className="py-2 px-1 text-xs text-zinc-400 dark:text-slate-500">
              {filter ? "Ничего не найдено" : "Нет типов"}
            </div>
          ) : (
            filteredTypes.map(({ type, count }) => {
              const isSelected = value === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onChange(isSelected ? "" : type);
                    setFilter("");
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm cursor-pointer",
                    isSelected
                      ? "bg-indigo-500 text-white"
                      : "text-zinc-700 dark:text-slate-200 hover:bg-zinc-100 dark:hover:bg-slate-800"
                  )}
                >
                  <span>{type}</span>
                  <span className={cn(
                    "text-xs tabular-nums",
                    isSelected ? "text-white/70" : "text-zinc-400 dark:text-slate-500"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

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
        <span className={cn("truncate", value ? "text-zinc-900 dark:text-slate-100" : "text-zinc-400 dark:text-slate-500")}>
          {value || "Выберите тип"}
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
          <div className="p-2 border-b border-zinc-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 dark:text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Поиск..."
                className={cn(
                  "w-full h-8 pl-8 pr-3 text-sm rounded-md",
                  "bg-white dark:bg-slate-800",
                  "border border-zinc-300 dark:border-slate-600",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500",
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
              filteredTypes.map(({ type, count }) => {
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
                      "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer",
                      isSelected
                        ? "bg-indigo-500 text-white"
                        : "text-zinc-600 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <span>{type}</span>
                    <span className={cn(
                      "text-[10px] tabular-nums",
                      isSelected ? "text-white/70" : "text-zinc-400 dark:text-slate-500"
                    )}>
                      {count}
                    </span>
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
