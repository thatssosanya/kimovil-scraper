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
import { SortablePageItem } from "./SortablePageItem";

interface RatingsPage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  status: string;
  publishedAt: Date | null;
  position: number | null;
  createdAt: Date;
  updatedAt: Date;
  groups: Array<{
    group: {
      ratings: unknown[];
    };
  }>;
}

type Props = {
  pages: RatingsPage[];
  selectedPageId: string | null;
  pendingPageOrder: Record<number, string> | null;
  hasPendingChanges: boolean;
  onSelectPage: (pageId: string) => void;
  onEditPage: (page: RatingsPage) => void;
  onDeletePage: (pageId: string, pageName: string) => void;
  onPageStatusChange: (pageId: string, status: string) => void;
  onUpdatePageOrder: (newOrder: Record<number, string>) => void;
};

export const SortablePageList = ({
  pages,
  selectedPageId,
  pendingPageOrder,
  hasPendingChanges,
  onSelectPage,
  onEditPage,
  onDeletePage,
  onPageStatusChange,
  onUpdatePageOrder,
}: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Start dragging after 5px movement
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create effective page order for display
  const orderedPages = useMemo(() => {
    if (!pendingPageOrder) {
      // Use current order (by position, then createdAt)
      return [...pages].sort((a, b) => {
        if (a.position !== null && b.position !== null) {
          return a.position - b.position;
        }
        if (a.position !== null) return -1;
        if (b.position !== null) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    // Apply pending order
    const orderedList: RatingsPage[] = [];
    const pageMap = new Map(pages.map(p => [p.id, p]));

    // Add pages in the pending order
    Object.entries(pendingPageOrder)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([, pageId]) => {
        const page = pageMap.get(pageId);
        if (page) {
          orderedList.push(page);
          pageMap.delete(pageId);
        }
      });

    // Add any remaining pages (shouldn't happen in normal operation)
    orderedList.push(...Array.from(pageMap.values()));

    return orderedList;
  }, [pages, pendingPageOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedPages.findIndex((page) => page.id === active.id);
      const newIndex = orderedPages.findIndex((page) => page.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(orderedPages, oldIndex, newIndex);
        
        // Create position mapping
        const newOrderMapping: Record<number, string> = {};
        newOrder.forEach((page, index) => {
          newOrderMapping[index + 1] = page.id;
        });

        onUpdatePageOrder(newOrderMapping);
      }
    }
  };

  const items = orderedPages.map((page) => page.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {orderedPages.map((page, index) => (
            <SortablePageItem
              key={page.id}
              page={page}
              currentPosition={index + 1}
              isSelected={selectedPageId === page.id}
              hasPendingChanges={hasPendingChanges}
              onSelectPage={onSelectPage}
              onEditPage={onEditPage}
              onDeletePage={onDeletePage}
              onPageStatusChange={onPageStatusChange}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};