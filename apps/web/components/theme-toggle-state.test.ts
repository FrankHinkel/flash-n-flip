import { describe, expect, it } from "vitest";

import { themeStatusIcon, themeToggleVisibleAtPath } from "./theme-toggle-state";

describe("theme status icon", () => {
  it("shows the sun for the active bright theme", () => {
    expect(themeStatusIcon("bright")).toBe("sun");
  });

  it("shows the moon for the active dark theme", () => {
    expect(themeStatusIcon("dark")).toBe("moon");
  });
});

describe("theme toggle routes", () => {
  it("hides the Flash-n-Flip control on all Pianoforte public pages", () => {
    expect(themeToggleVisibleAtPath("/pianoforte")).toBe(false);
    expect(themeToggleVisibleAtPath("/pianoforte/privacy")).toBe(false);
    expect(themeToggleVisibleAtPath("/pianoforte/support")).toBe(false);
    expect(themeToggleVisibleAtPath("/app")).toBe(true);
    expect(themeToggleVisibleAtPath("/pianoforte-extra")).toBe(true);
  });
});
