import { describe, expect, it } from "vitest";

import { getMobileLanguageName } from "./language-name";

describe("getMobileLanguageName", () => {
  it("uses a deterministic fallback when Hermes has no Intl.DisplayNames", () => {
    expect(getMobileLanguageName("fr", "de", null)).toBe("Französisch");
    expect(getMobileLanguageName("es-MX", "en", null)).toBe("Spanish");
  });

  it("falls back to the language code for an unknown locale", () => {
    expect(getMobileLanguageName("nl", "de", null)).toBe("NL");
  });

  it("uses Intl.DisplayNames when the runtime provides it", () => {
    class FakeDisplayNames {
      of(code: string) {
        return `language:${code}`;
      }
    }

    expect(getMobileLanguageName("fr", "de", FakeDisplayNames)).toBe(
      "language:fr",
    );
  });
});
