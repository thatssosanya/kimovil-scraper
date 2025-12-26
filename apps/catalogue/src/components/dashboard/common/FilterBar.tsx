import { Plus } from "lucide-react";
import type { RatingType, RatingCategory } from "@/src/server/db/schema";
import { PUBLISH_STATUS_LABELS } from "@/src/constants/publishStatus";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/DropdownMenu";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { SearchField } from "@/src/components/ui/SearchField";
import { Separator } from "@/src/components/ui/Separator";

interface FilterBarProps {
  ratingTypes: RatingType[];
  ratingCategories: RatingCategory[];
  selectedType: string | null;
  selectedCategories: string[];
  selectedStatus: string | null;
  onTypeChange: (type: string | null) => void;
  onCategoriesChange: (categories: string[]) => void;
  onStatusChange: (status: string | null) => void;
  onCreateRating: () => void;
  onSearchChange: (value: string) => void;
}

export const FilterBar = ({
  ratingTypes,
  ratingCategories,
  selectedType,
  selectedCategories,
  selectedStatus,
  onTypeChange,
  onCategoriesChange,
  onStatusChange,
  onCreateRating,
  onSearchChange,
}: FilterBarProps) => {
  return (
    <div>
      <div className="px-5 text-xs font-medium text-zinc-500">Фильтры</div>
      <div className="bg-background/95 flex flex-wrap items-center gap-3 border-b-2 px-4 py-2">
        <div className="flex flex-1 items-center gap-3">
          <Select
            value={selectedType ?? "all"}
            onValueChange={(v) => onTypeChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="border-border/40 bg-background h-8 w-[180px] text-sm">
              <SelectValue placeholder="Все типы" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Все типы</SelectItem>
                {ratingTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.displayName ?? type.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-border/40 bg-background h-8 text-sm"
              >
                Категории
                {selectedCategories.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-primary/20 text-primary ml-2"
                  >
                    {selectedCategories.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {ratingCategories.map((category) => (
                <DropdownMenuItem
                  key={category.id}
                  className="flex items-center gap-2"
                  onSelect={() => {
                    const isSelected = selectedCategories.includes(category.id);
                    onCategoriesChange(
                      isSelected
                        ? selectedCategories.filter((id) => id !== category.id)
                        : [...selectedCategories, category.id]
                    );
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id)}
                    className="h-4 w-4 rounded border-zinc-300"
                    readOnly
                  />
                  {category.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select
            value={selectedStatus ?? "all"}
            onValueChange={(v) => onStatusChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="border-border/40 bg-background h-8 w-[180px] text-sm">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(PUBLISH_STATUS_LABELS).map(
                  ([status, label]) => (
                    <SelectItem key={status} value={status}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6" />

          <SearchField
            debounceMs={200}
            placeholder="Поиск по названию рейтинга или устройства..."
            onValueChange={(e: string) => onSearchChange(e)}
            className="w-[320px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onCreateRating}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            <Plus className="h-4 w-4" />
            Создать рейтинг
          </Button>
        </div>
      </div>
    </div>
  );
};
