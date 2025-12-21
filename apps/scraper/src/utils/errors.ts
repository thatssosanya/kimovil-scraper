export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if ("message" in obj && typeof obj.message === "string") return obj.message;
    if ("_tag" in obj && "error" in obj) return getErrorMessage(obj.error);
    if ("cause" in obj) return getErrorMessage(obj.cause);
  }
  return String(error);
};

export interface ClassifiedError {
  retryable: boolean;
  code: string;
  message: string;
  validationReason: string | null;
}

export const classifyScrapeError = (error: unknown): ClassifiedError => {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();
  const isBot =
    message.includes("Bot protection") ||
    message.includes("Access denied") ||
    message.includes("Page invalid: Bot protection");
  const isInvalid =
    message.includes("Page invalid") ||
    message.includes("Cached page invalid") ||
    message.includes("Missing expected content structure") ||
    message.includes("Missing main content element");
  const isTimeout =
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("navigation");
  const isNetwork =
    lower.includes("net::") ||
    lower.includes("network") ||
    lower.includes("connection");

  const retryable = isBot || isTimeout || isNetwork;
  let code = "unknown";
  if (isBot) code = "bot";
  else if (isInvalid) code = "invalid_html";
  else if (isTimeout) code = "timeout";
  else if (isNetwork) code = "network";

  const validationMatch = message.match(
    /(Page invalid|Cached page invalid):\s*(.+)$/,
  );
  const validationReason = validationMatch?.[2] ?? null;

  return { retryable, code, message, validationReason };
};
