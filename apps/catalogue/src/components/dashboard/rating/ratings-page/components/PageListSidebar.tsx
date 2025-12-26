import React from "react";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { Button } from "@/src/components/ui/Button";
import { Plus, Save, Undo2 } from "lucide-react";
import useRatingsPageStore from "@/src/stores/ratingsPageStore";
import { SortablePageList } from "./SortablePageList";

interface RatingsPage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  status: string; // API returns string, not the typed enum
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

interface PageListSidebarProps {
  pages: RatingsPage[] | undefined;
  isPagesLoading: boolean;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: () => void;
  onEditPage: (page: RatingsPage) => void;
  onDeletePage: (pageId: string, pageName: string) => void;
  onPageStatusChange: (pageId: string, status: string) => void;
  onSaveChanges: () => void;
  isLoading?: boolean;
}

export const PageListSidebar = ({
  pages,
  isPagesLoading,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onEditPage,
  onDeletePage,
  onPageStatusChange,
  onSaveChanges,
  isLoading = false,
}: PageListSidebarProps) => {
  const store = useRatingsPageStore();

  return (
    <div className="h-full w-80 border-r bg-muted/30">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-border/60 bg-white px-6 py-2">
          {/* Title Row */}
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold text-gray-900">
                  Страницы рейтингов
                </h1>
                {pages && pages.length > 0 && (
                  <span className="inline-flex items-center rounded-md text-sm font-medium text-gray-700">
                    {pages.length}{" "}
                    {pages.length === 1
                      ? "страница"
                      : pages.length <= 4
                      ? "страницы"
                      : "страниц"}
                  </span>
                )}
              </div>
              
              {/* Save/Revert buttons for page ordering */}
              {store.pendingPageOrder && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={store.revertPageOrder}
                    disabled={isLoading}
                    className="h-8 px-2"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onSaveChanges}
                    disabled={isLoading}
                    className="h-8 px-3"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Сохранить
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pages List */}
        <div className="h-full flex-1 overflow-y-auto p-4">
          {isPagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col gap-3">
              <div
                onClick={onCreatePage}
                className="hover:bg-primary-50/50 group cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 p-6 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
              >
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <Plus className="mx-auto mb-3 h-8 w-8 text-gray-400 transition-colors duration-200 group-hover:text-primary" />
                    <h3 className="text-sm font-medium text-gray-700 transition-colors duration-200 group-hover:text-primary">
                      Создать новую страницу
                    </h3>
                  </div>
                </div>
              </div>

              {pages && pages.length > 0 ? (
                <SortablePageList
                  pages={pages}
                  selectedPageId={selectedPageId}
                  pendingPageOrder={store.pendingPageOrder}
                  hasPendingChanges={!!store.pendingPageOrder}
                  onSelectPage={onSelectPage}
                  onEditPage={onEditPage}
                  onDeletePage={onDeletePage}
                  onPageStatusChange={onPageStatusChange}
                  onUpdatePageOrder={store.updatePageOrder}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
