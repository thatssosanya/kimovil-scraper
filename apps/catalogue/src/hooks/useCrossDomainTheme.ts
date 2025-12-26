import { useEffect, useState, useCallback } from "react";
import { useCrossDomainScript } from "./useCrossDomainScript";

type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface UseCrossDomainThemeReturn {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleDarkMode: () => void;
}

declare global {
  interface Window {
    crossDomainTheme?: {
      toggle: () => ResolvedTheme;
      get: () => ResolvedTheme;
      set: (theme: ResolvedTheme) => void;
      apply: (theme: ResolvedTheme) => void;
    };
  }
}

// Get system theme preference
function getSystemTheme(): ResolvedTheme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

// Resolve theme (handles 'system' -> 'light'|'dark')
function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

export function useCrossDomainTheme(): UseCrossDomainThemeReturn {
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const { hasCrossDomainSupport } = useCrossDomainScript();

  // Apply theme to DOM elements
  const applyThemeToDOM = useCallback((resolvedTheme: ResolvedTheme) => {
    const html = document.documentElement;

    if (resolvedTheme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, []);

  // Initialize theme from localStorage or cross-domain
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    const initialTheme = storedTheme || "system";
    const initialResolvedTheme = resolveTheme(initialTheme);

    setThemeState(initialTheme);
    setResolvedTheme(initialResolvedTheme);

    // Apply theme to DOM
    applyThemeToDOM(initialResolvedTheme);
  }, [applyThemeToDOM]);

  // Set theme function
  const setTheme = useCallback(
    (newTheme: Theme) => {
      const newResolvedTheme = resolveTheme(newTheme);

      setThemeState(newTheme);
      setResolvedTheme(newResolvedTheme);

      // Save to localStorage
      localStorage.setItem("theme", newTheme);

      // Apply to DOM
      applyThemeToDOM(newResolvedTheme);

      // Sync with cross-domain if available
      if (
        hasCrossDomainSupport &&
        window.crossDomainTheme &&
        newTheme !== "system"
      ) {
        window.crossDomainTheme.set(newResolvedTheme);
      }
    },
    [applyThemeToDOM, hasCrossDomainSupport]
  );

  // Toggle dark mode function
  const toggleDarkMode = useCallback(() => {
    // Use cross-domain toggle if available
    if (hasCrossDomainSupport && window.crossDomainTheme) {
      const newResolvedTheme = window.crossDomainTheme.toggle();
      setThemeState(newResolvedTheme);
      setResolvedTheme(newResolvedTheme);
      // Update localStorage to match
      localStorage.setItem("theme", newResolvedTheme);
      return;
    }

    // Fallback to local toggle
    const currentResolved = resolveTheme(theme);
    const newTheme: Theme = currentResolved === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [theme, setTheme, hasCrossDomainSupport]);

  // Listen for cross-domain theme changes
  useEffect(() => {
    const handleThemeChange = (
      event: CustomEvent<{ theme: ResolvedTheme; source: string }>
    ) => {
      const { theme: newTheme, source } = event.detail;

      if (source === "cross-domain-sync" || source === "cross-domain-manual") {
        setThemeState(newTheme);
        setResolvedTheme(newTheme);
        // Update localStorage to stay in sync
        localStorage.setItem("theme", newTheme);
        // Apply to DOM in case it wasn't applied
        applyThemeToDOM(newTheme);
      }
    };

    window.addEventListener("themeChanged", handleThemeChange as EventListener);

    return () => {
      window.removeEventListener(
        "themeChanged",
        handleThemeChange as EventListener
      );
    };
  }, [applyThemeToDOM]);

  // Sync with cross-domain when script loads
  useEffect(() => {
    if (hasCrossDomainSupport && window.crossDomainTheme) {
      // Get current theme from cross-domain and sync if different
      const crossDomainTheme = window.crossDomainTheme.get();
      if (crossDomainTheme !== resolvedTheme) {
        setThemeState(crossDomainTheme);
        setResolvedTheme(crossDomainTheme);
        localStorage.setItem("theme", crossDomainTheme);
        applyThemeToDOM(crossDomainTheme);
      }
    }
  }, [hasCrossDomainSupport, resolvedTheme, applyThemeToDOM]);

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemChange = (e: MediaQueryListEvent) => {
      const newResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newResolvedTheme);
      applyThemeToDOM(newResolvedTheme);

      // Sync with cross-domain
      if (hasCrossDomainSupport && window.crossDomainTheme) {
        window.crossDomainTheme.set(newResolvedTheme);
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [theme, applyThemeToDOM, hasCrossDomainSupport]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleDarkMode,
  };
}
