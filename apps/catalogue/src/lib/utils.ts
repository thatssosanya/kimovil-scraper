import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStandardInputClasses(isDirty?: boolean, isEditing?: boolean) {
  return cn(
    "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 disabled:bg-zinc-50 dark:bg-transparent dark:border-gray-800 dark:text-gray-200 dark:disabled:bg-gray-800/50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
    isDirty && isEditing && "bg-blue-50 dark:bg-blue-950/30"
  );
}

export async function loadGoogleFont(font: string, weight: string) {
  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}`;
  const css = await fetch(url).then((res) => res.text());
  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/
  );

  if (resource && resource[1]) {
    const response = await fetch(resource[1]);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  }

  throw new Error("Failed to load font");
}
