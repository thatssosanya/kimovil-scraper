const MAX_PREFIX_LENGTH = 12;

export const inferBrand = (name: string): string | null => {
  const brands = [
    "Samsung",
    "Apple",
    "Xiaomi",
    "Redmi",
    "POCO",
    "OnePlus",
    "Huawei",
    "OPPO",
    "Vivo",
    "Realme",
    "Google",
    "Motorola",
    "Nokia",
    "Sony",
    "LG",
    "Asus",
    "ZTE",
    "Honor",
    "Lenovo",
    "Nothing",
    "Infinix",
    "Tecno",
    "TCL",
    "Meizu",
    "HTC",
    "Alcatel",
    "BlackBerry",
    "Doogee",
    "Ulefone",
    "Oukitel",
    "Cubot",
    "Umidigi",
    "Wiko",
    "BLU",
    "Micromax",
  ];
  const lowerName = name.toLowerCase();
  for (const brand of brands) {
    if (lowerName.startsWith(brand.toLowerCase())) {
      return brand;
    }
  }
  return null;
};

export const isValidChildPrefix = (prefix: string): boolean => {
  if (prefix.startsWith(" ") || prefix.startsWith("-")) return false;
  if (prefix.includes("  ") || prefix.includes("--")) return false;
  if (prefix.endsWith("  ")) return false;
  if (prefix.includes(" -") || prefix.includes("- ")) return false;
  return true;
};

export const isPrefixWorthExpanding = (prefix: string, depth: number): boolean => {
  if (depth >= MAX_PREFIX_LENGTH) return false;

  // Don't expand pure numeric prefixes beyond depth 3 (e.g., "123x")
  if (/^\d+$/.test(prefix) && depth > 3) return false;

  // Don't expand prefixes ending with space + short suffix
  if (/\s[a-z0-9]$/.test(prefix) && depth > 4) return false;

  // Don't expand if prefix has multiple spaces (model number patterns like "note 10 pro")
  if ((prefix.match(/ /g) || []).length >= 2) return false;

  return true;
};
