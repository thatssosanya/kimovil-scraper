"use client";

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/src/components/ui/Command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/Popover";
import { cn } from "@/src/lib/utils";
import { useState } from "react";

export interface ComboBoxProps {
  onChange?: (value: string) => void;
  onSearch?: (search: string) => void;
  placeholder: string;
  values?: {
    label: string;
    iconUrl?: string;
    value: {
      name: string;
      id: string;
    };
  }[];
  disabled?: boolean;
  value?: string;
  setValue: (value: string) => void;
}

export function ComboBox({
  values = [],
  placeholder,
  value,
  disabled = false,
  setValue,
  onSearch,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);

  const handleSearch = (search: string) => {
    if (onSearch) {
      onSearch(search);
    }
  };

  return (
    <Popover open={open} modal onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value ? (
            <>
              {values.find((framework) => framework.value.id === value)?.label ??
                "Выбрать"}
              {values.find((framework) => framework.value.id === value)
                ?.iconUrl && (
                <img
                  src={
                    values.find((framework) => framework.value.id === value)
                      ?.iconUrl
                  }
                  alt=""
                  className="ml-2 h-4 w-4 rounded object-cover"
                />
              )}
            </>
          ) : (
            placeholder
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            onValueChange={handleSearch}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {values.map((option) => (
                <CommandItem
                  key={option.value.id}
                  value={option.value.id}
                  onSelect={() => {
                    setValue(option.value.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {option.iconUrl && (
                      <img
                        src={option.iconUrl}
                        alt=""
                        className="h-4 w-4 rounded object-cover"
                      />
                    )}
                    {option.label}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === option.value.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
