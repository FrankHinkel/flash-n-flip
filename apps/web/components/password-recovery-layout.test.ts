import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authForm = readFileSync(
  new URL("./auth-form.tsx", import.meta.url),
  "utf8",
);
const resetForm = readFileSync(
  new URL("./password-reset-form.tsx", import.meta.url),
  "utf8",
);
const securitySettings = readFileSync(
  new URL("./password-security-settings.tsx", import.meta.url),
  "utf8",
);

describe("password recovery UI", () => {
  it("links sign-in to the no-email recovery route", () => {
    expect(authForm).toContain('href="/password-reset"');
    expect(resetForm).toContain('autoComplete="one-time-code"');
    expect(resetForm).toContain('autoComplete="new-password"');
    expect(resetForm).toContain('role="alert"');
  });

  it("keeps password change and code creation keyboard accessible", () => {
    expect(securitySettings).toContain("aria-expanded={changeOpen}");
    expect(securitySettings).toContain("aria-expanded={recoveryOpen}");
    expect(securitySettings).toContain('autoComplete="current-password"');
    expect(securitySettings).toContain('aria-label={text("Copy recovery code"');
  });
});
