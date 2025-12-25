export const extractVariantKey = (name: string): string | null => {
  // "Samsung Galaxy S24 Ultra 12/512Gb" → "12/512"
  // "iPhone 15 Pro 256GB" → "256" (no RAM shown)
  const ramStorageMatch = name.match(/(\d+)\s*[\/\\]\s*(\d+)\s*[GgТт][Bbб]/i);
  if (ramStorageMatch) {
    return `${ramStorageMatch[1]}/${ramStorageMatch[2]}`;
  }

  const storageOnlyMatch = name.match(/(\d+)\s*[GgТт][Bbб]/i);
  if (storageOnlyMatch) {
    return storageOnlyMatch[1];
  }

  return null;
};

export const normalizeVariantKey = (key: string): string => {
  // Normalize to consistent format: "8/256" or "256"
  return key.replace(/\s+/g, "").toLowerCase();
};
