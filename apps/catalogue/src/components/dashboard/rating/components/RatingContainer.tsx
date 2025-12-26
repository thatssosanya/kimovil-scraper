import { useMemo } from "react";
import { type DeviceWithFullDetails } from "@/src/types/rating";
import { EditableRatingName } from "./EditableRatingName";
import { RatingDeviceList } from "./RatingDeviceList";
import { RatingStatusToggle } from "./RatingStatusToggle";
import useRatingStore from "@/src/stores/ratingStore";
import { Button } from "@/src/components/ui/Button";
import { Undo2, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/Popover";
import type { Rating, RatingCategory } from "@/src/server/db/schema";
import { EditableSelect } from "@/src/components/ui/EditableSelect";
import { EditableMultiSelect } from "@/src/components/ui/EditableMultiSelect";
import { api } from "@/src/utils/api";
import type { PublishStatus } from "@/src/constants/publishStatus";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface RatingContainerProps {
  rating: Rating & {
    RatingType: {
      displayName: string | null;
      name: string;
      id: string;
    } | null;
    RatingCategory: (RatingCategory & {
      id: string;
      name: string;
      displayName?: string | null;
    })[];
    devices: DeviceWithFullDetails[];
  };
  onDeleteRating: (ratingId: string) => void;
  onReplaceDevice: (device: DeviceWithFullDetails, ratingId: string) => void;
  onAddDevice: (ratingId: string) => void;
  deletePopoverOpen: string | null;
  onDeletePopoverChange: (ratingId: string | null) => void;
  matchedDeviceIds?: Set<string>;
}

export const RatingContainer = ({
  rating,
  onDeleteRating,
  onReplaceDevice,
  onAddDevice,
  deletePopoverOpen,
  onDeletePopoverChange,
  matchedDeviceIds,
}: RatingContainerProps) => {
  const store = useRatingStore();
  const utils = api.useUtils();
  const effectivePositions = store.getEffectivePositions(rating.id);

  // Calculate the most recent update date from positions and rating
  const lastUpdateDate = useMemo(() => {
    const dates = [
      ...effectivePositions.map((p) => p.updatedAt),
      rating.updatedAt,
    ].filter((date): date is Date => date instanceof Date);

    return dates.length > 0
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : null;
  }, [effectivePositions, rating.updatedAt]);

  const { data: ratingTypes } = api.rating.getRatingTypes.useQuery();
  const { data: ratingCategories } = api.rating.getRatingCategories.useQuery();

  const updateRatingTypeMutation =
    api.rating.updateRatingRatingType.useMutation({
      onSuccess: () => {
        void utils.rating.invalidate();
      },
    });

  const updateRatingCategoriesMutation =
    api.rating.updateRatingCategories.useMutation({
      onSuccess: () => {
        void utils.rating.invalidate();
      },
    });

  const updateRatingStatusMutation = api.rating.updateRatingStatus.useMutation({
    onSuccess: () => {
      void utils.rating.invalidate();
    },
  });

  const ratingTypeOptions =
    ratingTypes?.map((type) => ({
      value: type.id,
      label: type.displayName || type.name,
    })) || [];

  const ratingCategoryOptions =
    ratingCategories?.map((category) => ({
      value: category.id,
      label: category.name,
    })) || [];

  const handleRatingTypeChange = (typeId: string) => {
    updateRatingTypeMutation.mutate({
      id: rating.id,
      typeId,
    });
  };

  const handleRatingCategoriesChange = (categoryIds: string[]) => {
    updateRatingCategoriesMutation.mutate({
      ratingId: rating.id,
      categoryIds,
    });
  };

  const handleStatusChange = (status: PublishStatus) => {
    updateRatingStatusMutation.mutate({
      id: rating.id,
      status,
    });
  };

  return (
    <div className="border-border/60 bg-card hover:border-border group relative rounded-xl border transition-all duration-300 hover:shadow-md dark:border-gray-800 dark:bg-[hsl(0_0%_9%)] dark:hover:border-gray-700">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-1">
              {lastUpdateDate && (
                <span className="text-muted-foreground text-[10px]">
                  Обновлён{" "}
                  {formatDistanceToNow(lastUpdateDate, {
                    addSuffix: true,
                    locale: ru,
                  })}
                </span>
              )}
              <EditableRatingName
                name={rating.name}
                pendingName={store.getPendingChangesForRating(rating.id)?.name}
                onNameChange={(newName: string) =>
                  store.updateRatingName(rating.id, newName)
                }
              />
            </div>

            <div className="flex flex-wrap items-start gap-3 text-sm">
              <EditableMultiSelect
                values={rating.RatingCategory.map((cat) => cat.id)}
                options={ratingCategoryOptions}
                onChange={handleRatingCategoriesChange}
                placeholder="Выберите категории"
                showConfirmation
                label="Категории"
                isLoading={updateRatingCategoriesMutation.isPending}
              />
              {rating.RatingType && (
                <EditableSelect
                  value={rating.RatingType.id}
                  options={ratingTypeOptions}
                  onChange={handleRatingTypeChange}
                  placeholder="Выберите тип"
                  showConfirmation
                  label="Тип"
                  isLoading={updateRatingTypeMutation.isPending}
                />
              )}
              <RatingStatusToggle
                currentStatus={rating.status}
                onStatusChange={handleStatusChange}
                isLoading={updateRatingStatusMutation.isPending}
                label="Статус"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {store.getPendingChangesForRating(rating.id) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void store.revertChanges(rating.id)}
                className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            )}
            <Popover
              open={deletePopoverOpen === rating.id}
              onOpenChange={(open) =>
                onDeletePopoverChange(open ? rating.id : null)
              }
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">
                      Удалить рейтинг?
                    </h4>
                    <p className="text-muted-foreground text-xs">
                      Это действие нельзя отменить.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onDeletePopoverChange(null)}
                    >
                      Отмена
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onDeleteRating(rating.id)}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      <div className="border-border/40 bg-muted/10 rounded-b-xl border-t p-2 dark:border-gray-800/60 dark:bg-black/20">
        <RatingDeviceList
          devices={rating.devices}
          ratingId={rating.id}
          onReplaceDevice={(device) => onReplaceDevice(device, rating.id)}
          onAddDevice={() => onAddDevice(rating.id)}
          matchedDeviceIds={matchedDeviceIds}
        />
      </div>
    </div>
  );
};
