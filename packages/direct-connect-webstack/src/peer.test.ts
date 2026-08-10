import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  request: vi.fn(),
  nativePlugin: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
  },
  CapacitorHttp: {
    request: capacitorMocks.request,
  },
  registerPlugin: vi.fn(() => capacitorMocks.nativePlugin),
}));

import {
  assertDirectDescription,
  directWebRtcAvailable,
  directRtcConfiguration,
  joinDirectSyncInvitation,
} from "./peer";

beforeEach(() => {
  capacitorMocks.isNativePlatform.mockReturnValue(false);
  capacitorMocks.request.mockReset();
});

describe("direct-only WebRTC configuration", () => {
  it("reports missing WebRTC without evaluating an undefined global", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "RTCPeerConnection",
    );
    Reflect.deleteProperty(globalThis, "RTCPeerConnection");
    expect(directWebRtcAvailable()).toBe(false);
    if (descriptor) {
      Object.defineProperty(globalThis, "RTCPeerConnection", descriptor);
    }
  });

  it("reports native WebRTC on an Apple runtime without the WebView global", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "RTCPeerConnection",
    );
    Reflect.deleteProperty(globalThis, "RTCPeerConnection");
    expect(directWebRtcAvailable()).toBe(true);
    if (descriptor) {
      Object.defineProperty(globalThis, "RTCPeerConnection", descriptor);
    }
  });

  it("uses STUN without configuring TURN", () => {
    expect(directRtcConfiguration("https://flash-n-flip.com/api")).toEqual({
      iceServers: [{ urls: "stun:flash-n-flip.com:3478" }],
      iceTransportPolicy: "all",
    });
  });

  it("rejects relay candidates before encrypted signaling", () => {
    expect(() =>
      assertDirectDescription({
        type: "offer",
        sdp: "v=0\r\na=candidate:1 1 UDP 1 203.0.113.1 5000 typ relay raddr 0.0.0.0 rport 0\r\n",
      }),
    ).toThrow(/turn relay/i);
  });
});

describe("native rendezvous transport", () => {
  it("sends the join as an explicit JSON request through CapacitorHttp", async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.request.mockRejectedValueOnce(
      new Error("stop after captured join"),
    );

    await expect(
      joinDirectSyncInvitation({
        version: 1,
        apiOrigin: "https://flash-n-flip.com/api/",
        sessionId: "019fe571-738e-7bd0-b0d0-bbce8a5d00d5",
        joinerCapability: "joiner-capability",
        encryptionKey: "encryption-key",
        expiresAt: "2999-08-09T12:00:00.000Z",
      }),
    ).rejects.toThrow("stop after captured join");

    expect(capacitorMocks.request).toHaveBeenCalledOnce();
    expect(capacitorMocks.request).toHaveBeenCalledWith({
      method: "POST",
      url: "https://flash-n-flip.com/api/rendezvous/v1/sessions/019fe571-738e-7bd0-b0d0-bbce8a5d00d5/join",
      headers: {
        authorization: "Rendezvous joiner-capability",
        "content-type": "application/json",
      },
      data: {},
      connectTimeout: 10_000,
      readTimeout: 15_000,
    });
  });
});
