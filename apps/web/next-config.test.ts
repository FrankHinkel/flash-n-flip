import { describe, expect, it } from "vitest";

import { resolveAllowedDevOrigins } from "./next.config";

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
