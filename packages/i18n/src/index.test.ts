import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  isLocale,
  product,
  selectTranslation,
  translate,
} from "./index.js";

describe("translations", () => {
  it("provides matching German and English keys", () => {
    expect(translate("de", "study", "reveal")).toBe("Antwort zeigen");
    expect(translate("en", "study", "reveal")).toBe("Show answer");
  });

  it("uses English as the leading default", () => {
    expect(defaultLocale).toBe("en");
    expect(selectTranslation(defaultLocale, "Settings", "Einstellungen")).toBe(
      "Settings",
    );
  });

  it("publishes the canonical product identity and supported locales", () => {
    expect(product).toEqual({
      name: "Flash-n-Flip",
      domain: "flash-n-flip.com",
      motto: "Flash, Flip and Remember",
    });
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
