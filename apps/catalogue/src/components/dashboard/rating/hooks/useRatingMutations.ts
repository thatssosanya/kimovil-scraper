import { api } from "@/src/utils/api";
import useRatingStore from "@/src/stores/ratingStore";
import { toast } from "sonner";

export const useRatingMutations = () => {
  const store = useRatingStore();
  const utils = api.useUtils();

  const { mutateAsync: updateRatingDevices } =
    api.rating.updateRatingDevices.useMutation({
      onMutate: async ({ ratingId: _ratingId }) => {
        // Cancel outgoing fetches (so they don't overwrite our optimistic update)
        await utils.rating.getAllRatings.cancel();

        // Get the current data
        const previousRatings = utils.rating.getAllRatings.getData();

        return { previousRatings };
      },
      onSuccess: () => {
        void utils.rating.getAllRatings.invalidate();
      },
      onError: (_err, _variables, context) => {
        // If the mutation fails, use the context we returned above
        if (context?.previousRatings) {
          store.setRatings(context.previousRatings);
        }
        toast.error("Ошибка при обновлении позиций");
      },
    });

  const { mutateAsync: updateRatingName } =
    api.rating.updateRatingName.useMutation({
      onMutate: async ({ id: _ratingId }) => {
        await utils.rating.getAllRatings.cancel();
        const previousRatings = utils.rating.getAllRatings.getData();
        return { previousRatings };
      },
      onSuccess: () => {
        void utils.rating.getAllRatings.invalidate();
      },
      onError: (_err, _variables, context) => {
        if (context?.previousRatings) {
          store.setRatings(context.previousRatings);
        }
        toast.error("Ошибка при обновлении названия");
      },
    });

  const saveChanges = async (ratingId: string) => {
    const changes = store.getPendingChangesForRating(ratingId);
    if (!changes) return;

    store.setIsLoading(true);
    store.setError(null);

    try {
      // Get the complete effective positions for the rating
      const effectivePositions = store.getEffectivePositions(ratingId);
      const positionsUpdate = Object.fromEntries(
        effectivePositions.map((pos) => [pos.position, pos.deviceId])
      );

      // Only send update if there are positions to update
      if (Object.keys(positionsUpdate).length > 0) {
        await updateRatingDevices({
          ratingId,
          devices: positionsUpdate,
        }).catch((error) => {
          store.setError(error as Error);
          store.setIsLoading(false); // Reset loading state on individual mutation failure
          toast.error(
            error instanceof Error
              ? error.message
              : "Ошибка при обновлении позиций"
          );
          throw error;
        });
      }

      if (changes.name) {
        await updateRatingName({
          id: ratingId,
          name: changes.name,
        }).catch((error) => {
          store.setError(error as Error);
          store.setIsLoading(false); // Reset loading state on individual mutation failure
          toast.error(
            error instanceof Error
              ? error.message
              : "Ошибка при обновлении названия"
          );
          throw error;
        });
      }

      // After successful save, remove the pending changes
      store.revertChanges(ratingId);
      toast.success("Изменения сохранены");
    } catch (error) {
      store.setError(error as Error);
      store.setIsLoading(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Ошибка при сохранении изменений"
      );
      throw error; // Re-throw to handle in the component
    } finally {
      store.setIsLoading(false); // Ensure loading state is always reset
    }
  };

  return {
    saveChanges,
  };
};
