import { useScraperClient } from "@/src/components/dashboard/scraping/hooks/useScraper";
import { useScraperStore } from "@/src/stores/scraperStore";
import { Button } from "@/src/components/ui/Button";
import { Download, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { JobStatus } from "@/src/components/shared/status";
import type { Device } from "@/src/server/db/schema";
import type { ScrapeJob } from "@/src/types/scraper";

type ImportSpecsProps = {
  device: Device;
};

const ImportSpecs = ({ device }: ImportSpecsProps) => {
  const [isStarting, setIsStarting] = useState(false);
  const scraper = useScraperClient();
  const { registerVisibleJob, unregisterVisibleJob } = useScraperStore();

  const deviceJob = scraper.scrapeJobs.find(
    (job: ScrapeJob) => job.deviceId === device.id
  );

  // Register this device as having visible job status (suppresses toasts)
  // Do this at component level, not in JobStatus, to catch the job before it appears
  useEffect(() => {
    registerVisibleJob(device.id);
    return () => unregisterVisibleJob(device.id);
  }, [device.id, registerVisibleJob, unregisterVisibleJob]);

  useEffect(() => {
    if (deviceJob && isStarting) {
      setIsStarting(false);
    }
  }, [deviceJob, isStarting]);

  const handleStartImport = async () => {
    setIsStarting(true);
    try {
      await scraper.startScrape(device.name || "", device.id);
    } catch (error) {
      console.error("Failed to start scrape:", error);
      setIsStarting(false);
    }
  };

  if (!deviceJob && !isStarting) {
    return (
      <div className="p-6">
        <div className="text-center py-8 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Спецификации ещё не импортированы
          </div>
          <Button
            onClick={handleStartImport}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span>Импортировать</span>
          </Button>
        </div>
      </div>
    );
  }

  if (isStarting) {
    return (
      <div className="p-6">
        <div className="text-center py-8 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Запуск импорта...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <JobStatus job={deviceJob} />
    </div>
  );
};

export default ImportSpecs;
