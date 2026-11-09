"use client";

import * as React from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getPreferredTheme(): Theme {
  const savedTheme = window.localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [resolvedTheme, setResolvedTheme] = React.useState<Theme>(() =>
    typeof window === "undefined" ? "light" : getPreferredTheme(),
  );

  const setTheme = React.useCallback((theme: Theme) => {
    window.localStorage.setItem("theme", theme);
    setResolvedTheme(theme);
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return <ThemeContext.Provider value={{ resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");

  return context;
}
