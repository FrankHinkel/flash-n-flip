import { describe, expect, it } from "vitest";

import { assertDirectDescription, directRtcConfiguration } from "./peer";

describe("direct-only WebRTC configuration", () => {
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
