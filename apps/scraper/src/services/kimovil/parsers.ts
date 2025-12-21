export const getCpuCores = (input: string | null): string[] | null => {
  if (!input) return null;

  // Normalize input: replace bullet (•) with space, normalize whitespace
  const normalized = input.replace(/•/g, " ").replace(/\s+/g, " ").trim();

  // Use regex to find all core specifications directly
  // Pattern: NxFrequency GHz/MHz (optionally followed by model name)
  // Handles both "1x3.21GHz ARM Cortex X4" and "1x3.21GHz"
  // Supports both 'x' and '×' as multiplication sign
  const corePattern = /(\d+)\s*[x×]\s*([\d.,]+)\s*(ghz|mhz)/gi;
  const result: string[] = [];

  let match;
  while ((match = corePattern.exec(normalized)) !== null) {
    const count = parseInt(match[1], 10);
    const frequency = parseFloat(match[2].replace(",", "."));
    const unit = match[3].toLowerCase();
    const frequencyInMhz = unit === "ghz" ? Math.round(frequency * 1000) : Math.round(frequency);

    result.push(`${count}x${frequencyInMhz}`);
  }

  return result.length > 0 ? result : null;
};

const monthMap: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export const parseReleaseDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  const cleanDateString = dateString.trim().toLowerCase();
  const match = cleanDateString.match(/([a-z]+)\s+(\d{4})/i);
  if (!match) return null;

  const monthName = match[1];
  const year = parseInt(match[2], 10);

  const monthIndex = monthMap[monthName];
  if (monthIndex === undefined) return null;

  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
};

export const getSoftware = (
  input: string | null
): { os: string; osSkin: string } | null => {
  if (!input) return null;

  const [osPart, _, osSkinPart] = input.split("\n");
  const osMatch = osPart?.trim().match(/\w+ ?[\d\.,]*/i);
  if (!osMatch) return null;

  const osSkinSplit = osSkinPart?.split("(") ?? [];
  return { os: osMatch[0], osSkin: osSkinSplit[0]?.trim() ?? "" };
};
