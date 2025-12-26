import React, { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { SortableRatingItem } from "./SortableRatingItem";

type RatingPosition = {
  id: string;
  position: number;
  shortName: string | null;
  ratingId: string;
  groupId: string;
  createdAt: Date;
  updatedAt: Date;
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
  ratings: RatingPosition[];
  groupId: string;
  pendingChanges?: Record<number, string>; // position -> ratingId
  hasPendingChanges: boolean;
  onUpdatePositions: (changes: Record<number, string>) => void;
  onShortNameChange: (
    groupId: string,
    ratingId: string,
    shortName: string
  ) => void;
  onRemoveRating: (groupId: string, ratingId: string) => void;
};

export const SortableRatingsList = ({
  ratings,
  groupId,
  pendingChanges = {},
  hasPendingChanges,
  onUpdatePositions,
  onShortNameChange,
  onRemoveRating,
}: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 0,
        tolerance: 0,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate effective positions based on original data + pending changes
  const effectiveItems = useMemo(() => {
    // Start with original positions
    const originalPositions = new Map<string, number>();
    ratings.forEach((rating) => {
      originalPositions.set(rating.ratingId, rating.position);
    });

    // Apply pending changes
    const effectivePositions = new Map<string, number>();

    if (Object.keys(pendingChanges).length > 0) {
      // Use pending changes
      Object.entries(pendingChanges).forEach(([pos, ratingId]) => {
        effectivePositions.set(ratingId, parseInt(pos));
      });
    } else {
      // Use original positions
      originalPositions.forEach((position, ratingId) => {
        effectivePositions.set(ratingId, position);
      });
    }

    // Create items array based on effective positions
    const items = ratings.map((rating) => {
      const effectivePos =
        effectivePositions.get(rating.ratingId) || rating.position;
      const isPending = effectivePos !== rating.position;

      return {
        ...rating,
        effectivePosition: effectivePos,
        isPending,
      };
    });

    // Sort by effective position
    return items.sort((a, b) => a.effectivePosition - b.effectivePosition);
  }, [ratings, pendingChanges]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = effectiveItems.findIndex(
        (item) => item.id === active.id
      );
      const newIndex = effectiveItems.findIndex((item) => item.id === over?.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newItems = arrayMove(effectiveItems, oldIndex, newIndex);

      // Create new position mapping
      const newPositions: Record<number, string> = {};
      newItems.forEach((item, index) => {
        newPositions[index + 1] = item.ratingId;
      });
      console.log("newPositions", newPositions);

      onUpdatePositions(newPositions);
    }
  };

  if (effectiveItems.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <p>В этой группе пока нет рейтингов</p>
      </div>
    );
  }

  // Show a visual indicator if there are pending changes
  const containerClasses = hasPendingChanges
    ? "space-y-2 rounded-lg bg-orange-50 p-3 border border-orange-200"
    : "space-y-2";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext
        items={effectiveItems.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={containerClasses}>
          {effectiveItems.map((item) => (
            <SortableRatingItem
              key={item.id}
              id={item.id}
              rating={item}
              position={item.effectivePosition}
              originalPosition={item.position}
              isPending={item.isPending}
              onShortNameChange={(shortName) =>
                onShortNameChange(groupId, item.ratingId, shortName)
              }
              onRemove={() => onRemoveRating(groupId, item.ratingId)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
