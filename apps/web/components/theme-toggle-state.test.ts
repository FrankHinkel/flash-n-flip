import { describe, expect, it } from "vitest";

import { themeStatusIcon } from "./theme-toggle-state";

describe("theme status icon", () => {
  it("shows the sun for the active bright theme", () => {
    expect(themeStatusIcon("bright")).toBe("sun");
  });

  it("shows the moon for the active dark theme", () => {
    expect(themeStatusIcon("dark")).toBe("moon");
  });
});
