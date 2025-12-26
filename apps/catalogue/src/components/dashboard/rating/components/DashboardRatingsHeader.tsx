import { Button } from "@/src/components/ui/Button";
import { Save, Eye } from "lucide-react";
import type { RatingType, RatingCategory } from "@/src/server/db/schema";
import { type DeviceWithFullDetails } from "@/src/types/rating";
import { FilterBar } from "@/src/components/dashboard/common/FilterBar";

interface RatingWithRelations {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  ratingTypeId: string;
  RatingType: RatingType | null;
  RatingCategory: RatingCategory[];
  devices: DeviceWithFullDetails[];
}

interface HeaderActionsProps {
  hasPendingChanges: boolean;
  isLoading: boolean;
  onPreviewChanges: () => void;
  onSaveChanges: () => void;
}

const HeaderActions = ({
  hasPendingChanges,
  isLoading,
  onPreviewChanges,
  onSaveChanges,
}: HeaderActionsProps) => {
  if (!hasPendingChanges) return null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        onClick={onPreviewChanges}
        variant="outline"
        size="sm"
        className="gap-2 border-border/40 hover:bg-accent"
      >
        <Eye className="h-4 w-4" />
        Предпросмотр
      </Button>
      <Button
        onClick={onSaveChanges}
        variant="default"
        size="sm"
        className="gap-2 bg-green-600 text-white hover:bg-green-700"
        disabled={isLoading}
      >
        <Save className="h-4 w-4" />
        {isLoading ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
};

interface DashboardRatingsHeaderProps {
  ratingTypes: RatingType[];
  ratings: RatingWithRelations[];
  filteredRatings: RatingWithRelations[];
  selectedRatingType: string | null;
  onTypeChange: (type: string | null) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  hasPendingChanges: boolean;
  isLoading: boolean;
  onPreviewChanges: () => void;
  onSaveChanges: () => void;
  onCreateRating: () => void;
  ratingCategories: RatingCategory[];
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  selectedStatus: string | null;
  onStatusChange: (status: string | null) => void;
}

export const DashboardRatingsHeader = (props: DashboardRatingsHeaderProps) => {
  const {
    ratingTypes,
    ratings,
    filteredRatings,
    selectedRatingType,
    onTypeChange,
    searchQuery,
    onSearchChange,
    hasPendingChanges,
    isLoading,
    onPreviewChanges,
    onSaveChanges,
    onCreateRating,
    ratingCategories,
    selectedCategories,
    onCategoriesChange,
    selectedStatus,
    onStatusChange,
  } = props;
  const hasFilters =
    selectedRatingType || selectedCategories.length > 0 || selectedStatus || searchQuery;

  return (
    <div className="sticky top-0 z-20 -mx-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Рейтинги</h1>
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-muted-foreground">
              {hasFilters ? (
                <>
                  <span className="font-medium text-foreground">
                    {filteredRatings.length}
                  </span>{" "}
                  из{" "}
                  <span className="font-medium text-zinc-500">
                    {ratings.length}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {ratings.length}
                  </span>
                </>
              )}
            </span>
          </div>
          <HeaderActions
            hasPendingChanges={hasPendingChanges}
            isLoading={isLoading}
            onPreviewChanges={onPreviewChanges}
            onSaveChanges={onSaveChanges}
          />
        </div>
      </div>

      <FilterBar
        ratingTypes={ratingTypes}
        ratingCategories={ratingCategories}
        selectedType={selectedRatingType}
        selectedCategories={selectedCategories}
        selectedStatus={selectedStatus}
        onTypeChange={onTypeChange}
        onCategoriesChange={onCategoriesChange}
        onStatusChange={onStatusChange}
        onCreateRating={onCreateRating}
        onSearchChange={onSearchChange}
      />
    </div>
  );
};
