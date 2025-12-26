import { api } from "@/src/utils/api";

export const useRatingsPageMutations = () => {
  const utils = api.useUtils();

  const invalidatePages = () => {
    void utils.ratingsPage.getAllPagesAdmin.invalidate();
  };

  // Page mutations
  const createPageMutation = api.ratingsPage.createPage.useMutation({
    onSuccess: invalidatePages,
  });

  const updatePageMutation = api.ratingsPage.updatePage.useMutation({
    onSuccess: invalidatePages,
  });

  const deletePageMutation = api.ratingsPage.deletePage.useMutation({
    onSuccess: invalidatePages,
  });

  const updatePageStatusMutation = api.ratingsPage.updatePageStatus.useMutation(
    {
      onSuccess: invalidatePages,
    }
  );

  // Group mutations
  const createGroupMutation = api.ratingsPage.createGroup.useMutation({
    onSuccess: invalidatePages,
  });

  const updateGroupMutation = api.ratingsPage.updateGroup.useMutation({
    onSuccess: invalidatePages,
  });

  const addGroupToPageMutation = api.ratingsPage.addGroupToPage.useMutation({
    onSuccess: invalidatePages,
  });

  // Rating mutations
  const addRatingToGroupMutation = api.ratingsPage.addRatingToGroup.useMutation(
    {
      onSuccess: invalidatePages,
    }
  );

  const updateRatingPositionsMutation =
    api.ratingsPage.updateRatingPositions.useMutation({
      onSuccess: invalidatePages,
    });

  const updateRatingShortNameMutation =
    api.ratingsPage.updateRatingShortName.useMutation({
      onSuccess: invalidatePages,
    });

  const removeRatingFromGroupMutation =
    api.ratingsPage.removeRatingFromGroup.useMutation({
      onSuccess: invalidatePages,
    });

  const updateGroupPositionsMutation =
    api.ratingsPage.updateGroupPositions.useMutation({
      onSuccess: invalidatePages,
    });

  const updatePagePositionsMutation =
    api.ratingsPage.updatePagePositions.useMutation({
      onSuccess: invalidatePages,
    });

  return {
    createPageMutation,
    updatePageMutation,
    deletePageMutation,
    updatePageStatusMutation,
    createGroupMutation,
    updateGroupMutation,
    addGroupToPageMutation,
    addRatingToGroupMutation,
    updateRatingPositionsMutation,
    updateRatingShortNameMutation,
    removeRatingFromGroupMutation,
    updateGroupPositionsMutation,
    updatePagePositionsMutation,
  };
};
