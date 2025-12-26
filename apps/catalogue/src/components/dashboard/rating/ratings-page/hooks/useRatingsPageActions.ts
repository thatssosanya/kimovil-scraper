import { useState } from "react";
import useRatingsPageStore from "@/src/stores/ratingsPageStore";
import { useRatingsPageMutations } from "./useRatingsPageMutations";

export const useRatingsPageActions = () => {
  const store = useRatingsPageStore();
  const mutations = useRatingsPageMutations();

  // Edit page dialog state
  const [selectedPageForEdit, setSelectedPageForEdit] = useState<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    iconName: string | null;
    status: string;
  } | null>(null);
  const [isEditPageDialogOpen, setIsEditPageDialogOpen] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  // Rating dialog state
  const [selectedGroupForRating, setSelectedGroupForRating] = useState<{
    id: string;
    name: string;
    existingRatingIds: string[];
  } | null>(null);
  const [isAddRatingDialogOpen, setIsAddRatingDialogOpen] = useState(false);

  // Edit group dialog state
  const [selectedGroupForEdit, setSelectedGroupForEdit] = useState<{
    id: string;
    name: string;
    displayName: string | null;
    description: string | null;
    displayType: string;
    type: string | null;
  } | null>(null);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);

  // Only complex actions that need multiple steps
  const openEditPageDialog = (page: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    iconName: string | null;
    status: string;
  }) => {
    setSelectedPageForEdit(page);
    setIsEditPageDialogOpen(true);
  };

  const confirmDeletePage = (
    _pageId: string,
    pageName: string,
    onDelete: () => void
  ) => {
    setConfirmDialog({
      open: true,
      title: "Удаление страницы",
      description: `Вы уверены, что хотите удалить страницу "${pageName}"? Это действие нельзя отменить.`,
      onConfirm: onDelete,
    });
  };

  const openRatingDialog = (
    groupId: string,
    groupName: string,
    existingRatingIds: string[]
  ) => {
    setSelectedGroupForRating({
      id: groupId,
      name: groupName,
      existingRatingIds,
    });
    setIsAddRatingDialogOpen(true);
  };

  const openEditGroupDialog = (group: {
    id: string;
    name: string;
    displayName: string | null;
    description: string | null;
    displayType: string;
    type: string | null;
  }) => {
    setSelectedGroupForEdit(group);
    setIsEditGroupDialogOpen(true);
  };

  return {
    // UI State
    confirmDialog,
    selectedGroupForRating,
    isAddRatingDialogOpen,
    selectedGroupForEdit,
    isEditGroupDialogOpen,
    selectedPageForEdit,
    isEditPageDialogOpen,

    // State setters
    setConfirmDialog,
    setSelectedGroupForRating,
    setIsAddRatingDialogOpen,
    setSelectedGroupForEdit,
    setIsEditGroupDialogOpen,
    setSelectedPageForEdit,
    setIsEditPageDialogOpen,

    // Complex actions only
    openEditPageDialog,
    confirmDeletePage,
    openRatingDialog,
    openEditGroupDialog,

    // Direct access to store and mutations for simple operations
    store,
    mutations,
  };
};
