import { createSignal } from "solid-js";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme-preference";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  
  document.documentElement.classList.toggle("dark", t === "dark");
  localStorage.setItem(STORAGE_KEY, t);
}

const [theme, setThemeInternal] = createSignal<Theme>(getInitialTheme());

// Apply initial theme immediately
applyTheme(theme());

export function toggleTheme() {
  const newTheme = theme() === "dark" ? "light" : "dark";
  setThemeInternal(newTheme);
  applyTheme(newTheme);
}

export function setTheme(t: Theme) {
  setThemeInternal(t);
  applyTheme(t);
}

export { theme };
