import {
  useScraperManager,
  useScraperClient,
} from "../../scraping/hooks/useScraper";
import type { Device } from "@/src/server/db/schema";
import { useCallback } from "react";

export const useDeviceScraping = (devices?: Device[]) => {
  // Initialize the scraping manager without a specific device
  useScraperManager();

  // Get the scraping client for operations
  const { startScrape, isProcessing } = useScraperClient();

  // Handle queueing multiple devices for parsing
  const handleQueueParsing = useCallback(
    async (deviceIds: string[]) => {
      if (!devices) return;

      for (const deviceId of deviceIds) {
        const device = devices.find((d) => d.id === deviceId);
        if (!device || !device.name) continue;

        try {
          await startScrape(device.name, device.id);
        } catch (error) {
          console.error(`Failed to queue device ${device.name}:`, error);
        }
      }
    },
    [devices, startScrape]
  );

  return {
    handleQueueParsing,
    isProcessing,
  };
};
