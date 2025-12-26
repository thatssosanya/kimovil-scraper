import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { Label } from "@/src/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/Dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/Tabs";
import { Settings, Tag, Info, Layout } from "lucide-react";

interface RatingsGroup {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  displayType: string;
  type: string | null;
}

interface EditRatingsGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onUpdateGroup: (data: { 
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    displayType?: string;
    type?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  group: RatingsGroup | null;
}

const GROUP_TYPES = [
  { value: "smartphones", label: "Смартфоны" },
  { value: "laptops", label: "Ноутбуки" },
  { value: "tablets", label: "Планшеты" },
  { value: "headphones", label: "Наушники" },
  { value: "accessories", label: "Аксессуары" },
  { value: "other", label: "Другое" },
];

const DISPLAY_TYPES = [
  { value: "regular", label: "Обычный", description: "Все элементы рейтинга отображаются одинаково" },
  { value: "feature", label: "Первый рекомендуемый", description: "Первый элемент выделяется, остальные - сопутствующие" },
  { value: "single", label: "Только первый", description: "Отображается только первый элемент рейтинга" },
];

export const EditRatingsGroupDialog = ({
  open,
  onClose,
  onUpdateGroup,
  isLoading = false,
  group,
}: EditRatingsGroupDialogProps) => {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [displayType, setDisplayType] = useState("regular");
  const [type, setType] = useState("");
  const [errors, setErrors] = useState<{ 
    name?: string; 
    displayName?: string;
    description?: string; 
  }>({});

  // Initialize form values when group changes
  useEffect(() => {
    if (group) {
      setName(group.name);
      setDisplayName(group.displayName || "");
      setDescription(group.description || "");
      setDisplayType(group.displayType || "regular");
      setType(group.type || "");
    }
  }, [group]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleFormSubmit();
  };

  const handleFormSubmit = async () => {
    if (!group) return;

    // Validation
    const newErrors: { 
      name?: string; 
      displayName?: string;
      description?: string; 
    } = {};
    
    if (!name.trim()) {
      newErrors.name = "Название обязательно";
    }
    if (name.length > 100) {
      newErrors.name = "Название не должно превышать 100 символов";
    }
    if (displayName.length > 200) {
      newErrors.displayName = "Отображаемое имя не должно превышать 200 символов";
    }
    if (description.length > 500) {
      newErrors.description = "Описание не должно превышать 500 символов";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    try {
      await onUpdateGroup({
        id: group.id,
        name: name.trim(),
        displayName: displayName.trim() || undefined,
        description: description.trim() || undefined,
        displayType: displayType,
        type: type || undefined,
      });
      
      onClose();
    } catch (error) {
      console.error("Failed to update group:", error);
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Редактировать группу</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Изменение настроек группы рейтингов
              </p>
            </div>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-sm font-medium">
              Название группы <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Бюджетные смартфоны"
              disabled={isLoading}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "group-name-error" : undefined}
              className="h-11"
            />
            {errors.name && (
              <p id="group-name-error" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {name.length}/100 символов
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-display-name" className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <span>Отображаемое имя</span>
                <span className="text-xs text-muted-foreground">(шаблон)</span>
              </div>
            </Label>
            <Input
              id="group-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Например: Лучшие {shortName} 2024"
              disabled={isLoading}
              aria-invalid={!!errors.displayName}
              aria-describedby={errors.displayName ? "group-display-name-error" : undefined}
              className="h-11"
            />
            {errors.displayName && (
              <p id="group-display-name-error" className="text-sm text-destructive">
                {errors.displayName}
              </p>
            )}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">Использование {"{shortName}"}:</p>
                <p>При отображении на странице рейтингов, {"{shortName}"} будет заменён на короткое имя выбранного рейтинга. Например: &ldquo;Лучшие смартфоны 2024&rdquo;</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {displayName.length}/200 символов
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description" className="text-sm font-medium">
              Описание <span className="text-xs text-muted-foreground">(необязательно)</span>
            </Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание группы и её особенностей..."
              rows={3}
              disabled={isLoading}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "group-description-error" : undefined}
              className="resize-none"
            />
            {errors.description && (
              <p id="group-description-error" className="text-sm text-destructive">
                {errors.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {description.length}/500 символов
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Layout className="h-4 w-4" />
              Тип отображения
            </Label>
            <Tabs value={displayType} onValueChange={setDisplayType}>
              <TabsList className="grid w-full grid-cols-3">
                {DISPLAY_TYPES.map((type) => (
                  <TabsTrigger key={type.value} value={type.value} className="text-xs">
                    {type.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="text-xs text-muted-foreground px-3 py-2 bg-gray-50 rounded-md">
              {DISPLAY_TYPES.find(t => t.value === displayType)?.description}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Тип группы <span className="text-xs text-muted-foreground">(необязательно)</span>
            </Label>
            <Select value={type} onValueChange={setType} disabled={isLoading}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Выберите тип устройств..." />
              </SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((groupType) => (
                  <SelectItem key={groupType.value} value={groupType.value}>
                    {groupType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="min-w-[100px]"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="min-w-[140px] gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4" />
                  Сохранить
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};