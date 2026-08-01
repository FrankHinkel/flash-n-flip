import { describe, expect, it } from "vitest";

import config from "../app.json";

describe("native production configuration", () => {
  it("uses the public HTTPS API when no build override is supplied", () => {
    expect(config.expo.extra.apiUrl).toBe("https://flash-n-flip.com/api");
  });

  it("uses the registered Flash-n-Flip iOS bundle identifier", () => {
    expect(config.expo.ios.bundleIdentifier).toBe("com.flash-n-flip");
  });
});
