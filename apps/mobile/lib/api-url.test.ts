import { describe, expect, it } from "vitest";

import { resolveMobileApiUrl } from "./api-url";

describe("resolveMobileApiUrl", () => {
  it("uses localhost by default in the iOS simulator", () => {
    expect(
      resolveMobileApiUrl(
        undefined,
        "https://flash-n-flip.com/api",
        "192.168.178.184:8081",
        true,
        { isDevice: false, platform: "ios" },
      ),
    ).toBe("http://127.0.0.1:4000");
  });

  it("does not rewrite an explicit loopback URL in the iOS simulator", () => {
    expect(
      resolveMobileApiUrl(
        "http://127.0.0.1:4000",
        "https://flash-n-flip.com/api",
        "192.168.178.184:8081",
        true,
        { isDevice: false, platform: "ios" },
      ),
    ).toBe("http://127.0.0.1:4000");
  });

  it("uses the Android emulator host alias for a local API", () => {
    expect(
      resolveMobileApiUrl(
        undefined,
        "https://flash-n-flip.com/api",
        "127.0.0.1:8081",
        true,
        { isDevice: false, platform: "android" },
      ),
    ).toBe("http://10.0.2.2:4000");
  });

  it("uses the Metro LAN host for a loopback API on a physical device", () => {
    expect(
      resolveMobileApiUrl(
        "http://127.0.0.1:4000",
        "https://flash-n-flip.com/api",
        "192.168.178.184:8081",
        true,
        { isDevice: true, platform: "ios" },
      ),
    ).toBe("http://192.168.178.184:4000");
  });

  it("keeps the bundled API on a physical device without an explicit override", () => {
    expect(
      resolveMobileApiUrl(
        undefined,
        "https://flash-n-flip.com/api",
        "192.168.178.184:8081",
        true,
        { isDevice: true, platform: "ios" },
      ),
    ).toBe("https://flash-n-flip.com/api");
  });

  it("does not rewrite production or explicitly remote APIs", () => {
    expect(
      resolveMobileApiUrl(
        undefined,
        "https://flash-n-flip.com/api/",
        "192.168.178.184:8081",
        false,
        { isDevice: false, platform: "ios" },
      ),
    ).toBe("https://flash-n-flip.com/api");
    expect(
      resolveMobileApiUrl(
        "https://api.flash-n-flip.com/",
        "https://flash-n-flip.com/api",
        "192.168.178.184:8081",
        true,
        { isDevice: true, platform: "ios" },
      ),
    ).toBe("https://api.flash-n-flip.com");
  });

  it("leaves malformed configuration untouched", () => {
    expect(
      resolveMobileApiUrl(
        "not a URL/",
        "https://flash-n-flip.com/api",
        "192.168.1.2:8081",
        true,
        { isDevice: true, platform: "ios" },
      ),
    ).toBe("not a URL");
  });
});
