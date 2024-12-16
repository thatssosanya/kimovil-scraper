export const SIM_TYPES = [
  "Nano SIM / eSIM",
  "Nano SIM",
  "Micro SIM",
  "Mini SIM",
  "eSIM",
  "SIM",
] as const;

export const PLAYWRIGHT_TIMEOUT =
  process.env.ENV === "development" ? 5 * 60 * 1000 : 2 * 60 * 1000;
