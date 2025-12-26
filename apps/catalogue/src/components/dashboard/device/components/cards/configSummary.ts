export interface ConfigLink {
  id?: string;
  url?: string;
  price?: number | null;
  marketplace?: {
    iconUrl?: string | null;
    name?: string | null;
  } | null;
}

export interface DeviceConfig {
  id: string;
  name: string | null;
  links?: ConfigLink[] | null;
  capacity?: string | null;
  ram?: string | null;
}

export interface ConfigSummary {
  key: string;
  name: string;
  price?: number;
  link?: string;
  sortValue?: number;
}

const CAPACITY_REGEX = /(\d+)\s?(гб|gb|тб|tb)/i;
const CAPACITY_VALUE_REGEX = /(\d+(?:[.,]\d+)?)/;

const normalizeUnit = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replaceAll("гб", "gb")
    .replaceAll("тб", "tb")
    .trim();

const resolveCapacityFromName = (name: string | null | undefined) => {
  if (!name) return null;
  const match = name.match(CAPACITY_REGEX);
  if (!match) return null;
  const [, digits, unit] = match;
  return `${digits} ${unit}`.trim();
};

const resolveNumericCapacity = (
  capacity: string | null | undefined,
  name: string | null | undefined
) => {
  const candidate = capacity?.trim() || resolveCapacityFromName(name);
  if (!candidate) {
    const digits = name?.match(CAPACITY_VALUE_REGEX)?.[1];
    return digits ? parseInt(digits, 10) || undefined : undefined;
  }

  const numericMatch = candidate.match(CAPACITY_VALUE_REGEX);
  if (!numericMatch) return undefined;

  const valueSegment = numericMatch[1]?.replace(",", ".") ?? "";
  if (!valueSegment) return undefined;

  const raw = parseFloat(valueSegment);
  if (Number.isNaN(raw)) return undefined;

  const lower = candidate.toLowerCase();
  if (lower.includes("тб") || lower.includes("tb")) {
    return raw * 1024;
  }

  return raw;
};

const resolveDisplayName = (config: DeviceConfig) => {
  const { capacity, name } = config;
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  const trimmedCapacity = capacity?.trim();
  if (trimmedCapacity) {
    return trimmedCapacity;
  }

  const capacityFromName = resolveCapacityFromName(name);
  if (capacityFromName) {
    return capacityFromName;
  }

  return name?.trim() ?? "";
};

const resolveKey = (config: DeviceConfig, fallbackName: string) => {
  const { capacity, name, id } = config;
  const trimmedCapacity = capacity?.trim();
  if (trimmedCapacity) {
    return normalizeUnit(trimmedCapacity);
  }

  const capacityFromName = resolveCapacityFromName(name);
  if (capacityFromName) {
    return normalizeUnit(capacityFromName);
  }

  if (fallbackName) {
    return normalizeUnit(fallbackName);
  }

  return id;
};

const getLowestPricedLink = (
  links: ConfigLink[] | null | undefined
): { price?: number; url?: string } => {
  const validLinks =
    links
      ?.map((link) => {
        const summary: { price?: number; url?: string } = {};
        if (typeof link?.price === "number" && link.price > 0) {
          summary.price = link.price;
        }
        if (typeof link?.url === "string") {
          summary.url = link.url;
        }
        return summary;
      })
      .filter(
        (link): link is { price: number; url?: string } =>
          typeof link.price === "number"
      ) ?? [];

  if (!validLinks.length) {
    return {};
  }

  return validLinks.reduce((lowest, current) =>
    current.price < lowest.price ? current : lowest
  );
};

export const buildUniqueConfigSummaries = (
  configs: DeviceConfig[]
): ConfigSummary[] => {
  const summaries = new Map<string, ConfigSummary>();

  configs.forEach((config) => {
    const displayName = resolveDisplayName(config);
    if (!displayName) return;

    const key = resolveKey(config, displayName);
    const { price, url } = getLowestPricedLink(config.links);
    const sortValue = resolveNumericCapacity(config.capacity, config.name);

    if (!summaries.has(key)) {
      summaries.set(key, {
        key,
        name: displayName,
        price,
        link: url,
        sortValue,
      });
      return;
    }

    const existing = summaries.get(key);
    if (!existing) return;

    if (typeof price === "number") {
      if (existing.price === undefined || price < existing.price) {
        existing.price = price;
        existing.link = url ?? existing.link;
        if (existing.sortValue === undefined && sortValue !== undefined) {
          existing.sortValue = sortValue;
        }
      } else if (!existing.link && url) {
        existing.link = url;
      }
    }

    if (existing.sortValue === undefined && sortValue !== undefined) {
      existing.sortValue = sortValue;
    }

    if (!existing.link && url) {
      existing.link = url;
    }
  });

  return Array.from(summaries.values());
};
