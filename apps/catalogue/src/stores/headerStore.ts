import { create } from "zustand";
import type { ReactNode } from "react";

interface HeaderState {
  title: string;
  leftActions: ReactNode[];
  rightActions: ReactNode[];
  
  // Actions
  setTitle: (title: string) => void;
  setLeftActions: (actions: ReactNode[]) => void;
  setRightActions: (actions: ReactNode[]) => void;
  clearActions: () => void;
  reset: () => void;
}

const useHeaderStore = create<HeaderState>((set) => ({
  // Initial state
  title: "",
  leftActions: [],
  rightActions: [],
  
  // Actions
  setTitle: (title) => set({ title }),
  
  setLeftActions: (actions) => set({ leftActions: actions }),
  
  setRightActions: (actions) => set({ rightActions: actions }),
  
  clearActions: () => set({ leftActions: [], rightActions: [] }),
  
  reset: () => set({ 
    title: "",
    leftActions: [],
    rightActions: []
  }),
}));

export default useHeaderStore;