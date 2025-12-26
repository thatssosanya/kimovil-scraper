import { useEffect, useState } from "react";
import { type ResolvedTheme } from "./useCrossDomainTheme";

/**
 * Hook to initialize cross-domain theme management
 * directly without loading external files
 */
export function useCrossDomainScript() {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isScriptError, setIsScriptError] = useState(false);

  useEffect(() => {
    // Check if already initialized
    if (window.crossDomainTheme) {
      setIsScriptLoaded(true);
      return;
    }

    try {
      // Initialize cross-domain theme management directly
      window.crossDomainTheme = {
        get: () => {
          const savedTheme = localStorage.getItem("theme") as
            | "light"
            | "dark"
            | null;
          if (savedTheme) return savedTheme;

          // Fallback to system theme
          return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
        },

        set: (theme: "light" | "dark") => {
          document.documentElement.setAttribute("data-theme", theme);
          localStorage.setItem("theme", theme);

          // Set cookie for cross-domain sync
          document.cookie = `cod-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;

          // Apply theme classes
          if (theme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }

          // Dispatch theme change event
          window.dispatchEvent(
            new CustomEvent("themeChanged", {
              detail: { theme, source: "cross-domain-manual" },
            })
          );

          // Broadcast to other windows/tabs
          try {
            window.postMessage({ type: "THEME_CHANGE", theme }, "*");
          } catch (e) {
            console.warn("Could not broadcast theme change:", e);
          }
        },

        toggle: () => {
          const currentTheme = window.crossDomainTheme!.get();
          const newTheme: "light" | "dark" =
            currentTheme === "dark" ? "light" : "dark";
          window.crossDomainTheme!.set(newTheme);
          return newTheme;
        },

        apply: (theme: "light" | "dark") => {
          document.documentElement.setAttribute("data-theme", theme);

          // Apply theme classes
          if (theme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        },
      };

      // Initialize theme on first load
      const initialTheme = window.crossDomainTheme.get();
      window.crossDomainTheme.apply(initialTheme);

      // Listen for system theme changes
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          if (!localStorage.getItem("theme")) {
            const newTheme = e.matches ? "dark" : "light";
            window.crossDomainTheme!.apply(newTheme);
          }
        });

      // Listen for cross-tab theme changes
      window.addEventListener("message", (event) => {
        const data = event.data as { type: string; theme: string };
        if (!data) return;
        const { type, theme } = data;
        if (
          typeof type === "string" &&
          type === "THEME_CHANGE" &&
          typeof theme === "string"
        ) {
          window.crossDomainTheme!.apply(theme as ResolvedTheme); // eslint-disable-line @typescript-eslint/no-unsafe-argument
          // Also dispatch event for local listeners
          window.dispatchEvent(
            new CustomEvent("themeChanged", {
              detail: { theme, source: "cross-domain-sync" },
            })
          );
        }
      });

      setIsScriptLoaded(true);
    } catch (error) {
      console.warn("Failed to initialize cross-domain theme:", error);
      setIsScriptError(true);
    }
  }, []);

  return {
    isScriptLoaded,
    isScriptError,
    hasCrossDomainSupport: isScriptLoaded && !!window.crossDomainTheme,
  };
}
