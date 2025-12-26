import { useEffect } from "react";
import type { ReactNode } from "react";
import useHeaderStore from "@/src/stores/headerStore";

interface UseHeaderActionsOptions {
  title?: string;
  leftActions?: ReactNode[];
  rightActions?: ReactNode[];
}

export function useHeaderActions({
  title = "",
  leftActions = [],
  rightActions = [],
}: UseHeaderActionsOptions) {
  const setTitle = useHeaderStore((state) => state.setTitle);
  const setLeftActions = useHeaderStore((state) => state.setLeftActions);
  const setRightActions = useHeaderStore((state) => state.setRightActions);
  const reset = useHeaderStore((state) => state.reset);

  useEffect(() => {
    // Set header state
    setTitle(title);
    setLeftActions(leftActions);
    setRightActions(rightActions);
  }, [title, leftActions, rightActions, setTitle, setLeftActions, setRightActions]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);
}