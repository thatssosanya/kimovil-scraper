export type CpuCoreRole = "performance" | "efficiency" | "balanced" | "unknown";

export interface CpuCoreCluster {
  count: number;
  maxFreqMhz: number | null;
  label: string | null;
  role: CpuCoreRole;
  rawGroup: string;
  index: number;
}

const PERFORMANCE_CORES = new Set([
  "firestorm", "avalanche", "monsoon", "vortex",
  "x1", "x2", "x3", "x4",
  "a78", "a710", "a715", "a720",
  "cortex-x1", "cortex-x2", "cortex-x3", "cortex-x4",
  "cortex a78", "cortex a710", "cortex a715", "cortex a720",
]);

const EFFICIENCY_CORES = new Set([
  "icestorm", "blizzard", "tempest", "mistral",
  "a55", "a510", "a520",
  "cortex a55", "cortex a510", "cortex a520",
]);

const detectRole = (
  label: string | null,
  rawGroup: string,
  maxFreqMhz: number | null,
  allClusters: Array<{ maxFreqMhz: number | null }>
): CpuCoreRole => {
  const groupLower = rawGroup.toLowerCase();
  
  if (groupLower.includes("p • cores") || groupLower.includes("p•cores") || groupLower.includes("performance")) {
    return "performance";
  }
  if (groupLower.includes("e • cores") || groupLower.includes("e•cores") || groupLower.includes("efficiency")) {
    return "efficiency";
  }

  if (label) {
    const labelLower = label.toLowerCase().replace(/-/g, " ");
    for (const pCore of PERFORMANCE_CORES) {
      if (labelLower.includes(pCore) || pCore.includes(labelLower)) {
        return "performance";
      }
    }
    for (const eCore of EFFICIENCY_CORES) {
      if (labelLower.includes(eCore) || eCore.includes(labelLower)) {
        return "efficiency";
      }
    }
  }

  if (maxFreqMhz !== null && allClusters.length > 1) {
    const freqs = allClusters
      .map(c => c.maxFreqMhz)
      .filter((f): f is number => f !== null);
    if (freqs.length > 1) {
      const maxFreq = Math.max(...freqs);
      const minFreq = Math.min(...freqs);
      if (maxFreqMhz === maxFreq && maxFreq > minFreq) return "performance";
      if (maxFreqMhz === minFreq && maxFreq > minFreq) return "efficiency";
    }
  }

  return "unknown";
};

const extractLabel = (group: string): string | null => {
  let cleaned = group
    .replace(/•/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned
    .replace(/p\s*•?\s*cores?/gi, "")
    .replace(/e\s*•?\s*cores?/gi, "")
    .replace(/performance/gi, "")
    .replace(/efficiency/gi, "");

  const match = cleaned.match(/\d+\s*[x×]\s*([\d.,]+\s*(?:ghz|mhz)\s*)?(.+?)(?:[\d.,]+\s*(?:ghz|mhz)|$)/i);
  if (match && match[2]) {
    const label = match[2].trim();
    if (label && !/^\d/.test(label)) {
      return label || null;
    }
  }

  const afterXMatch = cleaned.match(/\d+\s*[x×]\s*(.+?)(?:\s*[\d.,]+\s*(?:ghz|mhz)|$)/i);
  if (afterXMatch && afterXMatch[1]) {
    let label = afterXMatch[1]
      .replace(/[\d.,]+\s*(?:ghz|mhz)/gi, "")
      .trim();
    if (label && !/^\d/.test(label)) {
      return label || null;
    }
  }

  return null;
};

export const getCpuCoreClusters = (input: string | null): CpuCoreCluster[] | null => {
  if (!input) return null;

  const normalized = input
    .replace(/&amp;/g, "+")
    .replace(/\s+/g, " ")
    .trim();

  const groups = normalized.split(/\s*(?:\+|&|,\s*(?=\d+\s*[x×]))\s*/i);
  const partialClusters: Array<{
    count: number;
    maxFreqMhz: number | null;
    label: string | null;
    rawGroup: string;
    index: number;
  }> = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i].trim();
    if (!group) continue;

    const attachedMatch = group.match(/(\d+)\s*[x×]\s*([\d.,]+)\s*(ghz|mhz)/i);
    if (attachedMatch) {
      const count = parseInt(attachedMatch[1], 10);
      const frequency = parseFloat(attachedMatch[2].replace(",", "."));
      const unit = attachedMatch[3].toLowerCase();
      const maxFreqMhz = unit === "ghz" ? Math.round(frequency * 1000) : Math.round(frequency);
      const label = extractLabel(group);
      partialClusters.push({ count, maxFreqMhz, label, rawGroup: group, index: partialClusters.length });
      continue;
    }

    const separatedMatch = group.match(/(\d+)\s*[x×]\s*.+?([\d.,]+)\s*(ghz|mhz)/i);
    if (separatedMatch) {
      const count = parseInt(separatedMatch[1], 10);
      const frequency = parseFloat(separatedMatch[2].replace(",", "."));
      const unit = separatedMatch[3].toLowerCase();
      const maxFreqMhz = unit === "ghz" ? Math.round(frequency * 1000) : Math.round(frequency);
      const label = extractLabel(group);
      partialClusters.push({ count, maxFreqMhz, label, rawGroup: group, index: partialClusters.length });
      continue;
    }

    const noFreqMatch = group.match(/(\d+)\s*[x×]\s*(.+)/i);
    if (noFreqMatch) {
      const count = parseInt(noFreqMatch[1], 10);
      const labelPart = noFreqMatch[2].trim();
      const label = labelPart && !/^\d/.test(labelPart) ? labelPart : null;
      partialClusters.push({ count, maxFreqMhz: null, label, rawGroup: group, index: partialClusters.length });
    }
  }

  if (partialClusters.length === 0) return null;

  const clusters: CpuCoreCluster[] = partialClusters.map(pc => ({
    ...pc,
    role: detectRole(pc.label, pc.rawGroup, pc.maxFreqMhz, partialClusters),
  }));

  return clusters;
};

export const getCpuCores = (input: string | null): string[] | null => {
  const clusters = getCpuCoreClusters(input);
  if (!clusters) return null;
  const result = clusters
    .filter(c => c.maxFreqMhz !== null)
    .map(c => `${c.count}x${c.maxFreqMhz}`);
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
