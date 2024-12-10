export const SIM_TYPES = [
  "SIM",
  "Mini SIM",
  "Micro SIM",
  "Nano SIM / eSIM",
  "Nano SIM",
  "eSIM",
] as const;

export const PLAYWRIGHT_TIMEOUT = process.env.ENV === "development" ? 0 : 10000;
