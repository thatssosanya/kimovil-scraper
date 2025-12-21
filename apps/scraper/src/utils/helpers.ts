export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
};

export const createRateLimiter = (minIntervalMs: number) => {
  let nextAvailableAt = 0;
  return async () => {
    const now = Date.now();
    const waitMs = Math.max(0, nextAvailableAt - now);
    nextAvailableAt = Math.max(nextAvailableAt, now) + minIntervalMs;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  };
};
