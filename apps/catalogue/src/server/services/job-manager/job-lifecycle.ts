import type { JobStore } from "./job-store";
import { JOB_TIMEOUTS, STALE_JOB_CHECK_INTERVAL } from "./types";

export class JobLifecycleManager {
  private checkInterval: NodeJS.Timeout;
  private jobStore: JobStore;

  constructor(jobStore: JobStore) {
    this.jobStore = jobStore;
    this.checkInterval = setInterval(() => {
      void this.runChecks();
    }, STALE_JOB_CHECK_INTERVAL);
  }

  private async runChecks(): Promise<void> {
    await this.markStaleJobsAsInterrupted();
    await this.cleanupOldJobs();
  }

  private async markStaleJobsAsInterrupted(): Promise<void> {
    const maxTimeout = Math.max(
      JOB_TIMEOUTS.searching,
      JOB_TIMEOUTS.selecting,
      JOB_TIMEOUTS.scraping
    );
    await this.jobStore.markStaleAsInterrupted(maxTimeout);
  }

  private async cleanupOldJobs(): Promise<void> {
    await this.jobStore.cleanupOldJobs();
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
