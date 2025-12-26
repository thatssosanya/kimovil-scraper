/**
 * Utility functions for generating URL-friendly slugs with transliteration support
 */

// Transliteration map for Cyrillic to Latin characters
const transliterationMap: Record<string, string> = {
  // Russian/Cyrillic characters
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",

  // Uppercase variants
  А: "A",
  Б: "B",
  В: "V",
  Г: "G",
  Д: "D",
  Е: "E",
  Ё: "Yo",
  Ж: "Zh",
  З: "Z",
  И: "I",
  Й: "Y",
  К: "K",
  Л: "L",
  М: "M",
  Н: "N",
  О: "O",
  П: "P",
  Р: "R",
  С: "S",
  Т: "T",
  У: "U",
  Ф: "F",
  Х: "H",
  Ц: "Ts",
  Ч: "Ch",
  Ш: "Sh",
  Щ: "Sch",
  Ъ: "",
  Ы: "Y",
  Ь: "",
  Э: "E",
  Ю: "Yu",
  Я: "Ya",

  // Common special characters
  " ": "-",
  _: "-",
  ".": "",
  ",": "",
  "!": "",
  "?": "",
  ":": "",
  ";": "",
  '"': "",
  "'": "",
  "(": "",
  ")": "",
  "[": "",
  "]": "",
  "{": "",
  "}": "",
  "/": "-",
  "\\": "-",
  "|": "-",
  "+": "-",
  "=": "-",
  "*": "",
  "&": "and",
  "%": "percent",
  "#": "",
  "@": "at",
};

/**
 * Transliterates Cyrillic text to Latin characters
 */
export function transliterate(text: string): string {
  return text
    .split("")
    .map((char) => transliterationMap[char] || char)
    .join("");
}

/**
 * Generates a URL-friendly slug from text
 * - Transliterates Cyrillic characters to Latin
 * - Converts to lowercase
 * - Replaces remaining special characters with dashes
 * - Removes consecutive dashes
 * - Trims dashes from start/end
 */
export function generateSlug(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // First transliterate Cyrillic characters to Latin
  const transliterated = transliterate(text);

  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, "-") // Replace remaining non-alphanumeric chars with dashes
    .replace(/-+/g, "-") // Replace multiple consecutive dashes with single dash
    .replace(/^-+|-+$/g, "") // Remove leading/trailing dashes
    .substring(0, 100); // Limit length to 100 characters
}

/**
 * Generates a unique slug by appending a number if the base slug already exists
 */
export async function generateUniqueSlug(
  baseText: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = generateSlug(baseText);

  if (!baseSlug) {
    throw new Error("Cannot generate slug from provided text");
  }

  // Check if base slug is available
  if (!(await checkExists(baseSlug))) {
    return baseSlug;
  }

  // Try numbered variants
  let counter = 1;
  let uniqueSlug = `${baseSlug}-${counter}`;

  while (await checkExists(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;

    // Prevent infinite loops
    if (counter > 1000) {
      throw new Error("Unable to generate unique slug after 1000 attempts");
    }
  }

  return uniqueSlug;
}

/**
 * Validates if a string is a valid slug format
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") {
    return false;
  }

  // Must be 1-100 characters, lowercase alphanumeric with dashes
  // Cannot start or end with dash
  const slugRegex = /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/;
  return slugRegex.test(slug) && slug.length <= 100;
}

/**
 * Sanitizes user input for slug creation
 */
export function sanitizeSlugInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  return input.trim().substring(0, 200); // Limit input length
}
