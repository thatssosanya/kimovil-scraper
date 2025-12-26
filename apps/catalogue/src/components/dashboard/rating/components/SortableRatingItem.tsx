import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { GripVertical, X, Edit2, Check, X as XIcon } from "lucide-react";
import { clsx } from "clsx";

type RatingPosition = {
  id: string;
  position: number;
  shortName: string | null;
  ratingId: string;
  rating: {
    id: string;
    name: string;
    ratingType: {
      id: string;
      name: string;
      displayName: string | null;
    } | null;
  };
};

type Props = {
  id: string;
  rating: RatingPosition;
  position: number;
  originalPosition: number;
  isPending: boolean;
  onShortNameChange: (shortName: string) => void;
  onRemove: () => void;
};

export const SortableRatingItem = ({
  id,
  rating,
  position,
  originalPosition,
  isPending,
  onShortNameChange,
  onRemove,
}: Props) => {
  const [isEditingShortName, setIsEditingShortName] = useState(false);
  const [shortNameValue, setShortNameValue] = useState(rating.shortName || "");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveShortName = () => {
    onShortNameChange(shortNameValue.trim());
    setIsEditingShortName(false);
  };

  const handleCancelShortName = () => {
    setShortNameValue(rating.shortName || "");
    setIsEditingShortName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveShortName();
    } else if (e.key === "Escape") {
      handleCancelShortName();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "bg-card group flex items-center gap-3 rounded-lg border p-3 transition-shadow",
        isDragging ? "opacity-75 shadow-lg" : "hover:shadow-sm"
      )}
    >
      {/* Drag Handle */}
      <div
        className="text-muted-foreground hover:text-foreground cursor-grab transition-colors active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Position Number */}
      <div
        className={clsx(
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
          isPending
            ? "border border-orange-300 bg-orange-100 text-orange-700"
            : "bg-primary/10 text-primary"
        )}
      >
        {position}
      </div>

      {/* Rating Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{rating.rating.name}</span>
          {rating.rating.ratingType && (
            <span className="bg-secondary text-muted-foreground inline-flex items-center rounded-full px-2 py-1 text-xs">
              {rating.rating.ratingType.displayName ||
                rating.rating.ratingType.name}
            </span>
          )}
        </div>

        {/* Short Name Section */}
        <div className="mt-1 flex items-center gap-2">
          {/* Show original position if changed */}
          {originalPosition !== position && (
            <span className="text-muted-foreground text-xs">
              (было {originalPosition})
            </span>
          )}
          {isEditingShortName ? (
            <div className="flex items-center gap-1">
              <Input
                value={shortNameValue}
                onChange={(e) => setShortNameValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Короткое название"
                className="h-6 w-32 text-xs"
                autoFocus
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveShortName}
                className="h-6 w-6 p-0"
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelShortName}
                className="h-6 w-6 p-0"
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">
                {rating.shortName || "Нет короткого названия"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingShortName(true)}
                className="h-5 w-5 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Remove Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
