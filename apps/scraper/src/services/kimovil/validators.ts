export const isBotProtectionPage = (html: string): string | null => {
  if (html.includes("Enable JavaScript and cookies to continue")) {
    return "Bot protection: JavaScript/cookies required";
  }
  if (html.includes("Please verify you are a human")) {
    return "Bot protection: Human verification required";
  }
  if (html.includes("Access denied")) {
    return "Bot protection: Access denied";
  }
  if (!html.includes("<main")) {
    return "Missing main content element";
  }
  return null;
};

export const getHtmlValidationError = (html: string): string | null => {
  const botReason = isBotProtectionPage(html);
  if (botReason) return botReason;
  if (!html.includes("k-dltable") && !html.includes("container-sheet")) {
    return "Missing expected content structure";
  }
  return null;
};

export const hasRequiredStructure = (html: string): boolean => {
  return getHtmlValidationError(html) === null;
};
