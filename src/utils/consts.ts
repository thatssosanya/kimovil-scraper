export const SIM_TYPES = [
  "Nano SIM / eSIM",
  "Nano SIM",
  "Micro SIM",
  "Mini SIM",
  "eSIM",
  "SIM",
] as const;

export const PLAYWRIGHT_TIMEOUT = 2 * 60 * 1000;

export const MESSAGE_RETRIES = 3;

export const EXCLUDED_RESOURCE_TYPES = new Set([
  "image",
  "stylesheet",
  "media",
  "font",
  "other",
]);

export const MAX_CONCURRENT_MESSAGES = parseInt(
  process.env.MAX_CONCURRENT_MESSAGES ?? "30"
);
