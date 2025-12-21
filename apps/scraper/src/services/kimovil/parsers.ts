export const getCpuCores = (input: string | null): string[] | null => {
  if (!input) return null;

  // Normalize input: replace bullets, HTML entities, normalize whitespace
  const normalized = input
    .replace(/•/g, " ")
    .replace(/&amp;/g, "+")
    .replace(/\s+/g, " ")
    .trim();

  const result: string[] = [];

  // Split by common group separators: +, &, comma (when followed by digit+x pattern)
  const groups = normalized.split(/\s*(?:\+|&|,\s*(?=\d+\s*[x×]))\s*/i);

  for (const group of groups) {
    // Pattern 1: Frequency attached to count - "1x3.21GHz", "2x4050MHz"
    const attachedMatch = group.match(/(\d+)\s*[x×]\s*([\d.,]+)\s*(ghz|mhz)/i);
    if (attachedMatch) {
      const count = parseInt(attachedMatch[1], 10);
      const frequency = parseFloat(attachedMatch[2].replace(",", "."));
      const unit = attachedMatch[3].toLowerCase();
      const frequencyInMhz = unit === "ghz" ? Math.round(frequency * 1000) : Math.round(frequency);
      result.push(`${count}x${frequencyInMhz}`);
      continue;
    }

    // Pattern 2: Separated format - "8x Cortex A53 1.5 GHz", "4x A78 2.4 GHz"
    // Core count at start, frequency anywhere after
    const separatedMatch = group.match(/(\d+)\s*[x×]\s*.+?([\d.,]+)\s*(ghz|mhz)/i);
    if (separatedMatch) {
      const count = parseInt(separatedMatch[1], 10);
      const frequency = parseFloat(separatedMatch[2].replace(",", "."));
      const unit = separatedMatch[3].toLowerCase();
      const frequencyInMhz = unit === "ghz" ? Math.round(frequency * 1000) : Math.round(frequency);
      result.push(`${count}x${frequencyInMhz}`);
      continue;
    }
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
