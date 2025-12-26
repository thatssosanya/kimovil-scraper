import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/src/components/ui/Button";
import { StatusBadge } from "@/src/components/ui/StatusSelector";
import {
  PUBLISH_STATUS,
  type PublishStatus,
} from "@/src/constants/publishStatus";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/src/components/ui/ContextMenu";
import {
  FileText,
  Edit,
  Trash2,
  Globe,
  EyeOff,
  Archive,
  FileX,
  Settings,
  GripVertical,
  Undo2,
} from "lucide-react";
import useRatingsPageStore from "@/src/stores/ratingsPageStore";

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
  page: RatingsPage;
  currentPosition: number;
  isSelected: boolean;
  hasPendingChanges: boolean;
  onSelectPage: (pageId: string) => void;
  onEditPage: (page: RatingsPage) => void;
  onDeletePage: (pageId: string, pageName: string) => void;
  onPageStatusChange: (pageId: string, status: string) => void;
};

export const SortablePageItem = ({
  page,
  currentPosition,
  isSelected,
  hasPendingChanges,
  onSelectPage,
  onEditPage,
  onDeletePage,
  onPageStatusChange,
}: Props) => {
  const store = useRatingsPageStore();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition: _transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : "transform 150ms ease",
  };

  const hasPendingPageChanges = store.getPendingPageChanges(page.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group transition-all ${
        isDragging ? "opacity-60 z-50" : ""
      }`}
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={`cursor-pointer rounded-lg border p-4 transition-all hover:shadow-sm ${
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-background hover:bg-accent/50"
            }`}
            onClick={() => onSelectPage(page.id)}
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="text-xs font-mono text-muted-foreground/60 min-w-[1rem] text-center">
                  {currentPosition}
                </div>
              </div>
              
              <div className="min-w-0 flex-1 space-y-1">
                {/* Row 1: Status and pending changes indicator */}
                <div className="flex items-center gap-2">
                  <StatusBadge status={page.status as PublishStatus} />
                  {(hasPendingPageChanges || hasPendingChanges) && (
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                  )}
                </div>
                
                {/* Row 2: Title */}
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <h3 className="truncate font-medium text-base">
                    {page.name}
                  </h3>
                </div>
                
                {/* Row 3: Counts */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{page.groups.length} групп</span>
                  <span>
                    {page.groups.reduce(
                      (acc, g) => acc + g.group.ratings.length,
                      0
                    )}{" "}
                    рейтингов
                  </span>
                </div>
              </div>

              {(hasPendingPageChanges || hasPendingChanges) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasPendingPageChanges) {
                      store.revertPageChanges(page.id);
                    }
                    if (hasPendingChanges) {
                      store.revertPageOrder();
                    }
                  }}
                  className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => onEditPage(page)}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Редактировать
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Статус
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                onClick={() =>
                  onPageStatusChange(
                    page.id,
                    PUBLISH_STATUS.PUBLISHED
                  )
                }
                disabled={
                  page.status === PUBLISH_STATUS.PUBLISHED
                }
                className="flex items-center gap-2"
              >
                <Globe className="h-4 w-4" />
                Опубликовать
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  onPageStatusChange(
                    page.id,
                    PUBLISH_STATUS.DRAFT
                  )
                }
                disabled={page.status === PUBLISH_STATUS.DRAFT}
                className="flex items-center gap-2"
              >
                <FileX className="h-4 w-4" />В черновик
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  onPageStatusChange(
                    page.id,
                    PUBLISH_STATUS.PRIVATE
                  )
                }
                disabled={
                  page.status === PUBLISH_STATUS.PRIVATE
                }
                className="flex items-center gap-2"
              >
                <EyeOff className="h-4 w-4" />
                Приватный
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  onPageStatusChange(
                    page.id,
                    PUBLISH_STATUS.ARCHIVED
                  )
                }
                disabled={
                  page.status === PUBLISH_STATUS.ARCHIVED
                }
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Архивировать
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDeletePage(page.id, page.name)}
            className="flex items-center gap-2 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Удалить
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};