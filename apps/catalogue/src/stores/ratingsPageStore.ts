import { create } from "zustand";
import {
  type RatingsPageStore,
  type RatingsPageWithGroups,
  type RatingsPageChanges,
  type RatingsGroupChanges,
  type RatingsPagePositionData,
  type RatingsGroupPositionData,
} from "../types/ratingsPage";

type Store = RatingsPageStore & {
  saveChanges: (callbacks: SaveChangesCallbacks) => Promise<void>;
  previewChanges: () => {
    pageChanges: [string, RatingsPageChanges][];
    groupChanges: [string, RatingsGroupChanges][];
  };
  getNextGroupPositionForPage: (pageId: string) => number;
  getNextRatingPositionForGroup: (groupId: string) => number;
  // Page ordering
  pendingPageOrder: Record<number, string> | null;
  updatePageOrder: (newOrder: Record<number, string>) => void;
  revertPageOrder: () => void;
  getEffectivePageOrder: () => RatingsPageWithGroups[];
};

// Add interface for save changes callback
export interface SaveChangesCallbacks {
  updateRatingPositions: (input: {
    groupId: string;
    positions: Array<{
      ratingId: string;
      position: number;
      shortName?: string;
    }>;
  }) => Promise<unknown>;
  updateGroupPositions: (input: {
    pageId: string;
    positions: Array<{ groupId: string; position: number }>;
  }) => Promise<unknown>;
  updatePagePositions: (input: {
    positions: Array<{ pageId: string; position: number }>;
  }) => Promise<unknown>;
}

const useRatingsPageStore = create<Store>((set, get) => ({
  // State
  pages: new Map<string, RatingsPageWithGroups>(),
  pendingPageChanges: new Map<string, RatingsPageChanges>(),
  pendingGroupChanges: new Map<string, RatingsGroupChanges>(),
  pendingPageOrder: null,
  isLoading: false,
  error: null,

  // Actions
  setIsLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setError: (error: Error | null) => {
    set({ error });
  },

  setPages: (pages: RatingsPageWithGroups[]) => {
    set({ pages: new Map(pages.map((page) => [page.id, page])) });
  },

  // Page actions
  addGroupToPage: (pageId: string, groupId: string) => {
    set((state) => {
      const page = state.pages.get(pageId);
      if (!page) return state;

      const currentChanges = state.pendingPageChanges.get(pageId) || {};
      const effectivePositions = get().getEffectivePagePositions(pageId);
      const nextPosition = effectivePositions.length + 1;

      const newPendingChanges: RatingsPageChanges = {
        ...currentChanges,
        positions: {
          ...currentChanges.positions,
          [nextPosition]: groupId,
        },
        additions: [...(currentChanges.additions ?? []), groupId],
      };

      const newPendingChangesMap = new Map(state.pendingPageChanges);
      newPendingChangesMap.set(pageId, newPendingChanges);

      return { pendingPageChanges: newPendingChangesMap };
    });
  },

  updatePageGroupPositions: (
    pageId: string,
    updates: Record<number, string>
  ) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingPageChanges);
      const currentChanges = newPendingChanges.get(pageId) || {};
      const page = state.pages.get(pageId);

      if (!page) return state;

      // Get original positions from the page
      const originalPositions = new Map<string, number>();
      page.groups.forEach((groupPos) => {
        originalPositions.set(groupPos.groupId, groupPos.position);
      });

      // Create new positions object that includes only changed positions
      const newPositions: Record<number, string> = {};

      // Apply the updates - include ALL positions to ensure proper offset handling
      Object.entries(updates).forEach(([pos, groupId]) => {
        const newPos = parseInt(pos);
        newPositions[newPos] = groupId;
      });

      // Check if positions actually changed from original
      const hasPositionChanges = Object.entries(newPositions).some(
        ([pos, groupId]) => {
          const originalPos = originalPositions.get(groupId);
          return originalPos !== parseInt(pos);
        }
      );

      // If there are no actual position changes and no other changes, remove the page from pendingChanges
      if (
        !hasPositionChanges &&
        !currentChanges.name &&
        !currentChanges.replacements?.length &&
        !currentChanges.deletions?.length &&
        !currentChanges.additions?.length
      ) {
        newPendingChanges.delete(pageId);
        return { pendingPageChanges: newPendingChanges };
      }

      newPendingChanges.set(pageId, {
        ...currentChanges,
        positions: hasPositionChanges ? newPositions : undefined,
      });

      return { pendingPageChanges: newPendingChanges };
    });
  },

  deleteGroupFromPage: (pageId: string, groupId: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingPageChanges);
      const currentChanges = newPendingChanges.get(pageId) || {};
      const page = state.pages.get(pageId);

      if (!page) return state;

      // Get effective positions considering all pending changes
      const effectivePositions = get().getEffectivePagePositions(pageId);

      // Create a map of groupId -> position from effective positions
      const positions = new Map<string, number>();
      effectivePositions.forEach((pos) => {
        positions.set(pos.groupId, pos.position);
      });

      // Remove the group being deleted
      positions.delete(groupId);

      // Reorder positions to be sequential
      const updatedPositions: Record<number, string> = {};
      Array.from(positions.entries())
        .sort(([, a], [, b]) => a - b)
        .forEach(([id], index) => {
          updatedPositions[index + 1] = id;
        });

      newPendingChanges.set(pageId, {
        ...currentChanges,
        positions: updatedPositions,
        deletions: [...(currentChanges.deletions || []), groupId],
      });

      return { pendingPageChanges: newPendingChanges };
    });
  },

  updatePageName: (pageId: string, name: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingPageChanges);
      const currentChanges = newPendingChanges.get(pageId) || {};

      newPendingChanges.set(pageId, {
        ...currentChanges,
        name,
      });

      return { pendingPageChanges: newPendingChanges };
    });
  },

  revertPageChanges: (pageId: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingPageChanges);
      newPendingChanges.delete(pageId);
      return { pendingPageChanges: newPendingChanges };
    });
  },

  // Group actions
  addRatingToGroup: (groupId: string, ratingId: string) => {
    set((state) => {
      // Find group from pages data
      let group = null;
      for (const page of state.pages.values()) {
        const groupPos = page.groups.find((g) => g.group.id === groupId);
        if (groupPos) {
          group = groupPos.group;
          break;
        }
      }
      if (!group) return state;

      const currentChanges = state.pendingGroupChanges.get(groupId) || {};
      const effectivePositions = get().getEffectiveGroupPositions(groupId);
      const nextPosition = effectivePositions.length + 1;

      const newPendingChanges: RatingsGroupChanges = {
        ...currentChanges,
        positions: {
          ...currentChanges.positions,
          [nextPosition]: ratingId,
        },
        additions: [...(currentChanges.additions ?? []), ratingId],
      };

      const newPendingChangesMap = new Map(state.pendingGroupChanges);
      newPendingChangesMap.set(groupId, newPendingChanges);

      return { pendingGroupChanges: newPendingChangesMap };
    });
  },

  updateGroupRatingPositions: (
    groupId: string,
    updates: Record<number, string>
  ) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingGroupChanges);
      const currentChanges = newPendingChanges.get(groupId) || {};

      // Find group from pages data
      let group = null;
      for (const page of state.pages.values()) {
        const groupPos = page.groups.find((g) => g.group.id === groupId);
        if (groupPos) {
          group = groupPos.group;
          break;
        }
      }

      if (!group) return state;

      // Get original positions from the group
      const originalPositions = new Map<string, number>();
      group.ratings.forEach((ratingPos) => {
        originalPositions.set(ratingPos.ratingId, ratingPos.position);
      });

      // Create new positions object that includes only changed positions
      const newPositions: Record<number, string> = {};

      // Apply the updates - include ALL positions to ensure proper offset handling
      Object.entries(updates).forEach(([pos, ratingId]) => {
        const newPos = parseInt(pos);
        newPositions[newPos] = ratingId;
      });

      // Check if positions actually changed from original
      const hasPositionChanges = Object.entries(newPositions).some(
        ([pos, ratingId]) => {
          const originalPos = originalPositions.get(ratingId);
          return originalPos !== parseInt(pos);
        }
      );

      // If there are no actual position changes and no other changes, remove the group from pendingChanges
      if (
        !hasPositionChanges &&
        !currentChanges.name &&
        !currentChanges.replacements?.length &&
        !currentChanges.deletions?.length &&
        !currentChanges.additions?.length
      ) {
        newPendingChanges.delete(groupId);
        return { pendingGroupChanges: newPendingChanges };
      }

      newPendingChanges.set(groupId, {
        ...currentChanges,
        positions: hasPositionChanges ? newPositions : undefined,
      });

      return { pendingGroupChanges: newPendingChanges };
    });
  },

  deleteRatingFromGroup: (groupId: string, ratingId: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingGroupChanges);
      const currentChanges = newPendingChanges.get(groupId) || {};

      // Find group from pages data
      let group = null;
      for (const page of state.pages.values()) {
        const groupPos = page.groups.find((g) => g.group.id === groupId);
        if (groupPos) {
          group = groupPos.group;
          break;
        }
      }

      if (!group) return state;

      // Get effective positions considering all pending changes
      const effectivePositions = get().getEffectiveGroupPositions(groupId);

      // Create a map of ratingId -> position from effective positions
      const positions = new Map<string, number>();
      effectivePositions.forEach((pos) => {
        positions.set(pos.ratingId, pos.position);
      });

      // Remove the rating being deleted
      positions.delete(ratingId);

      // Reorder positions to be sequential
      const updatedPositions: Record<number, string> = {};
      Array.from(positions.entries())
        .sort(([, a], [, b]) => a - b)
        .forEach(([id], index) => {
          updatedPositions[index + 1] = id;
        });

      newPendingChanges.set(groupId, {
        ...currentChanges,
        positions: updatedPositions,
        deletions: [...(currentChanges.deletions || []), ratingId],
      });

      return { pendingGroupChanges: newPendingChanges };
    });
  },

  updateGroupName: (groupId: string, name: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingGroupChanges);
      const currentChanges = newPendingChanges.get(groupId) || {};

      newPendingChanges.set(groupId, {
        ...currentChanges,
        name,
      });

      return { pendingGroupChanges: newPendingChanges };
    });
  },

  revertGroupChanges: (groupId: string) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingGroupChanges);
      newPendingChanges.delete(groupId);
      return { pendingGroupChanges: newPendingChanges };
    });
  },

  // Selectors
  getPendingPageChanges: (pageId: string) => {
    return get().pendingPageChanges.get(pageId) || null;
  },

  getPendingGroupChanges: (groupId: string) => {
    return get().pendingGroupChanges.get(groupId) || null;
  },

  getEffectivePagePositions: (pageId: string) => {
    const state = get();
    const page = state.pages.get(pageId);
    const changes = state.pendingPageChanges.get(pageId);

    if (!page) return [];

    const positions = new Map<string, RatingsPagePositionData>();

    // Get original positions
    page.groups.forEach((groupPos) => {
      if (!changes?.deletions?.includes(groupPos.groupId)) {
        positions.set(groupPos.groupId, {
          groupId: groupPos.groupId,
          position: groupPos.position,
          isOriginal: true,
        });
      }
    });

    // Apply position changes
    if (changes?.positions) {
      Object.entries(changes.positions).forEach(([pos, groupId]) => {
        const position = parseInt(pos);
        const isAddition = changes.additions?.includes(groupId) ?? false;
        const originalPosition = page.groups.find(
          (g) => g.groupId === groupId
        )?.position;
        const hasPositionChanged = originalPosition !== position;

        positions.set(groupId, {
          groupId,
          position,
          isOriginal: !hasPositionChanged && !isAddition,
          isAddition,
        });
      });
    }

    return Array.from(positions.values()).sort(
      (a, b) => a.position - b.position
    );
  },

  getEffectiveGroupPositions: (groupId: string) => {
    const state = get();
    const changes = state.pendingGroupChanges.get(groupId);

    // Find group from pages data
    let group = null;
    for (const page of state.pages.values()) {
      const groupPos = page.groups.find((g) => g.group.id === groupId);
      if (groupPos) {
        group = groupPos.group;
        break;
      }
    }

    if (!group) return [];

    const positions = new Map<string, RatingsGroupPositionData>();

    // Get original positions
    group.ratings.forEach((ratingPos) => {
      if (!changes?.deletions?.includes(ratingPos.ratingId)) {
        positions.set(ratingPos.ratingId, {
          ratingId: ratingPos.ratingId,
          position: ratingPos.position,
          isOriginal: true,
        });
      }
    });

    // Apply position changes
    if (changes?.positions) {
      Object.entries(changes.positions).forEach(([pos, ratingId]) => {
        const position = parseInt(pos);
        const isAddition = changes.additions?.includes(ratingId) ?? false;
        const originalPosition = group.ratings.find(
          (r) => r.ratingId === ratingId
        )?.position;
        const hasPositionChanged = originalPosition !== position;

        positions.set(ratingId, {
          ratingId: ratingId,
          position,
          isOriginal: !hasPositionChanged && !isAddition,
          isAddition,
        });
      });
    }

    return Array.from(positions.values()).sort(
      (a, b) => a.position - b.position
    );
  },

  arePagePositionsValid: (pageId: string) => {
    const positions = get().getEffectivePagePositions(pageId);
    const positionValues = positions
      .map((p) => p.position)
      .sort((a, b) => a - b);

    if (positionValues.length === 0) return true;

    // Check if positions are sequential starting from 1
    for (let i = 0; i < positionValues.length; i++) {
      if (positionValues[i] !== i + 1) {
        return false;
      }
    }

    return true;
  },

  areGroupPositionsValid: (groupId: string) => {
    const positions = get().getEffectiveGroupPositions(groupId);
    const positionValues = positions
      .map((p) => p.position)
      .sort((a, b) => a - b);

    if (positionValues.length === 0) return true;

    // Check if positions are sequential starting from 1
    for (let i = 0; i < positionValues.length; i++) {
      if (positionValues[i] !== i + 1) {
        return false;
      }
    }

    return true;
  },

  // Add saveChanges method
  saveChanges: async (callbacks: SaveChangesCallbacks) => {
    try {
      set({ isLoading: true });

      // Save page order changes first
      const state = get();
      if (state.pendingPageOrder) {
        const positions = Object.entries(state.pendingPageOrder).map(
          ([pos, pageId]) => ({
            pageId,
            position: parseInt(pos),
          })
        );

        await callbacks.updatePagePositions({ positions });
      }

      // Save group rating position changes
      for (const [groupId, changes] of get().pendingGroupChanges.entries()) {
        if (changes.positions) {
          const positions = Object.entries(changes.positions).map(
            ([pos, ratingId]) => ({
              ratingId,
              position: parseInt(pos),
            })
          );

          await callbacks.updateRatingPositions({ groupId, positions });
        }
      }

      // Save page group position changes
      for (const [pageId, changes] of get().pendingPageChanges.entries()) {
        if (changes.positions) {
          const positions = Object.entries(changes.positions).map(
            ([pos, groupId]) => ({
              groupId,
              position: parseInt(pos),
            })
          );

          await callbacks.updateGroupPositions({ pageId, positions });
        }
      }

      // Clear pending changes after successful save
      set((state) => {
        state.pendingPageChanges.clear();
        state.pendingGroupChanges.clear();
        return {
          pendingPageChanges: new Map(),
          pendingGroupChanges: new Map(),
          pendingPageOrder: null,
        };
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // Add preview method
  previewChanges: () => {
    const state = get();
    return {
      pageChanges: Array.from(state.pendingPageChanges.entries()),
      groupChanges: Array.from(state.pendingGroupChanges.entries()),
    };
  },

  // Add helper for calculating next position
  getNextGroupPositionForPage: (pageId: string) => {
    const positions = get().getEffectivePagePositions(pageId);
    return positions.length + 1;
  },

  getNextRatingPositionForGroup: (groupId: string) => {
    const positions = get().getEffectiveGroupPositions(groupId);
    return positions.length + 1;
  },

  // Page ordering methods
  updatePageOrder: (newOrder: Record<number, string>) => {
    set({ pendingPageOrder: newOrder });
  },

  revertPageOrder: () => {
    set({ pendingPageOrder: null });
  },

  getEffectivePageOrder: () => {
    const state = get();
    const pagesArray = Array.from(state.pages.values());

    if (!state.pendingPageOrder) {
      // Return pages in their current order (by position, then createdAt)
      return pagesArray.sort((a, b) => {
        if (
          a.position !== null &&
          a.position !== undefined &&
          b.position !== null &&
          b.position !== undefined
        ) {
          return a.position - b.position;
        }
        if (a.position !== null && a.position !== undefined) return -1;
        if (b.position !== null && b.position !== undefined) return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }

    // Apply pending order
    const orderedPages: RatingsPageWithGroups[] = [];
    const pageMap = new Map(pagesArray.map((p) => [p.id, p]));

    // Add pages in the pending order
    Object.entries(state.pendingPageOrder)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([, pageId]) => {
        const page = pageMap.get(pageId);
        if (page) {
          orderedPages.push(page);
          pageMap.delete(pageId);
        }
      });

    // Add any remaining pages (shouldn't happen in normal operation)
    orderedPages.push(...Array.from(pageMap.values()));

    return orderedPages;
  },
}));

export default useRatingsPageStore;
