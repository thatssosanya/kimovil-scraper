import React, { useMemo } from "react";
import { Button } from "@/src/components/ui/Button";
import { CompactStatusControl } from "@/src/components/ui/CompactStatusControl";
import type { PublishStatus } from "@/src/constants/publishStatus";
import { Edit, Eye, Save, FolderPlus } from "lucide-react";
import { useRatingsPageActions } from "../hooks/useRatingsPageActions";

interface RatingsPage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string; // API returns string, not the typed enum
  publishedAt: Date | null;
  groups: Array<{
    group: {
      ratings: unknown[];
    };
  }>;
}

interface PageHeaderProps {
  selectedPage: RatingsPage;
  onEditPage: () => void;
  onPageStatusChange: (pageId: string, status: string) => void;
  onPreviewChanges: () => void;
  onSaveChanges: () => void;
  onCreateGroup: () => void;
}

export const PageHeader = ({
  selectedPage,
  onEditPage,
  onPageStatusChange,
  onPreviewChanges,
  onSaveChanges,
  onCreateGroup,
}: PageHeaderProps) => {
  // Get state from hook
  const { store, mutations } = useRatingsPageActions();

  // Computed values
  const hasPendingChanges = useMemo(() => {
    return (
      store.pendingPageChanges.size > 0 || store.pendingGroupChanges.size > 0
    );
  }, [store.pendingPageChanges.size, store.pendingGroupChanges.size]);

  return (
    <div className="bg-background border-b">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-foreground text-xl font-semibold leading-none">
                {selectedPage.name}
              </h1>
              <CompactStatusControl
                status={selectedPage.status as PublishStatus}
                publishedAt={selectedPage.publishedAt}
                onStatusChange={(status) =>
                  onPageStatusChange(selectedPage.id, status)
                }
                disabled={mutations.updatePageStatusMutation.isPending}
              />
            </div>
            {selectedPage.description && (
              <p className="text-muted-foreground mb-2 max-w-2xl text-sm leading-relaxed">
                {selectedPage.description}
              </p>
            )}
            <div className="text-muted-foreground flex items-center gap-4 text-xs">
              <span>{selectedPage.groups.length} групп</span>
              <span>
                {selectedPage.groups.reduce(
                  (acc, g) => acc + g.group.ratings.length,
                  0
                )}{" "}
                рейтингов
              </span>
            </div>
          </div>
          <div className="ml-4 flex items-center gap-2">
            <Button
              onClick={onEditPage}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground gap-2"
            >
              <Edit className="h-4 w-4" />
              Редактировать
            </Button>
            {hasPendingChanges && (
              <>
                <Button
                  variant="outline"
                  onClick={onPreviewChanges}
                  size="sm"
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Предпросмотр
                </Button>
                <Button
                  onClick={onSaveChanges}
                  size="sm"
                  className="gap-2"
                  disabled={store.isLoading}
                >
                  <Save className="h-4 w-4" />
                  Сохранить изменения
                </Button>
              </>
            )}
            <Button
              onClick={onCreateGroup}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" />
              Добавить группу
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
