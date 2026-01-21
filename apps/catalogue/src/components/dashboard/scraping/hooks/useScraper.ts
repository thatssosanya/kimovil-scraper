import { useEffect, useRef } from "react";
import { api } from "@/src/utils/api";
import type { Device } from "@/src/server/db/schema";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useScraperStore } from "@/src/stores/scraperStore";
import { type ScrapeJob } from "@/src/types/scraper";

export const useScraperManager = (selectedDevice?: Device) => {
  const { user } = useUser();

  const completedStepsRef = useRef<Record<string, ScrapeJob["step"]>>({});
  const isInitialLoadRef = useRef(true);
  const { setScrapeJobs, setQueryStatus, setSelectedDevice, setRefetch } =
    useScraperStore();

  const {
    data: fetchedScrapeJobs,
    status,
    refetch,
  } = api.scraping.getJobs.useQuery(undefined, {
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (fetchedScrapeJobs) {
      setScrapeJobs(fetchedScrapeJobs);
      setQueryStatus("success");
    }
  }, [fetchedScrapeJobs, setScrapeJobs, setQueryStatus]);

  useEffect(() => {
    if (status === "error") {
      setQueryStatus("error");
      console.error("Error fetching scrape jobs:");
    }
  }, [status, setQueryStatus]);

  useEffect(() => {
    setSelectedDevice(selectedDevice);
  }, [selectedDevice, setSelectedDevice]);

  useEffect(() => {
    setQueryStatus(status);
  }, [status, setQueryStatus]);

  useEffect(() => {
    setRefetch(refetch);
  }, [refetch, setRefetch]);

  useEffect(() => {
    if (fetchedScrapeJobs) {
      // On initial load, just record current states without toasting
      if (isInitialLoadRef.current) {
        fetchedScrapeJobs.forEach((job) => {
          if (job && job.userId === user?.id && job.deviceId) {
            completedStepsRef.current[job.deviceId] = job.step;
          }
        });
        isInitialLoadRef.current = false;
        return;
      }

      // After initial load, only toast on actual step transitions
      fetchedScrapeJobs.forEach((job) => {
        if (job && job.userId === user?.id && job.deviceId) {
          const deviceId = job.deviceId;
          const completedStep = completedStepsRef.current[deviceId];

          if (job.step !== completedStep) {
            // Skip toast if JobStatus is visible for this device
            const isJobVisible = useScraperStore
              .getState()
              .visibleJobDevices.has(deviceId);
            const tag = job.deviceName ?? deviceId;

            if (!isJobVisible) {
              switch (job.step) {
                case "searching":
                  toast(`[${tag}] Поиск устройства...`);
                  break;
                case "selecting":
                  toast.success(`[${tag}] Найдены совпадения`, {
                    description: "Выберите нужное устройство.",
                  });
                  break;
                case "scraping":
                  toast(`[${tag}] Загрузка спецификаций...`);
                  break;
                case "done":
                  toast.success(`[${tag}] Импорт завершён`, {
                    description: "Данные сохранены.",
                  });
                  break;
                case "error":
                  toast.error(`[${tag}] Ошибка импорта`, {
                    description: job.error?.toString(),
                  });
                  break;
                case "slug_conflict":
                  toast.warning(`[${tag}] Дубликат`, {
                    description: job.slugConflict?.existingDeviceName
                      ? `Уже существует: ${job.slugConflict.existingDeviceName}`
                      : "Устройство уже есть в базе.",
                  });
                  break;
                case "interrupted":
                  toast.error(`[${tag}] Процесс прерван`, {
                    description: "Сервер перезагрузился. Попробуйте повторить.",
                  });
                  break;
              }
            }

            completedStepsRef.current[deviceId] = job.step;
          }
        }
      });
    }
  }, [fetchedScrapeJobs, user?.id]);
};

export const useScraperClient = () => {
  const {
    scrapeJobs,
    queryStatus,
    selectedDevice,
    refetch,
    processingDevices,
    addProcessingDevice,
    removeProcessingDevice,
  } = useScraperStore();

  const selectedDeviceJob = scrapeJobs.find(
    (job) => job.deviceId === selectedDevice?.id
  );

  const startScrapeMutation = api.scraping.startScrape.useMutation();
  const confirmSlugMutation = api.scraping.confirmSlug.useMutation();
  const retryJobMutation = api.scraping.retryJob.useMutation();
  const importExistingMutation = api.scraping.importExisting.useMutation();

  const startScrape = async (searchString: string, deviceId?: string) => {
    if (!deviceId && !selectedDevice) {
      throw new Error("No device selected");
    }

    const targetDeviceId = deviceId || selectedDevice?.id;
    if (!targetDeviceId) return;

    try {
      addProcessingDevice(targetDeviceId);
      await startScrapeMutation.mutateAsync({
        deviceId: targetDeviceId,
        deviceName: selectedDevice?.name || null,
        searchString,
      });

      await refetch?.();
      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to start scraping: ${error.message}`);
      }
      throw new Error("Failed to start scraping");
    } finally {
      removeProcessingDevice(targetDeviceId);
    }
  };

  const confirmSlugSelection = async (slug: string) => {
    if (!selectedDevice) {
      throw new Error("No device selected");
    }

    try {
      addProcessingDevice(selectedDevice.id);
      await confirmSlugMutation.mutateAsync({
        deviceId: selectedDevice.id,
        slug,
      });

      await refetch?.();
      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to confirm slug: ${error.message}`);
      }
      throw new Error("Failed to confirm slug");
    } finally {
      removeProcessingDevice(selectedDevice.id);
    }
  };

  const retryJob = async (deviceId: string) => {
    try {
      addProcessingDevice(deviceId);
      await retryJobMutation.mutateAsync({
        deviceId,
      });

      await refetch?.();
      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to retry job: ${error.message}`);
      }
      throw new Error("Failed to retry job");
    } finally {
      removeProcessingDevice(deviceId);
    }
  };

  const importExisting = async (slug: string, deviceId?: string) => {
    const targetDeviceId = deviceId || selectedDevice?.id;
    if (!targetDeviceId) {
      throw new Error("No device selected");
    }

    try {
      addProcessingDevice(targetDeviceId);
      await importExistingMutation.mutateAsync({
        deviceId: targetDeviceId,
        slug,
      });

      await refetch?.();
      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to import existing: ${error.message}`);
      }
      throw new Error("Failed to import existing");
    } finally {
      removeProcessingDevice(targetDeviceId);
    }
  };

  const isProcessing =
    processingDevices.size > 0 ||
    startScrapeMutation.isPending ||
    confirmSlugMutation.isPending ||
    retryJobMutation.isPending ||
    importExistingMutation.isPending;

  return {
    scrapeJobs,
    selectedDeviceJob,
    queryStatus,
    startScrape,
    confirmSlugSelection,
    retryJob,
    importExisting,
    isProcessing,
  };
};
