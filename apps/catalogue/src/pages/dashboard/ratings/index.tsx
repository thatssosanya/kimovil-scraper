import Layout from "@/src/components/dashboard/layout/Layout";
import { RatingChangePreviewDialog } from "@/src/components/dashboard/rating/components/dialogs/RatingChangePreviewDialog";
import { RatingDeviceSelectDrawer } from "@/src/components/dashboard/rating/components/dialogs/RatingDeviceSelectDrawer";
import { CreateRatingDialog } from "@/src/components/dashboard/rating/components/dialogs/CreateRatingDialog";
import { api } from "@/src/utils/api";
import React, { useState, useMemo, useEffect } from "react";
import useRatingStore from "@/src/stores/ratingStore";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { RatingContainer } from "@/src/components/dashboard/rating/components/RatingContainer";
import { useRatingFilter } from "@/src/components/dashboard/rating/hooks/useRatingFilter";
import { useRatingDevices } from "@/src/components/dashboard/rating/hooks/useRatingDevices";
import { useRatingActions } from "@/src/components/dashboard/rating/hooks/useRatingActions";
import { useRatingModals } from "@/src/components/dashboard/rating/hooks/useRatingModals";
import { useHeaderActions } from "@/src/hooks/useHeaderActions";
import { DataTableSearch } from "@/src/components/ui/data-table/components/Header/Search";
import { Button } from "@/src/components/ui/Button";
import { Eye, Save, Plus, ChevronDown } from "lucide-react";
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
import { PUBLISH_STATUS_LABELS } from "@/src/constants/publishStatus";
import type { RatingType, RatingCategory } from "@/src/server/db/schema";
import { cn } from "@/src/lib/utils";

const RatingSkeleton = () => (
  <div className="bg-card rounded-lg border p-4">
    <div className="flex items-center justify-between border-b pb-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
    <div className="pt-4">
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  </div>
);

interface RatingsQuickFiltersProps {
  ratingTypes: RatingType[];
  selectedRatingType: string | null;
  onRatingTypeChange: (value: string | null) => void;
  categories: RatingCategory[];
  selectedCategories: string[];
  onCategoriesChange: (value: string[]) => void;
  selectedStatus: string | null;
  onStatusChange: (value: string | null) => void;
}

const RatingsQuickFilters = ({
  ratingTypes,
  selectedRatingType,
  onRatingTypeChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  selectedStatus,
  onStatusChange,
}: RatingsQuickFiltersProps) => {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedRatingType ?? "all"}
        onValueChange={(v) => onRatingTypeChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 min-w-[140px] border-0 bg-zinc-100 text-xs focus:ring-0 dark:bg-[hsl(0_0%_20%)]">
          <SelectValue placeholder="Тип рейтинга" />
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
          <button
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-xs font-medium transition-all duration-200 active:scale-95",
              "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-[hsl(0_0%_20%)] dark:text-gray-200 dark:hover:bg-[hsl(0_0%_25%)]",
              "data-[state=open]:bg-zinc-200 data-[state=open]:dark:bg-[hsl(0_0%_25%)]"
            )}
          >
            Категории
            {selectedCategories.length > 0 && (
              <Badge
                variant="secondary"
                className="bg-primary/20 text-primary hover:bg-primary/20 ml-1 h-4 px-1 text-[10px]"
              >
                {selectedCategories.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50 transition-transform duration-200 data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {categories.map((category) => (
            <DropdownMenuItem
              key={category.id}
              className="flex items-center gap-2"
              onSelect={(e) => {
                e.preventDefault();
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
                className="accent-primary h-3.5 w-3.5 rounded-sm border-zinc-300"
                readOnly
              />
              <span className="truncate">{category.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select
        value={selectedStatus ?? "all"}
        onValueChange={(v) => onStatusChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 min-w-[130px] border-0 bg-zinc-100 text-xs focus:ring-0 dark:bg-[hsl(0_0%_20%)]">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(PUBLISH_STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

const Ratings = () => {
  const [selectedRatingType, setSelectedRatingType] = useState<string | null>(
    null
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const store = useRatingStore();

  const { data: ratings, isPending: isRatingsLoading } =
    api.rating.getAllRatings.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    });

  const { data: ratingTypes } = api.rating.getRatingTypes.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (ratings) {
      store.setRatings(ratings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratings]);

  const { data: categories } = api.rating.getRatingCategories.useQuery(
    undefined,
    {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    }
  );

  const {
    searchQuery,
    setSearchQuery,
    filteredRatings: searchFilteredRatings,
    matchedDeviceIds,
  } = useRatingFilter({
    ratings,
    selectedRatingType,
  });

  // Apply category and status filtering on top of type filtering
  const filteredRatings = useMemo(() => {
    if (!searchFilteredRatings) return [];

    let filtered = searchFilteredRatings;

    // Apply category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((rating) =>
        rating.RatingCategory.some((category) =>
          selectedCategories.includes(category.id)
        )
      );
    }

    // Apply status filter
    if (selectedStatus) {
      filtered = filtered.filter((rating) => rating.status === selectedStatus);
    }

    return filtered;
  }, [searchFilteredRatings, selectedCategories, selectedStatus]);

  const {
    deviceToReplace,
    setDeviceToReplace,
    handleReplaceDevice,
    handleAddDevice,
  } = useRatingDevices();

  const {
    handleDeleteRating,
    handleSaveChanges,
    handleCreateRating,
    hasPendingChanges,
    isCreating,
  } = useRatingActions();

  const {
    isChangePreviewOpen,
    deletePopoverOpen,
    handleOpenChangePreview,
    handleDeletePopoverChange,
  } = useRatingModals();

  useHeaderActions({
    title: "Рейтинги",
    leftActions: [
      <RatingsQuickFilters
        key="filters"
        ratingTypes={ratingTypes || []}
        selectedRatingType={selectedRatingType}
        onRatingTypeChange={setSelectedRatingType}
        categories={categories || []}
        selectedCategories={selectedCategories}
        onCategoriesChange={setSelectedCategories}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />,
    ],
    rightActions: [
      <DataTableSearch
        key="search"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Поиск рейтингов..."
      />,
      hasPendingChanges && (
        <Button
          key="preview"
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          onClick={() => handleOpenChangePreview(true)}
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Предпросмотр</span>
        </Button>
      ),
      hasPendingChanges && (
        <Button
          key="save"
          variant="outline"
          size="sm"
          className="h-8 gap-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
          onClick={() => void handleSaveChanges()}
          disabled={store.isLoading}
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">
            {store.isLoading ? "Сохранение..." : "Сохранить"}
          </span>
        </Button>
      ),
      <Button
        key="create"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-black dark:text-white"
        onClick={() => setIsCreateDialogOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>,
    ].filter(Boolean),
  });

  return (
    <Layout contentScrollable={true}>
      <div className="mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {isRatingsLoading ? (
            <>
              <RatingSkeleton />
              <RatingSkeleton />
              <RatingSkeleton />
            </>
          ) : (
            filteredRatings.map((rating) => (
              <RatingContainer
                key={rating.id}
                rating={rating}
                onDeleteRating={handleDeleteRating}
                onReplaceDevice={(device, ratingId) =>
                  setDeviceToReplace({ device, ratingId })
                }
                onAddDevice={handleAddDevice}
                deletePopoverOpen={deletePopoverOpen}
                onDeletePopoverChange={handleDeletePopoverChange}
                matchedDeviceIds={matchedDeviceIds}
              />
            ))
          )}
        </div>

        {isChangePreviewOpen && ratings && (
          <RatingChangePreviewDialog
            open={isChangePreviewOpen}
            onClose={() => handleOpenChangePreview(false)}
            ratings={ratings}
          />
        )}

        <RatingDeviceSelectDrawer
          open={!!deviceToReplace}
          onOpenChange={(open: boolean) => !open && setDeviceToReplace(null)}
          deviceToReplace={deviceToReplace?.device ?? null}
          ratingId={deviceToReplace?.ratingId ?? ""}
          onReplace={handleReplaceDevice}
        />

        <CreateRatingDialog
          open={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          ratingTypes={ratingTypes || []}
          categories={categories || []}
          onCreateRating={handleCreateRating}
          isLoading={isCreating}
        />
      </div>
    </Layout>
  );
};

export default Ratings;
