import { describe, expect, it } from "vitest";

import {
  resolveAllowedDevOrigins,
  resolveWebBuildId,
  resolveWebBuildTime,
} from "./next.config";

describe("Next.js Web build identity", () => {
  it("uses a supplied release identity after trimming it", () => {
    expect(resolveWebBuildId("  release-123  ", () => "fallback")).toBe(
      "release-123",
    );
  });

  it("creates a fresh identity when none was supplied", () => {
    expect(resolveWebBuildId(undefined, () => "generated-build-id")).toBe(
      "generated-build-id",
    );
  });

  it("normalizes a supplied build time", () => {
    expect(resolveWebBuildTime(" 2026-08-02T23:47:08+02:00 ")).toBe(
      "2026-08-02T21:47:08.000Z",
    );
  });

  it("records the build time when none was supplied", () => {
    expect(
      resolveWebBuildTime(undefined, () => "2026-08-02T21:47:08.000Z"),
    ).toBe("2026-08-02T21:47:08.000Z");
  });

  it("rejects an invalid configured build time", () => {
    expect(() => resolveWebBuildTime("not-a-date")).toThrow(
      "FNF_WEB_BUILD_TIME must be a valid date",
    );
  });
});

describe("Next.js development origins", () => {
  it("allows the current LAN address and local host names", () => {
    expect(
      resolveAllowedDevOrigins(
        {
          lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
          en0: [
            { address: "192.168.178.184", family: "IPv4", internal: false },
          ],
          utun0: [{ address: "10.0.0.2", family: "IPv4", internal: false }],
        },
        "flash-n-flip-mac",
      ),
    ).toEqual([
      "127.0.0.1",
      "localhost",
      "flash-n-flip-mac",
      "flash-n-flip-mac.local",
      "192.168.178.184",
      "10.0.0.2",
    ]);
  });

  it("does not expose loopback or IPv6 interface entries as LAN origins", () => {
    const origins = resolveAllowedDevOrigins(
      {
        lo0: [
          { address: "::1", family: "IPv6", internal: true },
          { address: "127.0.0.1", family: "IPv4", internal: true },
        ],
        en0: [{ address: "fe80::1", family: "IPv6", internal: false }],
      },
      "",
    );

    expect(origins).toEqual(["127.0.0.1", "localhost"]);
  });
});
