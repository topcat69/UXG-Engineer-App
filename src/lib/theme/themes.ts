// Pure, no "server-only" import — used from both the server (root layout,
// picking the initial class) and the client (the switcher's optimistic
// swap), same split as lib/forms/job-form.ts's predicates.

export const THEMES = ["light", "dark", "blue", "forest", "slate"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  blue: "Blue",
  forest: "Forest",
  slate: "Slate",
};

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

/**
 * The <html> class a theme needs, matching globals.css's selectors exactly:
 * "light" is the unstyled default (:root already is the light palette, so
 * it needs no class at all), "dark" reuses the existing .dark class, and
 * every other theme gets its own .theme-{name} class. Falls back to "" for
 * an unrecognized value (e.g. a stale users.theme from before a theme was
 * removed) rather than throwing — same reasoning as jobDetailsRowToValues'
 * defaulting, a bad stored value should degrade to the default look, not
 * break the page.
 */
export function themeClassName(theme: string): string {
  if (!isTheme(theme) || theme === "light") return "";
  if (theme === "dark") return "dark";
  return `theme-${theme}`;
}

/** Every class name any theme could apply — for the switcher to strip before applying the new one. */
export const ALL_THEME_CLASSNAMES: string[] = THEMES.map(themeClassName).filter(Boolean);
