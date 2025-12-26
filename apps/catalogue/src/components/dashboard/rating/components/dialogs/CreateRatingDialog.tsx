import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Label } from "@/src/components/ui/Label";
import { Textarea } from "@/src/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import type { RatingType, RatingCategory } from "@/src/server/db/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PlusCircle } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";

const createRatingSchema = z.object({
  name: z.string().min(1, "Введите название рейтинга"),
  ratingTypeId: z.string().min(1, "Выберите тип рейтинга"),
  description: z.string().optional(),
  categories: z.array(z.string()).min(1, "Выберите хотя бы одну категорию"),
});

type FormValues = z.infer<typeof createRatingSchema>;

interface CreateRatingDialogProps {
  open: boolean;
  onClose: () => void;
  ratingTypes: RatingType[];
  categories: RatingCategory[];
  onCreateRating: (data: FormValues) => Promise<void>;
  isLoading?: boolean;
}

export const CreateRatingDialog = ({
  open,
  onClose,
  ratingTypes,
  categories,
  onCreateRating,
  isLoading,
}: CreateRatingDialogProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(createRatingSchema),
    defaultValues: {
      name: "",
      ratingTypeId: "",
      description: "",
      categories: [],
    },
  });

  const selectedCategories = watch("categories");

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await onCreateRating(data);
      handleClose();
    } catch (error) {
      console.error("Failed to create rating:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Создать новый рейтинг
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Заполните информацию о новом рейтинге
          </p>
        </DialogHeader>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="flex flex-col gap-6 px-6 pb-6"
        >
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Название
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Например: Лучшие смартфоны 2024"
              aria-describedby={errors.name ? "name-error" : undefined}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p
                className="text-sm text-destructive"
                id="name-error"
                role="alert"
              >
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ratingTypeId" className="text-sm font-medium">
              Тип рейтинга
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch("ratingTypeId")}
              onValueChange={(value) => setValue("ratingTypeId", value)}
            >
              <SelectTrigger
                id="ratingTypeId"
                aria-describedby={
                  errors.ratingTypeId ? "ratingType-error" : undefined
                }
                aria-invalid={!!errors.ratingTypeId}
              >
                <SelectValue placeholder="Выберите тип рейтинга" />
              </SelectTrigger>
              <SelectContent>
                {ratingTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.displayName || type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ratingTypeId && (
              <p
                className="text-sm text-destructive"
                id="ratingType-error"
                role="alert"
              >
                {errors.ratingTypeId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Описание
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Описание рейтинга"
              className="h-24 min-h-[96px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Категории
              <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge
                  key={category.id}
                  variant={
                    selectedCategories.includes(category.id)
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => {
                    const newCategories = selectedCategories.includes(
                      category.id
                    )
                      ? selectedCategories.filter((id) => id !== category.id)
                      : [...selectedCategories, category.id];
                    setValue("categories", newCategories);
                  }}
                >
                  {category.name}
                </Badge>
              ))}
            </div>
            {errors.categories && (
              <p
                className="text-sm text-destructive"
                id="categories-error"
                role="alert"
              >
                {errors.categories.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="min-w-[120px]"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="min-w-[120px] gap-2 bg-green-600 text-white transition-all hover:bg-green-700 active:scale-95"
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Создание...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  <span>Создать</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
