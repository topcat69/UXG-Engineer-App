"use client";

import { useTransition } from "react";
import { updateTheme } from "@/lib/theme/actions";
import { ALL_THEME_CLASSNAMES, THEMES, THEME_LABELS, themeClassName, type Theme } from "@/lib/theme/themes";

/**
 * Applies the picked theme to <html> immediately, client-side, rather than
 * waiting on the server action's round trip + revalidation — the theme
 * class is what the root layout renders on every subsequent full page
 * load (see layout.tsx), but a same-session switch shouldn't have to wait
 * for that to feel instant.
 */
function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove(...ALL_THEME_CLASSNAMES);
  const className = themeClassName(theme);
  if (className) root.classList.add(className);
}

export function ThemeSwitcher({ currentTheme }: { currentTheme: string }) {
  const [, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const theme = event.target.value as Theme;
    applyThemeClass(theme);
    startTransition(async () => {
      await updateTheme(theme);
    });
  }

  return (
    <select
      aria-label="Theme"
      defaultValue={currentTheme}
      onChange={handleChange}
      className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
    >
      {THEMES.map((theme) => (
        <option key={theme} value={theme}>
          {THEME_LABELS[theme]}
        </option>
      ))}
    </select>
  );
}
