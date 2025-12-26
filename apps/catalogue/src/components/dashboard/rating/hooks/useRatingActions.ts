import { api } from "@/src/utils/api";
import { toast } from "sonner";
import useRatingStore from "@/src/stores/ratingStore";
import { useRatingMutations } from "./useRatingMutations";

interface CreateRatingData {
  name: string;
  ratingTypeId: string;
}

export const useRatingActions = () => {
  const store = useRatingStore();
  const utils = api.useUtils();
  const { saveChanges } = useRatingMutations();

  const deleteRatingMutation = api.rating.deleteRating.useMutation({
    onSuccess: () => {
      void utils.rating.getAllRatings.invalidate();
      toast.success("Рейтинг успешно удален");
    },
    onError: (error) => {
      toast.error("Не удалось удалить рейтинг");
      console.error("Failed to delete rating:", error);
    },
  });

  const createRatingMutation = api.rating.createRating.useMutation({
    onSuccess: () => {
      void utils.rating.getAllRatings.invalidate();
      toast.success("Рейтинг успешно создан");
    },
    onError: (error) => {
      toast.error("Не удалось создать рейтинг");
      console.error("Failed to create rating:", error);
    },
  });

  const handleDeleteRating = (ratingId: string) => {
    deleteRatingMutation.mutate({ id: ratingId });
  };

  const handleCreateRating = async (data: CreateRatingData) => {
    await createRatingMutation.mutateAsync(data);
  };

  const handleSaveChanges = async () => {
    try {
      // Save all ratings with pending changes
      const promises = Array.from(store.pendingChanges.keys()).map((ratingId) =>
        saveChanges(ratingId)
      );
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error(
        "Error saving changes:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  };

  return {
    handleDeleteRating,
    handleSaveChanges,
    handleCreateRating,
    isDeleting: deleteRatingMutation.isPending,
    isCreating: createRatingMutation.isPending,
    hasPendingChanges: store.pendingChanges.size > 0,
  };
};
