import { create } from "zustand";
import { type ScrapeJob } from "@/src/types/scraper";
import type { Device } from "@/src/server/db/schema";

type ScraperState = {
  scrapeJobs: ScrapeJob[];
  queryStatus: "idle" | "pending" | "error" | "success";
  selectedDevice?: Device;
  refetch?: () => unknown;
  processingDevices: Set<string>;
  visibleJobDevices: Set<string>;
  setScrapeJobs: (jobs: ScrapeJob[]) => void;
  setQueryStatus: (status: ScraperState["queryStatus"]) => void;
  setSelectedDevice: (selectedDevice?: Device) => void;
  setRefetch: (refetch: ScraperState["refetch"]) => void;
  addProcessingDevice: (deviceId: string) => void;
  removeProcessingDevice: (deviceId: string) => void;
  registerVisibleJob: (deviceId: string) => void;
  unregisterVisibleJob: (deviceId: string) => void;
};

export const useScraperStore = create<ScraperState>((set) => ({
  scrapeJobs: [],
  queryStatus: "idle",
  selectedDevice: undefined,
  refetch: undefined,
  processingDevices: new Set(),
  visibleJobDevices: new Set(),
  setScrapeJobs: (scrapeJobs) => set({ scrapeJobs }),
  setQueryStatus: (queryStatus) => set({ queryStatus }),
  setSelectedDevice: (selectedDevice) => set({ selectedDevice }),
  setRefetch: (refetch) => set({ refetch }),
  addProcessingDevice: (deviceId) =>
    set((state) => {
      const newSet = new Set(state.processingDevices);
      newSet.add(deviceId);
      return { processingDevices: newSet };
    }),
  removeProcessingDevice: (deviceId) =>
    set((state) => {
      const newSet = new Set(state.processingDevices);
      newSet.delete(deviceId);
      return { processingDevices: newSet };
    }),
  registerVisibleJob: (deviceId) =>
    set((state) => {
      const newSet = new Set(state.visibleJobDevices);
      newSet.add(deviceId);
      return { visibleJobDevices: newSet };
    }),
  unregisterVisibleJob: (deviceId) =>
    set((state) => {
      const newSet = new Set(state.visibleJobDevices);
      newSet.delete(deviceId);
      return { visibleJobDevices: newSet };
    }),
}));
