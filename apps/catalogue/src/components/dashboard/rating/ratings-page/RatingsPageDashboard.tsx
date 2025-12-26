import React, { useState, useMemo, useEffect } from "react";
import Layout from "@/src/components/dashboard/layout/Layout";
import { api } from "@/src/utils/api";
import useRatingsPageStore from "@/src/stores/ratingsPageStore";
import { ConfirmDialog } from "@/src/components/ui/ConfirmDialog";
import { FileText } from "lucide-react";

// Import refactored components
import { PageListSidebar, PageHeader, GroupsContent } from "./components";
import { useRatingsPageActions } from "./hooks";

// Dialog imports
import { CreateRatingsPageDialog } from "@/src/components/dashboard/rating/components/dialogs/CreateRatingsPageDialog";
import { EditRatingsPageDialog } from "@/src/components/dashboard/rating/components/dialogs/EditRatingsPageDialog";
import { CreateRatingsGroupDialog } from "@/src/components/dashboard/rating/components/dialogs/CreateRatingsGroupDialog";
import { EditRatingsGroupDialog } from "@/src/components/dashboard/rating/components/dialogs/EditRatingsGroupDialog";
import { AddRatingToGroupDialog } from "@/src/components/dashboard/rating/components/dialogs/AddRatingToGroupDialog";

const RatingsPageDashboard = () => {
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isCreatePageDialogOpen, setIsCreatePageDialogOpen] = useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);

  const ratingsStore = useRatingsPageStore();

  // Fetch pages
  const { data: pages, isPending: isPagesLoading } =
    api.ratingsPage.getAllPagesAdmin.useQuery(
      {},
      {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
      }
    );

  useEffect(() => {
    if (pages) {
      ratingsStore.setPages(pages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // Use refactored actions hook
  const {
    confirmDialog,
    selectedGroupForRating,
    isAddRatingDialogOpen,
    selectedGroupForEdit,
    isEditGroupDialogOpen,
    selectedPageForEdit,
    isEditPageDialogOpen,
    setConfirmDialog,
    setSelectedGroupForRating,
    setIsAddRatingDialogOpen,
    setSelectedGroupForEdit,
    setIsEditGroupDialogOpen,
    setSelectedPageForEdit,
    setIsEditPageDialogOpen,
    openEditPageDialog,
    confirmDeletePage,
    openRatingDialog,
    openEditGroupDialog,
    store,
    mutations,
  } = useRatingsPageActions();

  // Helper functions
  const handleUpdatePage = async (data: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    iconName?: string;
    status?: string;
  }) => {
    if (data.status) {
      // Update status separately if provided
      await mutations.updatePageStatusMutation.mutateAsync({
        id: data.id,
        status: data.status as "DRAFT" | "PUBLISHED" | "PRIVATE" | "ARCHIVED",
      });
    }

    await mutations.updatePageMutation.mutateAsync({
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      iconName: data.iconName || null,
    });
  };

  const handleSaveChanges = async () => {
    await store.saveChanges({
      updateRatingPositions:
        mutations.updateRatingPositionsMutation.mutateAsync,
      updateGroupPositions: mutations.updateGroupPositionsMutation.mutateAsync,
      updatePagePositions: mutations.updatePagePositionsMutation.mutateAsync,
    });
  };

  const handlePreviewChanges = () => {
    const changes = store.previewChanges();
    console.log("Previewing changes...", changes);
  };

  const handleCreatePage = async (data: {
    name: string;
    slug: string;
    description?: string;
    iconName?: string;
    status?: string;
  }) => {
    await mutations.createPageMutation.mutateAsync({
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      iconName: data.iconName || null,
      status: data.status as
        | "DRAFT"
        | "PUBLISHED"
        | "PRIVATE"
        | "ARCHIVED"
        | undefined,
    });
  };

  const handleCreateGroup = async (data: {
    name: string;
    displayName?: string;
    description?: string;
    type?: string;
    pageId?: string;
  }) => {
    const group = await mutations.createGroupMutation.mutateAsync({
      name: data.name,
      displayName: data.displayName || null,
      description: data.description || null,
      type: data.type || null,
    });

    if (data.pageId && group) {
      const nextPosition = store.getNextGroupPositionForPage(data.pageId);
      await mutations.addGroupToPageMutation.mutateAsync({
        pageId: data.pageId,
        groupId: group.id,
        position: nextPosition,
      });
    }
  };

  const handleUpdateGroup = async (data: {
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    type?: string;
  }) => {
    await mutations.updateGroupMutation.mutateAsync({
      id: data.id,
      name: data.name,
      displayName: data.displayName || null,
      description: data.description || null,
      type: data.type || null,
    });
  };

  const handleAddRatings = async (ratingIds: string[]) => {
    if (!selectedGroupForRating) return;

    for (let i = 0; i < ratingIds.length; i++) {
      const ratingId = ratingIds[i];
      const nextPosition =
        store.getNextRatingPositionForGroup(selectedGroupForRating.id) + i;

      await mutations.addRatingToGroupMutation.mutateAsync({
        groupId: selectedGroupForRating.id,
        ratingId: ratingId!,
        position: nextPosition,
      });
    }
    setSelectedGroupForRating(null);
    setIsAddRatingDialogOpen(false);
  };

  // Additional missing handlers
  const handlePageStatusChange = async (pageId: string, status: string) => {
    await mutations.updatePageStatusMutation.mutateAsync({
      id: pageId,
      status: status as "DRAFT" | "PUBLISHED",
    });
  };

  const handleUpdateGroupRatingPositions = (
    groupId: string,
    newPositions: Record<number, string>
  ) => {
    store.updateGroupRatingPositions(groupId, newPositions);
  };

  const handleShortNameChange = async (
    groupId: string,
    ratingId: string,
    shortName: string
  ) => {
    await mutations.updateRatingShortNameMutation.mutateAsync({
      groupId,
      ratingId,
      shortName: shortName.trim() || undefined,
    });
  };

  const handleRemoveRating = async (groupId: string, ratingId: string) => {
    await mutations.removeRatingFromGroupMutation.mutateAsync({
      groupId,
      ratingId,
    });
  };

  const handleUpdateGroupDisplayType = async (
    groupId: string,
    displayType: string
  ) => {
    const group = selectedPage?.groups.find(
      (g) => g.group.id === groupId
    )?.group;
    if (!group) return;

    await mutations.updateGroupMutation.mutateAsync({
      id: groupId,
      name: group.name,
      displayName: group.displayName,
      description: group.description,
      displayType: displayType as "regular" | "feature" | "single",
      type: group.type,
    });
  };

  // Computed values
  const selectedPage = useMemo(() => {
    return selectedPageId ? pages?.find((p) => p.id === selectedPageId) : null;
  }, [selectedPageId, pages]);

  return (
    <Layout>
      <div className="flex h-full  overflow-hidden">
        {/* Left Sidebar - Pages List */}
        <div className=" flex-shrink-0 overflow-auto border-r">
          <PageListSidebar
            pages={pages}
            isPagesLoading={isPagesLoading}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
            onCreatePage={() => setIsCreatePageDialogOpen(true)}
            onEditPage={openEditPageDialog}
            onDeletePage={(pageId, pageName) => {
              confirmDeletePage(pageId, pageName, () => {
                void mutations.deletePageMutation.mutateAsync({ id: pageId });
                if (pageId === selectedPageId) {
                  setSelectedPageId(null);
                }
              });
            }}
            onPageStatusChange={(pageId, status) =>
              void handlePageStatusChange(pageId, status)
            }
            onSaveChanges={() => void handleSaveChanges()}
            isLoading={store.isLoading}
          />
        </div>

        {/* Right Content Area */}
        <div className="flex max-h-[calc(100vh)] flex-1 flex-col overflow-y-auto">
          {selectedPage ? (
            <>
              {/* Page Header */}
              <div className="bg-background sticky top-0 z-10 border-b">
                <PageHeader
                  selectedPage={selectedPage}
                  onEditPage={() => openEditPageDialog(selectedPage)}
                  onPageStatusChange={(pageId, status) =>
                    void handlePageStatusChange(pageId, status)
                  }
                  onPreviewChanges={handlePreviewChanges}
                  onSaveChanges={() => void handleSaveChanges()}
                  onCreateGroup={() => setIsCreateGroupDialogOpen(true)}
                />
              </div>

              {/* Groups Content */}
              <div className="flex-1 overflow-auto p-6">
                <GroupsContent
                  selectedPage={selectedPage}
                  onCreateGroup={() => setIsCreateGroupDialogOpen(true)}
                  onEditGroup={(group) => openEditGroupDialog(group)}
                  onAddRatingToGroup={(
                    groupId,
                    groupName,
                    existingRatingIds
                  ) => {
                    openRatingDialog(groupId, groupName, existingRatingIds);
                  }}
                  onUpdateGroupRatingPositions={
                    handleUpdateGroupRatingPositions
                  }
                  onShortNameChange={(groupId, ratingId, shortName) =>
                    void handleShortNameChange(groupId, ratingId, shortName)
                  }
                  onRemoveRating={(groupId, ratingId) =>
                    void handleRemoveRating(groupId, ratingId)
                  }
                  onUpdateGroupDisplayType={(groupId, displayType) =>
                    void handleUpdateGroupDisplayType(groupId, displayType)
                  }
                />
              </div>
            </>
          ) : (
            // Empty state
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <FileText className="text-muted-foreground/50 mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-medium">Выберите страницу</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Выберите страницу рейтингов слева для начала редактирования
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateRatingsPageDialog
        open={isCreatePageDialogOpen}
        onClose={() => setIsCreatePageDialogOpen(false)}
        onCreatePage={handleCreatePage}
        isLoading={mutations.createPageMutation.isPending}
      />

      <EditRatingsPageDialog
        open={isEditPageDialogOpen}
        onClose={() => {
          setIsEditPageDialogOpen(false);
          setSelectedPageForEdit(null);
        }}
        onUpdatePage={handleUpdatePage}
        isLoading={mutations.updatePageMutation.isPending}
        page={selectedPageForEdit}
      />

      <CreateRatingsGroupDialog
        open={isCreateGroupDialogOpen}
        onClose={() => setIsCreateGroupDialogOpen(false)}
        onCreateGroup={handleCreateGroup}
        isLoading={
          mutations.createGroupMutation.isPending ||
          mutations.addGroupToPageMutation.isPending
        }
        selectedPageId={selectedPageId}
        pages={pages?.map((p) => ({ id: p.id, name: p.name })) || []}
      />

      <EditRatingsGroupDialog
        open={isEditGroupDialogOpen}
        onClose={() => {
          setIsEditGroupDialogOpen(false);
          setSelectedGroupForEdit(null);
        }}
        onUpdateGroup={handleUpdateGroup}
        isLoading={mutations.updateGroupMutation.isPending}
        group={selectedGroupForEdit}
      />

      {selectedGroupForRating && (
        <AddRatingToGroupDialog
          open={isAddRatingDialogOpen}
          onClose={() => {
            setIsAddRatingDialogOpen(false);
            setSelectedGroupForRating(null);
          }}
          onAddRatings={handleAddRatings}
          isLoading={mutations.addRatingToGroupMutation.isPending}
          groupId={selectedGroupForRating.id}
          groupName={selectedGroupForRating.name}
          existingRatingIds={selectedGroupForRating.existingRatingIds}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={mutations.deletePageMutation.isPending}
      />
    </Layout>
  );
};

export default RatingsPageDashboard;
