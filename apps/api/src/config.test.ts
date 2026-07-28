import { describe, expect, it } from "vitest";

import { readConfig } from "./config.js";

describe("private access configuration", () => {
  it("uses the private production defaults", () => {
    const config = readConfig({});
    expect(config.AUTH_ALLOWED_EMAIL_DOMAINS).toEqual(["hi-sys.de"]);
    expect(config.PUBLIC_REGISTRATION_ENABLED).toBe(false);
  });

  it("normalizes an explicit domain allowlist", () => {
    const config = readConfig({
      AUTH_ALLOWED_EMAIL_DOMAINS: "@HI-SYS.DE, example.org",
      PUBLIC_REGISTRATION_ENABLED: "true",
    });
    expect(config.AUTH_ALLOWED_EMAIL_DOMAINS).toEqual([
      "hi-sys.de",
      "example.org",
    ]);
    expect(config.PUBLIC_REGISTRATION_ENABLED).toBe(true);
  });

  it("rejects malformed allowed domains", () => {
    expect(() =>
      readConfig({ AUTH_ALLOWED_EMAIL_DOMAINS: "hi-sys.de.example/path" }),
    ).toThrow();
  });
});
