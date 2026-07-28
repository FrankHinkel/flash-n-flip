import { describe, expect, it } from "vitest";

import {
  emailMatchesAllowedDomains,
  normalizeEmailDomain,
} from "./auth-access-policy.js";

describe("private authentication access policy", () => {
  it("accepts the configured domain case-insensitively", () => {
    expect(emailMatchesAllowedDomains("Frank@HI-SYS.DE", ["hi-sys.de"])).toBe(
      true,
    );
  });

  it.each([
    "frank@not-hi-sys.de",
    "frank@sub.hi-sys.de",
    "frank@hi-sys.de.example",
    "hi-sys.de",
  ])("rejects non-exact domain address %s", (email) => {
    expect(emailMatchesAllowedDomains(email, ["hi-sys.de"])).toBe(false);
  });

  it("normalizes configured domains", () => {
    expect(normalizeEmailDomain(" @HI-SYS.DE ")).toBe("hi-sys.de");
  });
});
