const ALLOWED_HOSTS = ["market.yandex.ru", "m.market.yandex.ru"];

export type YandexUrlValidation =
  | { valid: true; externalId: string; cleanUrl: string }
  | { valid: false; error: string };

export function validateYandexMarketUrl(url: string): YandexUrlValidation {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      return { valid: false, error: "URL must use HTTPS" };
    }

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return {
        valid: false,
        error: `URL must be from ${ALLOWED_HOSTS.join(" or ")}`,
      };
    }

    const match = parsed.pathname.match(/\/(\d{5,})(?:\/|$|\?)/);
    if (!match) {
      return { valid: false, error: "Could not extract product ID from URL" };
    }

    const cleanUrl = `${parsed.origin}${parsed.pathname}`;

    return { valid: true, externalId: match[1], cleanUrl };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}
