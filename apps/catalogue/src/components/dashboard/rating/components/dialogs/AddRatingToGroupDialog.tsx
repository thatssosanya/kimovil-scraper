import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/Dialog";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { Badge } from "@/src/components/ui/Badge";
import { api } from "@/src/utils/api";
import { cn } from "@/src/lib/utils";
import { Star, Users, Tag, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { RouterOutputs } from "@/src/utils/api";

export interface AddRatingToGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onAddRatings: (ratingIds: string[]) => Promise<void>;
  isLoading?: boolean;
  groupId: string;
  groupName: string;
  existingRatingIds: string[];
}

type _Rating = RouterOutputs["rating"]["getAllRatings"][0];

export const AddRatingToGroupDialog: React.FC<AddRatingToGroupDialogProps> = ({
  open,
  onClose,
  onAddRatings,
  isLoading = false,
  groupId: _groupId,
  groupName,
  existingRatingIds,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRatingIds, setSelectedRatingIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all ratings
  const {
    data: ratings = [],
    isLoading: isLoadingRatings,
    error: ratingsError,
  } = api.rating.getAllRatings.useQuery();

  // Filter and sort ratings based on search query and exclude existing ones
  const filteredRatings = useMemo(() => {
    return ratings
      .filter((rating) => {
        const matchesSearch = rating.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const notInGroup = !existingRatingIds.includes(rating.id);
        return matchesSearch && notInGroup;
      })
      .sort((a, b) => {
        // Sort by most recently updated first
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [ratings, searchQuery, existingRatingIds]);

  // Handle checkbox changes
  const handleRatingToggle = (ratingId: string, checked: boolean) => {
    setSelectedRatingIds((prev) => {
      if (checked) {
        return [...prev, ratingId];
      } else {
        return prev.filter((id) => id !== ratingId);
      }
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    const allFilteredIds = filteredRatings.map((rating) => rating.id);
    if (selectedRatingIds.length === allFilteredIds.length) {
      setSelectedRatingIds([]);
    } else {
      setSelectedRatingIds(allFilteredIds);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (selectedRatingIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await onAddRatings(selectedRatingIds);
      // Reset state after successful submission
      setSelectedRatingIds([]);
      setSearchQuery("");
      onClose();
    } catch (error) {
      console.error("Failed to add ratings to group:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    setSelectedRatingIds([]);
    setSearchQuery("");
    onClose();
  };

  // Get rating type badge variant
  const getRatingTypeBadgeVariant = (typeName: string) => {
    const lowerTypeName = typeName.toLowerCase();
    if (lowerTypeName.includes("flagship") || lowerTypeName.includes("premium")) {
      return "default";
    }
    if (lowerTypeName.includes("budget") || lowerTypeName.includes("value")) {
      return "secondary";
    }
    return "outline";
  };

  const allFilteredSelected = filteredRatings.length > 0 && 
    selectedRatingIds.length === filteredRatings.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Добавить рейтинги в группу &ldquo;{groupName}&rdquo;
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Выберите рейтинги для добавления в группу. Рейтинги, уже находящиеся в группе, не отображаются.
          </p>
        </DialogHeader>

        {/* Search and controls */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                placeholder="Поиск по названию рейтинга..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            {filteredRatings.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="whitespace-nowrap"
              >
                {allFilteredSelected ? "Снять все" : "Выбрать все"}
              </Button>
            )}
          </div>

          {/* Selection summary */}
          {selectedRatingIds.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Выбрано {selectedRatingIds.length} рейтинг{selectedRatingIds.length === 1 ? "" : selectedRatingIds.length < 5 ? "а" : "ов"}
              </span>
            </div>
          )}
        </div>

        {/* Ratings list */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {isLoadingRatings ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Загрузка рейтингов...</span>
              </div>
            </div>
          ) : ratingsError ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>Ошибка загрузки рейтингов</span>
              </div>
            </div>
          ) : filteredRatings.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery
                    ? "Рейтинги не найдены"
                    : "Все доступные рейтинги уже добавлены в группу"}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96 space-y-2 pr-2">
              {filteredRatings.map((rating) => {
                const isSelected = selectedRatingIds.includes(rating.id);
                const deviceCount = rating.devices?.length || 0;

                return (
                  <div
                    key={rating.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-accent/50",
                      isSelected
                        ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200"
                        : "bg-background border-border hover:border-accent-foreground/20"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleRatingToggle(rating.id, checked === true)
                      }
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        <h3 className="font-medium text-foreground truncate">
                          {rating.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {rating.RatingType && (
                          <Badge
                            variant={getRatingTypeBadgeVariant(
                              rating.RatingType.displayName || rating.RatingType.name
                            )}
                            className="text-xs"
                          >
                            {rating.RatingType.displayName || rating.RatingType.name}
                          </Badge>
                        )}

                        {rating.RatingCategory && rating.RatingCategory.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {rating.RatingCategory[0]?.name}
                          </Badge>
                        )}

                        <span className="text-xs text-muted-foreground">
                          {deviceCount} устройств{deviceCount === 1 ? "о" : deviceCount < 5 ? "а" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={selectedRatingIds.length === 0 || isSubmitting || isLoading}
            className="min-w-[120px]"
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Добавление...
              </>
            ) : (
              `Добавить (${selectedRatingIds.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};