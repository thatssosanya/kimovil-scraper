/**
 * Normalizes a device name for duplicate detection.
 * - Lowercases the string
 * - Removes punctuation and special characters
 * - Normalizes whitespace
 */
export function normalizeDeviceName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
