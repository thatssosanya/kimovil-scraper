export const config = {
  port: Number(process.env.PORT ?? 1488),
  enableDebugEval: process.env.NODE_ENV !== "production",
  telegram: {
    monitorEnabled: process.env.TELEGRAM_MONITOR_ENABLED !== "false",
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    pollTimeoutSeconds: Math.max(
      10,
      Number(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS ?? "30") || 30,
    ),
    processBatchSize: Math.max(
      1,
      Number(process.env.TELEGRAM_PROCESS_BATCH_SIZE ?? "6") || 6,
    ),
    processConcurrency: Math.max(
      1,
      Number(process.env.TELEGRAM_PROCESS_CONCURRENCY ?? "3") || 3,
    ),
    maxAttempts: Math.max(
      1,
      Number(process.env.TELEGRAM_PROCESS_MAX_ATTEMPTS ?? "5") || 5,
    ),
    loopDelayMs: Math.max(
      0,
      Number(process.env.TELEGRAM_MONITOR_LOOP_DELAY_MS ?? "250") || 250,
    ),
    allowedChatIds: (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  },
  auth: {
    database: process.env.AUTH_DATABASE ?? "./auth.sqlite",
    baseURL:
      process.env.AUTH_BASE_URL ??
      `http://localhost:${process.env.PORT ?? 1488}`,
    secret: process.env.AUTH_SECRET ?? "dev-secret-change-in-production",
    trustedOrigins: (
      process.env.AUTH_TRUSTED_ORIGINS ?? "http://localhost:5173"
    ).split(","),
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
