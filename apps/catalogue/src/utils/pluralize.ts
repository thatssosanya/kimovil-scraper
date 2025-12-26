/**
 * Russian pluralization utility
 * Returns the correct form based on the number according to Russian grammar rules
 */
export function pluralize(
  count: number,
  forms: [string, string, string] // [1, 2-4, 5+]
): string {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;

  // Special cases for 11-19 (always use third form)
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return forms[2];
  }

  // For other numbers
  if (lastDigit === 1) {
    return forms[0]; // 1, 21, 31, etc.
  } else if (lastDigit >= 2 && lastDigit <= 4) {
    return forms[1]; // 2-4, 22-24, etc.
  } else {
    return forms[2]; // 0, 5-20, 25-30, etc.
  }
}

/**
 * Format count with correct pluralization
 */
export function formatCount(
  count: number,
  forms: [string, string, string],
  includeCount = true
): string {
  return `${includeCount ? `${count} ` : ""}${pluralize(count, forms)}`;
}

export type PluralForms = [string, string, string];

// Common pluralization forms
export const PLURALS = {
  devices: ["устройство", "устройства", "устройств"] as PluralForms,
  ratings: ["рейтинг", "рейтинга", "рейтингов"] as PluralForms,
  smartphones: ["смартфон", "смартфона", "смартфонов"] as PluralForms,
  reviews: ["обзор", "обзора", "обзоров"] as PluralForms,
};
