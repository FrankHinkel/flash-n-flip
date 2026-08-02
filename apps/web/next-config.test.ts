import { describe, expect, it } from "vitest";

import {
  resolveAllowedDevOrigins,
  resolveApiProxyUploadSettings,
  resolveWebBuildId,
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

describe("Next.js API upload proxy", () => {
  it("accepts the complete default APKG upload plus multipart framing", () => {
    expect(resolveApiProxyUploadSettings({})).toEqual({
      maxBodySize: 257 * 1024 * 1024,
      timeoutMs: 15 * 60 * 1000,
    });
  });

  it("follows the API APKG upload limit from the environment", () => {
    expect(
      resolveApiProxyUploadSettings({ APKG_MAX_UPLOAD_BYTES: "62960644" }),
    ).toEqual({
      maxBodySize: 62960644 + 1024 * 1024,
      timeoutMs: 15 * 60 * 1000,
    });
  });

  it.each(["", "not-a-number", "-1", "1.5"])(
    "falls back safely for an invalid APKG limit: %s",
    (value) => {
      expect(
        resolveApiProxyUploadSettings({ APKG_MAX_UPLOAD_BYTES: value }),
      ).toEqual({
        maxBodySize: 257 * 1024 * 1024,
        timeoutMs: 15 * 60 * 1000,
      });
    },
  );
});
