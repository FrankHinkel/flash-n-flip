import { describe, expect, it } from "vitest";

import { translate } from "./index.js";

describe("translations", () => {
  it("provides matching German and English keys", () => {
    expect(translate("de", "study", "reveal")).toBe("Antwort zeigen");
    expect(translate("en", "study", "reveal")).toBe("Show answer");
  });
});
