import { describe, expect, it } from "vitest";

import { resolveDeviceConnectionStatus } from "./device-connection-status";

describe("device connection status", () => {
  it.each([
    {
      input: {
        directConnected: false,
        pairedDeviceAvailable: true,
        serverReachable: true,
      },
      expected: "VPS_INTERNET",
    },
    {
      input: {
        directConnected: true,
        pairedDeviceAvailable: true,
        serverReachable: true,
      },
      expected: "VPS_LAN",
    },
    {
      input: {
        directConnected: true,
        pairedDeviceAvailable: true,
        serverReachable: false,
      },
      expected: "LOCAL_LAN",
    },
    {
      input: {
        directConnected: false,
        pairedDeviceAvailable: false,
        serverReachable: true,
      },
      expected: "VPS_ONLY",
    },
    {
      input: {
        directConnected: false,
        pairedDeviceAvailable: true,
        serverReachable: false,
      },
      expected: "DISCONNECTED",
    },
  ] as const)(
    "resolves $expected without ambiguous color-only state",
    ({ input, expected }) => {
      expect(resolveDeviceConnectionStatus(input)).toBe(expected);
    },
  );
});
