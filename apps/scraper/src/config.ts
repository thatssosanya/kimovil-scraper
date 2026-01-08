export const config = {
  port: Number(process.env.PORT ?? 1488),
  enableDebugEval: process.env.NODE_ENV !== "production",
  auth: {
    database: process.env.AUTH_DATABASE ?? "./auth.sqlite",
    baseURL: process.env.AUTH_BASE_URL ?? `http://localhost:${process.env.PORT ?? 1488}`,
    secret: process.env.AUTH_SECRET ?? "dev-secret-change-in-production",
    trustedOrigins: (process.env.AUTH_TRUSTED_ORIGINS ?? "http://localhost:5173").split(","),
  },
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
