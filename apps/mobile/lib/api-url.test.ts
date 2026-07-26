import { describe, expect, it } from "vitest";

import { resolveMobileApiUrl } from "./api-url";

describe("resolveMobileApiUrl", () => {
  it("uses the Metro LAN host for a loopback development API", () => {
    expect(
      resolveMobileApiUrl(
        "http://127.0.0.1:4000",
        "192.168.178.184:8081",
        true,
      ),
    ).toBe("http://192.168.178.184:4000");
  });

  it("keeps loopback when Metro itself runs on loopback", () => {
    expect(
      resolveMobileApiUrl("http://127.0.0.1:4000", "127.0.0.1:8081", true),
    ).toBe("http://127.0.0.1:4000");
  });

  it("does not rewrite production or explicitly remote APIs", () => {
    expect(
      resolveMobileApiUrl(
        "http://127.0.0.1:4000",
        "192.168.178.184:8081",
        false,
      ),
    ).toBe("http://127.0.0.1:4000");
    expect(
      resolveMobileApiUrl(
        "https://api.flash-n-flip.com/",
        "192.168.178.184:8081",
        true,
      ),
    ).toBe("https://api.flash-n-flip.com");
  });

  it("leaves malformed configuration untouched", () => {
    expect(resolveMobileApiUrl("not a URL/", "192.168.1.2:8081", true)).toBe(
      "not a URL",
    );
  });
});
