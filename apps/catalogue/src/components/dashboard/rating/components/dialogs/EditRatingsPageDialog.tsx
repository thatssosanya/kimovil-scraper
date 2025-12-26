import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { Label } from "@/src/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/Select";
import { IconSelector } from "@/src/components/ui/IconSelector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/Dialog";
import { Settings } from "lucide-react";
import { PUBLISH_STATUS, PUBLISH_STATUS_LABELS } from "@/src/constants/publishStatus";

interface RatingsPage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  status: string;
}

interface EditRatingsPageDialogProps {
  open: boolean;
  onClose: () => void;
  onUpdatePage: (data: { 
    id: string;
    name: string;
    slug: string;
    description?: string;
    iconName?: string;
    status?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  page: RatingsPage | null;
}

export const EditRatingsPageDialog = ({
  open,
  onClose,
  onUpdatePage,
  isLoading = false,
  page,
}: EditRatingsPageDialogProps) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState("");
  const [status, setStatus] = useState<string>(PUBLISH_STATUS.DRAFT);
  const [errors, setErrors] = useState<{ 
    name?: string; 
    slug?: string;
    description?: string;
    iconName?: string;
    status?: string;
  }>({});

  // Initialize form values when page changes
  useEffect(() => {
    if (page) {
      setName(page.name);
      setSlug(page.slug);
      setDescription(page.description || "");
      setIconName(page.iconName || "");
      setStatus(page.status || PUBLISH_STATUS.DRAFT);
    }
  }, [page]);

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Only auto-generate slug if it's currently matching the previous name's slug
    const currentNameSlug = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (slug === currentNameSlug || slug === '') {
      setSlug(value.trim().toLowerCase().replace(/\s+/g, '-'));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleFormSubmit();
  };

  const handleFormSubmit = async () => {
    if (!page) return;

    // Validation
    const newErrors: { 
      name?: string; 
      slug?: string;
      description?: string;
      iconName?: string;
      status?: string;
    } = {};
    
    if (!name.trim()) {
      newErrors.name = "Название обязательно";
    }
    if (name.length > 100) {
      newErrors.name = "Название не должно превышать 100 символов";
    }
    if (!slug.trim()) {
      newErrors.slug = "Slug обязателен";
    }
    if (!/^[a-z0-9-]+$/.test(slug.trim())) {
      newErrors.slug = "Slug может содержать только строчные латинские буквы, цифры и дефисы";
    }
    if (slug.length > 100) {
      newErrors.slug = "Slug не должен превышать 100 символов";
    }
    if (description.length > 500) {
      newErrors.description = "Описание не должно превышать 500 символов";
    }
    if (iconName.length > 50) {
      newErrors.iconName = "Имя иконки не должно превышать 50 символов";
    }
    if (!status.trim()) {
      newErrors.status = "Статус обязателен";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    try {
      await onUpdatePage({
        id: page.id,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        iconName: iconName.trim() || undefined,
        status: status.trim(),
      });
      
      onClose();
    } catch (error) {
      console.error("Failed to update page:", error);
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  if (!page) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Редактировать страницу</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Изменение настроек страницы рейтингов
              </p>
            </div>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="page-name" className="text-sm font-medium">
              Название страницы <span className="text-destructive">*</span>
            </Label>
            <Input
              id="page-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Например: Лучшие смартфоны 2024"
              disabled={isLoading}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "page-name-error" : undefined}
              className="h-11"
            />
            {errors.name && (
              <p id="page-name-error" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {name.length}/100 символов
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="page-slug" className="text-sm font-medium">
              URL-слаг <span className="text-destructive">*</span>
            </Label>
            <Input
              id="page-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
              placeholder="smartphones-2024"
              disabled={isLoading}
              aria-invalid={!!errors.slug}
              aria-describedby={errors.slug ? "page-slug-error" : undefined}
              className="h-11 font-mono"
            />
            {errors.slug && (
              <p id="page-slug-error" className="text-sm text-destructive">
                {errors.slug}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              URL будет: /ratings/{slug} ({slug.length}/100 символов)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="page-description" className="text-sm font-medium">
              Описание <span className="text-xs text-muted-foreground">(необязательно)</span>
            </Label>
            <Textarea
              id="page-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание страницы и её особенностей..."
              rows={3}
              disabled={isLoading}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "page-description-error" : undefined}
              className="resize-none"
            />
            {errors.description && (
              <p id="page-description-error" className="text-sm text-destructive">
                {errors.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {description.length}/500 символов
            </p>
          </div>

          <IconSelector
            value={iconName}
            onChange={setIconName}
            placeholder="Например: smartphone, laptop, tablet"
            disabled={isLoading}
            label="Имя иконки"
            error={errors.iconName}
          />

          <div className="space-y-2">
            <Label htmlFor="page-status" className="text-sm font-medium">
              Статус <span className="text-destructive">*</span>
            </Label>
            <Select value={status} onValueChange={setStatus} disabled={isLoading}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PUBLISH_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-destructive">
                {errors.status}
              </p>
            )}
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
              disabled={isLoading || !name.trim() || !slug.trim()}
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