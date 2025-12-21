export const config = {
  port: 1488,
  bulk: {
    concurrency: Math.max(1, Number(process.env.BULK_CONCURRENCY ?? "2") || 1),
    rateLimitMs: Math.max(
      0,
      Number(process.env.BULK_RATE_LIMIT_MS ?? "1500") || 0,
    ),
    retryBaseMs: Math.max(
      1000,
      Number(process.env.BULK_RETRY_BASE_MS ?? "2000") || 2000,
    ),
    retryMaxMs: Math.max(
      2000,
      Number(process.env.BULK_RETRY_MAX_MS ?? String(15 * 60 * 1000)) ||
        15 * 60 * 1000,
    ),
  },
};
