export type PhoneModel = {
  price: string;
  title: string | undefined;
  link: string;
  id: string;
  originalPrice?: string;
  discount?: string;
};

export const rubleCurrencyFormatter = (price: number) => {
  const formatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    compactDisplay: "short",
    // no decimal values
    minimumFractionDigits: 0,
  });
  return formatter.format(price);
};

type DateObject = Date | string | number;

export const extractDigits = (str: string | null | undefined) => {
  if (!str || typeof str !== "string") {
    return 0;
  }
  return parseInt(str.replace(/\D/g, "")) || 0;
};

export const ruDateFormatter = (
  date: Date,
  options?: Intl.DateTimeFormatOptions
) => {
  return new Intl.DateTimeFormat("ru", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(date);
};

export function formatRelativeTime(inputDate: DateObject): string {
  const now = new Date();
  const date = new Date(inputDate);

  const differenceInMilliseconds = now.getTime() - date.getTime();
  const differenceInSeconds = Math.floor(differenceInMilliseconds / 1000);
  const differenceInMinutes = Math.floor(differenceInSeconds / 60);
  const differenceInHours = Math.floor(differenceInMinutes / 60);
  const differenceInDays = Math.floor(differenceInHours / 24);

  const relativeTimeFormatter = new Intl.RelativeTimeFormat("ru", {
    localeMatcher: "best fit",
    numeric: "always",
    style: "short",
  });

  if (differenceInMinutes < 60) {
    return relativeTimeFormatter.format(-differenceInMinutes, "minutes");
  }
  if (differenceInHours < 24) {
    return relativeTimeFormatter.format(-differenceInHours, "hour");
  } else {
    return relativeTimeFormatter.format(-differenceInDays, "day");
  }
}

export const isSelected = (
  item: { id?: string },
  selected?: { id?: string }
) => {
  if (!selected) return false;
  return item.id === selected.id;
};

export const extractNumber = (value: string): number => {
  const num = value.replace(/[^0-9]/g, "");
  return num ? parseInt(num, 10) : 0;
};

export function checkCapacityInName(capacity: string, name: string): boolean {
  // Normalize capacity and name strings
  const normalizedCapacity = capacity
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("гб", "gb")
    .replaceAll("тб", "tb");
  const normalizedName = name
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("гб", "gb")
    .replaceAll("тб", "tb");

  // Check if normalized capacity is included in normalized name
  return normalizedName.includes(normalizedCapacity);
}

export const safeJsonParse = <T>(str: string): T | null => {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
};

export type AgeCategory = "fresh" | "recent" | "aging" | "old" | "very-old";

export interface AgeThresholds {
  recent: number; // days
  aging: number; // days
  old: number; // days
  veryOld: number; // days
}

export const DEFAULT_AGE_THRESHOLDS: AgeThresholds = {
  recent: 7,
  aging: 14,
  old: 30,
  veryOld: 45,
};

export const getAgeLabel = (ageStyle: AgeCategory): string => {
  switch (ageStyle) {
    case "fresh":
      return "Актуально";
    case "recent":
      return "Недавно";
    case "aging":
      return "Устаревает";
    case "old":
      return "Устарело";
    case "very-old":
      return "Требуется обновление";
  }
};

export const getAgeStyle = (
  date: Date,
  thresholds: AgeThresholds = DEFAULT_AGE_THRESHOLDS
): AgeCategory => {
  const days = (new Date().getTime() - date.getTime()) / (1000 * 3600 * 24);

  if (days >= thresholds.veryOld) return "very-old";
  if (days >= thresholds.old) return "old";
  if (days >= thresholds.aging) return "aging";
  if (days >= thresholds.recent) return "recent";
  return "fresh";
};

export const getAgeBgColor = (ageStyle: AgeCategory): string => {
  switch (ageStyle) {
    case "fresh":
      return "bg-emerald-50";
    case "recent":
      return "bg-blue-50";
    case "aging":
      return "bg-yellow-50";
    case "old":
      return "bg-orange-50";
    case "very-old":
      return "bg-red-50";
  }
};

export const getAgeTextColor = (ageStyle: AgeCategory): string => {
  switch (ageStyle) {
    case "fresh":
      return "text-emerald-700";
    case "recent":
      return "text-blue-700";
    case "aging":
      return "text-yellow-700";
    case "old":
      return "text-orange-700";
    case "very-old":
      return "text-red-700";
  }
};

export const getAgeBadgeColor = (ageStyle: AgeCategory): string => {
  switch (ageStyle) {
    case "fresh":
      return "bg-emerald-100/80 text-emerald-700 ring-emerald-600/20";
    case "recent":
      return "bg-blue-100/80 text-blue-700 ring-blue-600/20";
    case "aging":
      return "bg-yellow-100/80 text-yellow-700 ring-yellow-600/20";
    case "old":
      return "bg-orange-100/80 text-orange-700 ring-orange-600/20";
    case "very-old":
      return "bg-red-100/80 text-red-700 ring-red-600/20";
  }
};
