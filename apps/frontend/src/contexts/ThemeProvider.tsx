import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type Theme, type ThemeContextValue } from "@/contexts/theme";

const STORAGE_KEY = "start-back-theme";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    toggleTheme: () => setTheme((current) => current === "light" ? "dark" : "light")
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

