import { describe, expect, it } from "vitest";

import { isLocalDevelopmentHostname } from "./local-development-runtime";

describe("local development runtime", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "app.localhost",
    "127.0.0.1",
    "::1",
    "[::1]",
  ])("allows the loopback hostname %s", (hostname) => {
    expect(isLocalDevelopmentHostname(hostname)).toBe(true);
  });

  it.each([
    "flash-n-flip.com",
    "flash-n-flip.test",
    "192.168.1.10",
    "localhost.example",
  ])("does not weaken the installed-app boundary for %s", (hostname) => {
    expect(isLocalDevelopmentHostname(hostname)).toBe(false);
  });
});
