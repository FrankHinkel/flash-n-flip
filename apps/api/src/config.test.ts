import { describe, expect, it } from "vitest";

import { readConfig } from "./config.js";

describe("private access configuration", () => {
  it("uses the private production defaults", () => {
    const config = readConfig({});
    expect(config.PUBLIC_REGISTRATION_ENABLED).toBe(false);
  });

  it("allows public registration to be configured explicitly", () => {
    const config = readConfig({
      PUBLIC_REGISTRATION_ENABLED: "true",
    });
    expect(config.PUBLIC_REGISTRATION_ENABLED).toBe(true);
  });
});
