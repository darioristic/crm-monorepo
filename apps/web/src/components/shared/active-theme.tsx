"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, type ThemeType } from "@/lib/themes";

async function setThemeCookie(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  const cs = (
    window as unknown as {
      cookieStore?: {
        set: (opts: unknown) => Promise<unknown>;
        delete: (name: string) => Promise<unknown>;
      };
    }
  ).cookieStore;
  if (!cs) return;
  if (!value) {
    await cs.delete(key);
    return;
  }
  await cs.set({
    name: key,
    value,
    sameSite: "lax",
    secure: window.location.protocol === "https:",
    path: "/",
  });
}

type ThemeContextType = {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: ThemeType;
}) {
  const [theme, setTheme] = useState<ThemeType>(() =>
    initialTheme ? initialTheme : DEFAULT_THEME
  );

  useEffect(() => {
    const body = document.body;

    void setThemeCookie("theme_radius", theme.radius);
    body.setAttribute("data-theme-radius", theme.radius);

    if (theme.radius !== "default") {
      void setThemeCookie("theme_preset", theme.radius);
      body.setAttribute("data-theme-radius", theme.radius);
    } else {
      void setThemeCookie("theme_preset", null);
      body.removeAttribute("data-theme-radius");
    }

    if (theme.preset !== "default") {
      setThemeCookie("theme_preset", theme.preset);
      body.setAttribute("data-theme-preset", theme.preset);
    } else {
      setThemeCookie("theme_preset", null);
      body.removeAttribute("data-theme-preset");
    }

    void setThemeCookie("theme_content_layout", theme.contentLayout);
    body.setAttribute("data-theme-content-layout", theme.contentLayout);

    if (theme.scale !== "none") {
      void setThemeCookie("theme_scale", theme.scale);
      body.setAttribute("data-theme-scale", theme.scale);
    } else {
      void setThemeCookie("theme_scale", null);
      body.removeAttribute("data-theme-scale");
    }
  }, [theme.preset, theme.radius, theme.scale, theme.contentLayout]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeConfig must be used within an ActiveThemeProvider");
  }
  return context;
}
