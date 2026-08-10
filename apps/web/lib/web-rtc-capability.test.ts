import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWebRtcPeerConnection,
  webRtcPeerConnectionAvailable,
} from "./web-rtc-capability";

afterEach(() => vi.unstubAllGlobals());

describe("WebRTC platform capability", () => {
  it("reports a missing Mac WKWebView API without evaluating a bare global", () => {
    vi.stubGlobal("RTCPeerConnection", undefined);

    expect(webRtcPeerConnectionAvailable()).toBe(false);
    expect(() => createWebRtcPeerConnection({})).toThrow(/Mac-Browser öffnen/);
  });

  it("constructs the available browser implementation", () => {
    const constructor = vi.fn(function MockPeerConnection() {});
    vi.stubGlobal("RTCPeerConnection", constructor);

    expect(webRtcPeerConnectionAvailable()).toBe(true);
    expect(createWebRtcPeerConnection({ iceServers: [] })).toBeInstanceOf(
      constructor,
    );
    expect(constructor).toHaveBeenCalledWith({ iceServers: [] });
  });
});
