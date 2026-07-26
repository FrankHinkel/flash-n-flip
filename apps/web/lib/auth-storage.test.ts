import { describe, expect, it } from "vitest";

import {
  browserAuthStorageKey,
  hasBrowserSessionHint,
  legacyBrowserAuthStorageKey,
} from "./auth-storage";

const storageWith = (values: Record<string, string>) => ({
  getItem(key: string) {
    return values[key] ?? null;
  },
});

describe("browser session hint", () => {
  it("is absent for a new browser", () => {
    expect(hasBrowserSessionHint(storageWith({}))).toBe(false);
  });

  it("recognizes the current token storage key", () => {
    expect(
      hasBrowserSessionHint(
        storageWith({ [browserAuthStorageKey]: '{"accessToken":"token"}' }),
      ),
    ).toBe(true);
  });

  it("keeps migrated sessions redirectable", () => {
    expect(
      hasBrowserSessionHint(
        storageWith({ [legacyBrowserAuthStorageKey]: '{"accessToken":"old"}' }),
      ),
    ).toBe(true);
  });
});
