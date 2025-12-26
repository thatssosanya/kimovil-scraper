import { create } from "zustand";
import {
  type RatingStore,
  type DevicePosition,
  type RatingWithDevices,
  type RatingChanges,
} from "../types/rating";

type Store = Omit<RatingStore, "saveChanges">;

const useRatingStore = create<Store>((set, get) => ({
  // State
  ratings: new Map<string, RatingWithDevices>(),
  pendingChanges: new Map<string, RatingChanges>(),
  isLoading: false,
  error: null,

  // Actions
  setIsLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setError: (error: Error | null) => {
    set({ error });
  },

  setRatings: (ratings: RatingWithDevices[]) => {
    set({ ratings: new Map(ratings.map((rating) => [rating.id, rating])) });
  },

  addDevice: (ratingId: string, deviceId: string) => {
    set((state) => {
      const rating = state.ratings.get(ratingId);
      if (!rating) return state;

      const currentChanges = state.pendingChanges.get(ratingId) || {};
      const effectivePositions = get().getEffectivePositions(ratingId);
      const nextPosition = effectivePositions.length + 1;

      const newPendingChanges: RatingChanges = {
        ...currentChanges,
        positions: {
          ...currentChanges.positions,
          [nextPosition]: deviceId,
        },
        additions: [...(currentChanges.additions ?? []), deviceId],
      };

      const newPendingChangesMap = new Map(state.pendingChanges);
      newPendingChangesMap.set(ratingId, newPendingChanges);

      return { pendingChanges: newPendingChangesMap };
    });
  },

  updateDevicePositions: (
    ratingId: string,
    updates: Record<number, string>
  ) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingChanges);
      const currentChanges = newPendingChanges.get(ratingId) || {};
      const rating = state.ratings.get(ratingId);

      if (!rating) return state;

      // Get original positions from the rating
      const originalPositions = new Map<string, number>();
      rating.devices.forEach((device) => {
        const position = device.ratingPositions.find(
          (pos) => pos.ratingId === ratingId
        )?.position;
        if (position) {
          originalPositions.set(device.id, position);
        }
      });

      // Create new positions object that includes only changed positions
      const newPositions: Record<number, string> = {};

      // Apply the updates, but only keep positions that differ from original
      Object.entries(updates).forEach(([pos, deviceId]) => {
        const originalPos = originalPositions.get(deviceId);
        const newPos = parseInt(pos);

        // Only include position if it's different from original
        if (originalPos !== newPos) {
          newPositions[newPos] = deviceId;
        }
      });

      // If there are no position changes and no other changes, remove the rating from pendingChanges
      if (
        Object.keys(newPositions).length === 0 &&
        !currentChanges.name &&
        !currentChanges.replacements?.length &&
        !currentChanges.deletions?.length &&
        !currentChanges.additions?.length
      ) {
        newPendingChanges.delete(ratingId);
        return { pendingChanges: newPendingChanges };
      }

      newPendingChanges.set(ratingId, {
        ...currentChanges,
        positions:
          Object.keys(newPositions).length > 0 ? newPositions : undefined,
      });

      return { pendingChanges: newPendingChanges };
    });
  },

  replaceDevice: (
    ratingId: string,
    oldDeviceId: string,
    newDeviceId: string
  ) => {
    set((state) => {
      const rating = state.ratings.get(ratingId);
      if (!rating) return state;

      const oldDevice = rating.devices.find((d) => d.id === oldDeviceId);
      if (!oldDevice) return state;

      const oldDevicePosition = oldDevice.ratingPositions.find(
        (pos) => pos.ratingId === ratingId
      )?.position;

      if (!oldDevicePosition) return state;

      const currentChanges = state.pendingChanges.get(ratingId) || {};

      // Create a new positions object without the old device
      const newPositions: Record<number, string> = {};

      // Copy existing position changes, excluding the old device
      if (currentChanges.positions) {
        Object.entries(currentChanges.positions).forEach(([pos, deviceId]) => {
          if (deviceId !== oldDeviceId) {
            newPositions[parseInt(pos)] = deviceId;
          }
        });
      }

      // Add the new device at the old device's position
      newPositions[oldDevicePosition] = newDeviceId;

      const newPendingChanges: RatingChanges = {
        ...currentChanges,
        positions: newPositions,
        replacements: [
          ...(currentChanges.replacements || []),
          {
            oldDeviceId,
            newDeviceId,
            position: oldDevicePosition,
          },
        ],
      };

      // Remove any existing additions for the old device
      if (newPendingChanges.additions) {
        newPendingChanges.additions = newPendingChanges.additions.filter(
          (id) => id !== oldDeviceId
        );
      }

      // Add to deletions if not already there
      if (!newPendingChanges.deletions?.includes(oldDeviceId)) {
        newPendingChanges.deletions = [
          ...(newPendingChanges.deletions || []),
          oldDeviceId,
        ];
      }

      const newPendingChangesMap = new Map(state.pendingChanges);
      newPendingChangesMap.set(ratingId, newPendingChanges);

      return { pendingChanges: newPendingChangesMap };
    });
  },

  deleteDevice: (ratingId: string, deviceId: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingChanges);
      const currentChanges = newPendingChanges.get(ratingId) || {};
      const rating = state.ratings.get(ratingId);

      if (!rating) return state;

      // Get effective positions considering all pending changes
      const effectivePositions = get().getEffectivePositions(ratingId);

      // Create a map of deviceId -> position from effective positions
      const positions = new Map<string, number>();
      effectivePositions.forEach((pos) => {
        positions.set(pos.deviceId, pos.position);
      });

      // Remove the device being deleted
      positions.delete(deviceId);

      // Rest of the function remains the same...
      const updatedPositions: Record<number, string> = {};
      Array.from(positions.entries())
        .sort(([, a], [, b]) => a - b)
        .forEach(([id], index) => {
          updatedPositions[index + 1] = id;
        });

      newPendingChanges.set(ratingId, {
        ...currentChanges,
        positions: updatedPositions,
        deletions: [...(currentChanges.deletions || []), deviceId],
      });

      return { pendingChanges: newPendingChanges };
    });
  },

  updateRatingName: (ratingId: string, name: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingChanges);
      const currentChanges = newPendingChanges.get(ratingId) || {};

      newPendingChanges.set(ratingId, {
        ...currentChanges,
        name,
      });

      return { pendingChanges: newPendingChanges };
    });
  },

  revertChanges: (ratingId: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingChanges);
      newPendingChanges.delete(ratingId);
      return { pendingChanges: newPendingChanges };
    });
  },

  // Selectors
  getPendingChangesForRating: (ratingId: string) => {
    return get().pendingChanges.get(ratingId) || null;
  },

  getEffectivePositions: (ratingId: string) => {
    const state = get();
    const rating = state.ratings.get(ratingId);
    const changes = state.pendingChanges.get(ratingId);

    if (!rating) return [];

    const positions = new Map<string, DevicePosition>();

    // First, handle replacements to ensure they take precedence
    if (changes?.replacements) {
      changes.replacements.forEach(({ oldDeviceId, newDeviceId, position }) => {
        positions.set(newDeviceId, {
          deviceId: newDeviceId,
          position,
          isOriginal: false,
          replacedDevice:
            rating.devices.find((d) => d.id === oldDeviceId) || undefined,
        });
      });
    }

    // Then get original positions for devices that haven't been replaced
    rating.devices.forEach((device) => {
      const originalPosition = device.ratingPositions.find(
        (pos) => pos.ratingId === ratingId
      );
      // Only add if device hasn't been replaced or deleted
      if (
        originalPosition?.position &&
        !changes?.replacements?.some((r) => r.oldDeviceId === device.id) &&
        !changes?.deletions?.includes(device.id)
      ) {
        positions.set(device.id, {
          deviceId: device.id,
          position: originalPosition.position,
          isOriginal: true,
          updatedAt: originalPosition.updatedAt,
        });
      }
    });

    // Then apply any position changes
    if (changes?.positions) {
      Object.entries(changes.positions).forEach(([pos, deviceId]) => {
        const position = parseInt(pos);
        const device = rating.devices.find((d) => d.id === deviceId);
        const isAddition = changes.additions?.includes(deviceId) ?? false;
        const originalPosition = device?.ratingPositions.find(
          (p) => p.ratingId === ratingId
        )?.position;
        const hasPositionChanged = originalPosition !== position;
        const isReplacement = changes.replacements?.some(
          (r) => r.newDeviceId === deviceId
        );

        positions.set(deviceId, {
          deviceId,
          position,
          isOriginal: !hasPositionChanged && !isAddition && !isReplacement,
          isAddition,
          replacedDevice: isReplacement
            ? rating.devices.find(
                (d) =>
                  d.id ===
                  changes.replacements?.find((r) => r.newDeviceId === deviceId)
                    ?.oldDeviceId
              ) || undefined
            : undefined,
        });
      });
    }

    // Remove any deleted devices
    if (changes?.deletions) {
      changes.deletions.forEach((deviceId) => {
        positions.delete(deviceId);
      });
    }

    return Array.from(positions.values()).sort(
      (a, b) => a.position - b.position
    );
  },

  arePositionsValid: (ratingId: string) => {
    const positions = get().getEffectivePositions(ratingId);
    const positionValues = positions
      .map((p) => p.position)
      .sort((a, b) => a - b);

    if (positionValues.length < 5) return true;

    // Check if positions are sequential starting from 1
    for (let i = 0; i < positionValues.length; i++) {
      if (positionValues[i] !== i + 1) {
        return false;
      }
    }

    return true;
  },
}));

export default useRatingStore;
