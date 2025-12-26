import { useState } from "react";
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
import { PUBLISH_STATUS, PUBLISH_STATUS_LABELS } from "@/src/constants/publishStatus";

interface CreateRatingsPageDialogProps {
  open: boolean;
  onClose: () => void;
  onCreatePage: (data: { name: string; slug: string; description?: string; iconName?: string; status?: string }) => Promise<void>;
  isLoading?: boolean;
}

export const CreateRatingsPageDialog = ({
  open,
  onClose,
  onCreatePage,
  isLoading = false,
}: CreateRatingsPageDialogProps) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState("");
  const [status, setStatus] = useState<string>(PUBLISH_STATUS.DRAFT);
  const [errors, setErrors] = useState<{ name?: string; slug?: string; description?: string; iconName?: string; status?: string }>({});

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Only auto-generate slug if it's currently matching the previous name's slug or empty
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
    // Validation
    const newErrors: { name?: string; slug?: string; description?: string; iconName?: string; status?: string } = {};
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
      await onCreatePage({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        iconName: iconName.trim() || undefined,
        status: status.trim(),
      });
      
      // Reset form
      setName("");
      setSlug("");
      setDescription("");
      setIconName("");
      setStatus(PUBLISH_STATUS.DRAFT);
      setErrors({});
      onClose();
    } catch (error) {
      console.error("Failed to create page:", error);
    }
  };

  const handleClose = () => {
    setName("");
    setSlug("");
    setDescription("");
    setIconName("");
    setStatus(PUBLISH_STATUS.DRAFT);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Создать страницу рейтингов</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page-name">
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
            <Label htmlFor="page-description">Описание (необязательно)</Label>
            <Textarea
              id="page-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание страницы..."
              rows={3}
              disabled={isLoading}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "page-description-error" : undefined}
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
            <Label htmlFor="page-status">
              Статус <span className="text-destructive">*</span>
            </Label>
            <Select value={status} onValueChange={setStatus} disabled={isLoading}>
              <SelectTrigger>
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim() || !slug.trim()}
            >
              {isLoading ? "Создание..." : "Создать страницу"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};