import { BulkJobManager } from "./bulk-job";

let _instance: BulkJobManager | null = null;

export const getBulkJobManager = (): BulkJobManager => {
  if (!_instance) {
    // Lazy import to avoid circular dependency
    const { LiveRuntime } = require("../layers/live");
    _instance = new BulkJobManager(LiveRuntime);
  }
  return _instance;
};
