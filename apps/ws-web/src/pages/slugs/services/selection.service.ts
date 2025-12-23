import { createStore, produce } from "solid-js/store";
import { createSignal } from "solid-js";

export interface SelectionState {
  selected: Record<string, boolean>;
}

export function createSelectionService() {
  const [state, setState] = createStore<SelectionState>({ selected: {} });
  const [lastIndex, setLastIndex] = createSignal<number | null>(null);

  const isSelected = (slug: string): boolean => {
    return state.selected[slug] === true;
  };

  const selectedCount = (): number => {
    return Object.values(state.selected).filter(Boolean).length;
  };

  const selectedSlugs = (): string[] => {
    return Object.entries(state.selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
  };

  const clearSelection = () => {
    setState(produce((s) => {
      s.selected = {};
    }));
    setLastIndex(null);
  };

  const selectSingle = (slug: string) => {
    setState("selected", { [slug]: true });
  };

  const toggleSingle = (slug: string) => {
    setState(
      produce((s) => {
        if (s.selected[slug]) {
          delete s.selected[slug];
        } else {
          s.selected[slug] = true;
        }
      }),
    );
  };

  const selectRange = (slugs: string[], fromIndex: number, toIndex: number) => {
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const slugsInRange = slugs.slice(start, end + 1);

    setState(
      produce((s) => {
        for (const slug of slugsInRange) {
          s.selected[slug] = true;
        }
      }),
    );
  };

  const handleRowClick = (
    slug: string,
    index: number,
    event: MouseEvent,
    allSlugs: string[],
  ) => {
    const isMetaKey = event.metaKey || event.ctrlKey;
    const isShiftKey = event.shiftKey;

    if (isShiftKey && lastIndex() !== null) {
      selectRange(allSlugs, lastIndex()!, index);
    } else if (isMetaKey) {
      toggleSingle(slug);
    } else {
      clearSelection();
      selectSingle(slug);
    }

    setLastIndex(index);
  };

  const toggleAll = (allSlugs: string[]) => {
    const currentCount = selectedCount();
    const totalCount = allSlugs.length;

    if (currentCount === totalCount && totalCount > 0) {
      clearSelection();
    } else {
      setState(
        produce((s) => {
          s.selected = {};
          for (const slug of allSlugs) {
            s.selected[slug] = true;
          }
        }),
      );
    }
    setLastIndex(null);
  };

  const setSelection = (slugs: string[]) => {
    setState(
      produce((s) => {
        s.selected = {};
        for (const slug of slugs) {
          s.selected[slug] = true;
        }
      }),
    );
  };

  return {
    state,
    isSelected,
    selectedCount,
    selectedSlugs,
    clearSelection,
    toggleSingle,
    handleRowClick,
    toggleAll,
    setSelection,
    lastIndex,
  };
}

export type SelectionService = ReturnType<typeof createSelectionService>;
