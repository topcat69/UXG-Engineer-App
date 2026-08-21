import { describe, expect, it } from "vitest";
import { ALL_THEME_CLASSNAMES, THEMES, THEME_LABELS, themeClassName } from "./themes";

describe("themeClassName", () => {
  it("needs no class for light — the default :root palette already is light", () => {
    expect(themeClassName("light")).toBe("");
  });

  it("reuses the existing .dark class for dark", () => {
    expect(themeClassName("dark")).toBe("dark");
  });

  it("prefixes every other theme with theme-", () => {
    expect(themeClassName("blue")).toBe("theme-blue");
    expect(themeClassName("forest")).toBe("theme-forest");
    expect(themeClassName("navy")).toBe("theme-navy");
  });

  it("degrades an unrecognized value to the default look rather than throwing", () => {
    expect(themeClassName("not-a-real-theme")).toBe("");
  });
});

describe("THEMES / THEME_LABELS", () => {
  it("has a label for every theme, and no extra labels", () => {
    expect(Object.keys(THEME_LABELS).sort()).toEqual([...THEMES].sort());
  });
});

describe("ALL_THEME_CLASSNAMES", () => {
  it("lists every non-empty class name once, excluding light's empty string", () => {
    expect(ALL_THEME_CLASSNAMES).toEqual(["dark", "theme-blue", "theme-forest", "theme-navy"]);
  });
});
