import { useState, useMemo } from "react";
import { Input } from "@/src/components/ui/Input";
import { Label } from "@/src/components/ui/Label";
import { Button } from "@/src/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/Popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/src/components/ui/Command";
import { ScrollArea } from "@/src/components/ui/ScrollArea";
import { Search, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Common lucide icon names for selection
const iconNames: string[] = [
  "smartphone", "laptop", "tablet", "monitor", "phone", "desktop", 
  "watch", "camera", "headphones", "speaker", "microphone", "keyboard",
  "mouse", "gamepad", "tv", "radio", "battery", "cpu", "hard-drive",
  "memory-stick", "wifi", "bluetooth", "usb", "power", "settings",
  "home", "user", "users", "mail", "message-square", "search", "star",
  "heart", "bookmark", "shopping-cart", "credit-card", "calendar",
  "clock", "map-pin", "globe", "shield", "lock", "unlock", "eye",
  "eye-off", "edit", "trash", "plus", "minus", "x", "check",
  "arrow-up", "arrow-down", "arrow-left", "arrow-right", "chevron-up",
  "chevron-down", "chevron-left", "chevron-right", "menu", "more-horizontal",
  "more-vertical", "file", "folder", "download", "upload", "share",
  "external-link", "link", "image", "video", "music", "play", "pause",
  "stop", "skip-back", "skip-forward", "volume", "volume-off", "bell",
  "bell-off", "sun", "moon", "cloud", "zap", "activity", "trending-up",
  "trending-down", "bar-chart", "pie-chart", "database", "server",
  "git-branch", "git-commit", "github", "gitlab", "terminal", "code"
];

interface IconSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export const IconSelector = ({
  value = "",
  onChange,
  placeholder = "Поиск иконки...",
  disabled = false,
  label,
  required = false,
  error,
  className,
}: IconSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Convert icon names to proper case (e.g., "smartphone" -> "Smartphone")
  const getIconComponent = (iconName: string): LucideIcon | null => {
    const pascalCaseName = iconName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    
    return (LucideIcons as unknown as Record<string, LucideIcon>)[pascalCaseName] || null;
  };

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    const searchTerm = searchValue.toLowerCase();
    return iconNames
      .filter((name: string) => name.toLowerCase().includes(searchTerm))
      .slice(0, 100) // Limit to first 100 results for performance
      .sort();
  }, [searchValue]);

  const selectedIcon = value ? getIconComponent(value) : null;

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setOpen(false);
    setSearchValue("");
  };

  const handleClear = () => {
    onChange("");
    setSearchValue("");
  };

  const handleInputChange = (inputValue: string) => {
    onChange(inputValue);
    setSearchValue(inputValue);
  };

  return (
    <div className={`space-y-2 ${className || ""}`}>
      {label && (
        <Label className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-20"
          aria-invalid={!!error}
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Icon preview */}
          {selectedIcon && (
            <div className="flex items-center gap-1 text-muted-foreground">
              {(() => {
                const IconComponent = selectedIcon;
                return <IconComponent className="h-4 w-4" />;
              })()}
            </div>
          )}
          
          {/* Clear button */}
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={handleClear}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          {/* Search popover */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-muted"
                disabled={disabled}
              >
                <Search className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput
                  placeholder="Поиск иконок..."
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  <CommandEmpty>Иконки не найдены.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-60">
                      {filteredIcons.map((iconName: string) => {
                        const IconComponent = getIconComponent(iconName);
                        if (!IconComponent) return null;
                        
                        return (
                          <CommandItem
                            key={iconName}
                            value={iconName}
                            onSelect={() => handleSelect(iconName)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <IconComponent className="h-4 w-4" />
                            <span className="text-sm">{iconName}</span>
                          </CommandItem>
                        );
                      })}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      
      <p className="text-xs text-muted-foreground">
        {value.length}/50 символов
        {value && selectedIcon && " • Иконка найдена"}
      </p>
    </div>
  );
};