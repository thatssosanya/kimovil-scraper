import React, { useState } from "react";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import Layout from "@/src/components/dashboard/layout/Layout";
import { api } from "@/src/utils/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/src/components/ui/Dialog";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/src/components/ui/Table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/src/components/ui/Tabs";

// Types
type EntityData = {
  id: string;
  name: string;
  displayName?: string | null;
  slug?: string | null | undefined;
  description?: string | null;
};

type EntityFormData = {
  id?: string;
  name: string;
  displayName: string;
  description: string;
  slug: string;
};

// Form validation
const validateForm = (
  data: Partial<EntityFormData>,
  requireSlug = false
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.name?.trim()) {
    errors.name = "Название обязательно";
  }

  if (requireSlug && !data.slug?.trim()) {
    errors.slug = "Slug обязателен";
  }

  return errors;
};

// Entity Table Component
interface EntityTableProps {
  data: EntityData[];
  isLoading: boolean;
  requireSlug?: boolean;
  onEdit: (item: EntityData) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const EntityTable: React.FC<EntityTableProps> = ({
  data,
  isLoading,
  requireSlug = false,
  onEdit,
  onDelete,
  onAdd,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = data.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.displayName &&
        item.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.description &&
        item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.slug && item.slug.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-2.5 text-zinc-400 hover:text-zinc-600"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={onAdd} className="flex items-center gap-1" size="sm">
          <PlusCircle className="h-4 w-4" />
          <span>Добавить</span>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              {requireSlug && <TableHead>Slug</TableHead>}
              <TableHead>Отображаемое название</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-[100px] text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={requireSlug ? 5 : 4}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"></div>
                    <span className="ml-2">Загрузка...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={requireSlug ? 5 : 4}
                  className="h-24 text-center text-zinc-500"
                >
                  {searchTerm
                    ? "Ничего не найдено"
                    : "Пока нет элементов. Добавьте первый!"}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  {requireSlug && <TableCell>{item.slug}</TableCell>}
                  <TableCell>{item.displayName || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {item.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(item)}
                        aria-label={`Редактировать ${item.name}`}
                      >
                        <Pencil className="h-4 w-4 text-zinc-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(item.id)}
                        aria-label={`Удалить ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// Entity Form Component
interface EntityFormProps {
  data: Partial<EntityFormData>;
  errors: Record<string, string>;
  requireSlug?: boolean;
  isSubmitting: boolean;
  onChange: (field: keyof EntityFormData, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const EntityForm: React.FC<EntityFormProps> = ({
  data,
  errors,
  requireSlug = false,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Название <span className="text-red-500">*</span>
          </label>
          <div className="group relative">
            <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
            <div className="absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded bg-zinc-800 p-2 text-xs text-white group-hover:block">
              Уникальное название для идентификации в системе
            </div>
          </div>
        </div>
        <Input
          id="name"
          value={data.name || ""}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Введите название"
          className={
            errors.name ? "border-red-300 focus-visible:ring-red-300" : ""
          }
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" />
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <label htmlFor="displayName" className="text-sm font-medium">
            Отображаемое название
          </label>
          <div className="group relative">
            <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
            <div className="absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded bg-zinc-800 p-2 text-xs text-white group-hover:block">
              Название, которое будет отображаться пользователям
            </div>
          </div>
        </div>
        <Input
          id="displayName"
          value={data.displayName || ""}
          onChange={(e) => onChange("displayName", e.target.value)}
          placeholder="Введите отображаемое название"
          disabled={isSubmitting}
        />
      </div>

      {requireSlug && (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <label htmlFor="slug" className="text-sm font-medium">
              Slug {requireSlug && <span className="text-red-500">*</span>}
            </label>
            <div className="group relative">
              <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
              <div className="absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded bg-zinc-800 p-2 text-xs text-white group-hover:block">
                Уникальный идентификатор для URL (только латинские буквы, цифры
                и дефисы)
              </div>
            </div>
          </div>
          <Input
            id="slug"
            value={data.slug || ""}
            onChange={(e) => onChange("slug", e.target.value)}
            placeholder="введите-slug"
            className={
              errors.slug ? "border-red-300 focus-visible:ring-red-300" : ""
            }
            disabled={isSubmitting}
          />
          {errors.slug && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {errors.slug}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <label htmlFor="description" className="text-sm font-medium">
            Описание
          </label>
          <div className="group relative">
            <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
            <div className="absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded bg-zinc-800 p-2 text-xs text-white group-hover:block">
              Дополнительная информация для внутреннего использования
            </div>
          </div>
        </div>
        <Input
          id="description"
          value={data.description || ""}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Введите описание"
          disabled={isSubmitting}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || Object.keys(errors).length > 0}
          className="flex items-center gap-1"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"></div>
              <span>Сохранение...</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>Сохранить</span>
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
};

// Main Settings Component
const Settings = () => {
  // State
  const [activeTab, setActiveTab] = useState("rating-types");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [currentItem, setCurrentItem] = useState<Partial<EntityFormData>>({
    name: "",
    displayName: "",
    description: "",
    slug: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Queries
  const {
    data: ratingTypes,
    refetch: refetchRatingTypes,
    isLoading: isLoadingRatingTypes,
  } = api.rating.getRatingTypes.useQuery();

  const {
    data: ratingCategories,
    refetch: refetchRatingCategories,
    isLoading: isLoadingRatingCategories,
  } = api.rating.getRatingCategories.useQuery();

  // Mutations
  const createRatingTypeMutation = api.rating.createRatingType.useMutation({
    onSuccess: () => {
      void refetchRatingTypes();
      handleCloseDialog();
    },
  });

  const updateRatingTypeMutation = api.rating.updateRatingType.useMutation({
    onSuccess: () => {
      void refetchRatingTypes();
      handleCloseDialog();
    },
  });

  const deleteRatingTypeMutation = api.rating.deleteRatingType.useMutation({
    onSuccess: () => void refetchRatingTypes(),
  });

  const createRatingCategoryMutation =
    api.rating.createRatingCategory.useMutation({
      onSuccess: () => {
        void refetchRatingCategories();
        handleCloseDialog();
      },
    });

  const updateRatingCategoryMutation =
    api.rating.updateRatingCategory.useMutation({
      onSuccess: () => {
        void refetchRatingCategories();
        handleCloseDialog();
      },
    });

  const deleteRatingCategoryMutation =
    api.rating.deleteRatingCategory.useMutation({
      onSuccess: () => void refetchRatingCategories(),
    });

  // Handlers
  const handleOpenCreateDialog = () => {
    setCurrentItem({
      name: "",
      displayName: "",
      description: "",
      slug: "",
    });
    setFormErrors({});
    setDialogMode("create");
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (item: EntityData) => {
    setCurrentItem({
      id: item.id,
      name: item.name,
      displayName: item.displayName || "",
      description: item.description || "",
      slug: item.slug || "",
    });
    setFormErrors({});
    setDialogMode("edit");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleInputChange = (field: keyof EntityFormData, value: string) => {
    setCurrentItem((prev) => ({ ...prev, [field]: value }));

    // Clear error for this field if it exists
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    const requireSlug = activeTab === "rating-categories";
    const errors = validateForm(currentItem, requireSlug);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (dialogMode === "create") {
      if (activeTab === "rating-types") {
        createRatingTypeMutation.mutate({
          name: currentItem.name!,
          displayName: currentItem.displayName || null,
          description: currentItem.description || null,
        });
      } else {
        createRatingCategoryMutation.mutate({
          name: currentItem.name!,
          slug: currentItem.slug!,
          description: currentItem.description || null,
        });
      }
    } else {
      if (activeTab === "rating-types") {
        updateRatingTypeMutation.mutate({
          id: currentItem.id!,
          name: currentItem.name!,
          displayName: currentItem.displayName || "",
          description: currentItem.description || "",
        });
      } else {
        updateRatingCategoryMutation.mutate({
          id: currentItem.id!,
          name: currentItem.name || undefined,
          description: currentItem.description || undefined,
          slug: currentItem.slug || undefined,
        });
      }
    }
  };

  const handleDelete = (id: string) => {
    if (
      window.confirm(
        "Вы уверены, что хотите удалить этот элемент? Это действие нельзя отменить."
      )
    ) {
      if (activeTab === "rating-types") {
        deleteRatingTypeMutation.mutate({ id });
      } else {
        deleteRatingCategoryMutation.mutate({ id });
      }
    }
  };

  // Determine if any mutation is in progress
  const isSubmitting =
    createRatingTypeMutation.isPending ||
    updateRatingTypeMutation.isPending ||
    createRatingCategoryMutation.isPending ||
    updateRatingCategoryMutation.isPending;

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">Настройки</h1>
          <p className="text-zinc-500">Управление настройками приложения</p>
        </div>

        <div className="rounded-lg border bg-white shadow-sm">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="border-b px-6 py-4">
              <TabsList className="grid w-[400px] grid-cols-2">
                <TabsTrigger value="rating-types">Типы рейтингов</TabsTrigger>
                <TabsTrigger value="rating-categories">
                  Категории рейтингов
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="rating-types" className="mt-0">
                <div className="mb-4 rounded-md bg-zinc-50 p-4 text-sm text-zinc-700">
                  <p className="flex items-center gap-1">
                    <HelpCircle className="h-4 w-4 text-zinc-400" />
                    <span>
                      Каждый тип имеет уникальное название и может
                      использоваться в разных категориях.
                    </span>
                  </p>
                </div>
                <EntityTable
                  data={ratingTypes || []}
                  isLoading={isLoadingRatingTypes}
                  onEdit={handleOpenEditDialog}
                  onDelete={handleDelete}
                  onAdd={handleOpenCreateDialog}
                />
              </TabsContent>

              <TabsContent value="rating-categories" className="mt-0">
                <div className="mb-4 rounded-md bg-zinc-50 p-4 text-sm text-zinc-700">
                  <p className="flex items-center gap-1">
                    <HelpCircle className="h-4 w-4 text-zinc-400" />
                    <span>
                      <strong>Категории рейтингов</strong> группируют рейтинги
                      по тематическим разделам. Каждая категория должна иметь
                      уникальный slug для использования в URL.
                    </span>
                  </p>
                </div>
                <EntityTable
                  data={ratingCategories || []}
                  isLoading={isLoadingRatingCategories}
                  requireSlug={true}
                  onEdit={handleOpenEditDialog}
                  onDelete={handleDelete}
                  onAdd={handleOpenCreateDialog}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Entity Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "create" ? "Создать новый" : "Редактировать"}{" "}
                {activeTab === "rating-types"
                  ? "тип рейтинга"
                  : "категорию рейтинга"}
              </DialogTitle>
              <DialogDescription>
                Заполните данные ниже, чтобы{" "}
                {dialogMode === "create" ? "создать новый" : "обновить"}{" "}
                {activeTab === "rating-types"
                  ? "тип рейтинга"
                  : "категорию рейтинга"}
                .
              </DialogDescription>
            </DialogHeader>

            <EntityForm
              data={currentItem}
              errors={formErrors}
              requireSlug={activeTab === "rating-categories"}
              isSubmitting={isSubmitting}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              onCancel={handleCloseDialog}
            />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Settings;
