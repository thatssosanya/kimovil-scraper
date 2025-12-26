import { useScraperClient } from "./useScraper";
import { api } from "@/src/utils/api";
import { useEffect, useMemo } from "react";
import { type ScrapeJob } from "@/src/types/scraper";

export type JobStatusData = {
  readonly jobsMap: Map<string, ScrapeJob>;
  readonly hasProfileSet: Set<string>;
  readonly isLoadingStatus: boolean;
};

export function useJobStatus(): JobStatusData {
  const { data: deviceIds, isPending: isDeviceIdsLoading } =
    api.device.getSmartphoneIdsWhereCharacteristicsExist.useQuery(undefined, {
      refetchInterval: 15000,
    });

  const { scrapeJobs = [], queryStatus } = useScraperClient();
  const utils = api.useUtils();

  // Force refetch when any job status changes
  useEffect(() => {
    if (scrapeJobs.length > 0) {
      const refetchInterval = setTimeout(() => {
        void utils.device.getSmartphoneIdsWhereCharacteristicsExist.invalidate();
      }, 2000);

      return () => clearInterval(refetchInterval);
    }
  }, [
    scrapeJobs.length,
    utils.device.getSmartphoneIdsWhereCharacteristicsExist,
  ]);

  // Memoize job status data
  const jobsMap = useMemo(
    () =>
      new Map(
        scrapeJobs
          .filter((job): job is ScrapeJob & { deviceId: string } =>
            Boolean(job?.deviceId)
          )
          .map((job) => [job.deviceId, job])
      ),
    [scrapeJobs]
  );

  const hasProfileSet = useMemo(() => new Set(deviceIds ?? []), [deviceIds]);
  const isLoadingStatus = isDeviceIdsLoading || queryStatus === "pending";

  return {
    jobsMap,
    hasProfileSet,
    isLoadingStatus,
  } as const;
}
