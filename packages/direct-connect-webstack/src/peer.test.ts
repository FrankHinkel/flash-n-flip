import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { encryptRendezvousMessage } from "@flashcards/sync/rendezvous";

import type { TrustedPeer } from "./identity";
import {
  assertDirectDescription,
  deriveReconnectSessionSecrets,
  directWebRtcAvailable,
  directRtcConfiguration,
  joinDirectSyncInvitation,
  reconnectTrustedPeer,
} from "./peer";

beforeEach(() => {
  capacitorMocks.isNativePlatform.mockReturnValue(false);
  capacitorMocks.request.mockReset();
});

describe("direct-only WebRTC configuration", () => {
  it("derives stable but rotating unlinkable reconnect rendezvous secrets", async () => {
    const rootSecret = "A".repeat(43);
    const first = await deriveReconnectSessionSecrets(rootSecret, 12_345);
    const repeated = await deriveReconnectSessionSecrets(rootSecret, 12_345);
    const rotated = await deriveReconnectSessionSecrets(rootSecret, 12_346);

    expect(repeated).toEqual(first);
    expect(rotated.sessionId).not.toBe(first.sessionId);
    expect(rotated.encryptionKey).not.toBe(first.encryptionKey);
    expect(first.initiatorCapability).not.toBe(first.joinerCapability);
    expect(first.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

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

describe("reconnect attempt cleanup", () => {
  const apiOrigin = "https://flash-n-flip.com/api";
  const localDeviceId = "00000000-0000-4000-8000-0000000000ff";
  const peer: TrustedPeer = {
    // Sorts below the local device, so the local device joins.
    deviceId: "00000000-0000-4000-8000-000000000001",
    publicKey: "P".repeat(43),
    reconnectSecret: "A".repeat(43),
    apiOrigin,
    createdAt: "2026-08-09T12:00:00.000Z",
    updatedAt: "2026-08-09T12:00:00.000Z",
  };
  const directSdp = "v=0\r\na=candidate:1 1 UDP 1 192.0.2.1 5000 typ host\r\n";

  class GatheringPeerConnection extends EventTarget {
    // Deliberately never completes, standing in for a peer behind a slow or
    // unreachable STUN server.
    iceGatheringState = "gathering";
    connectionState = "new";
    localDescription: RTCSessionDescriptionInit | null = null;
    closed = false;

    createDataChannel(): RTCDataChannel {
      return new EventTarget() as unknown as RTCDataChannel;
    }
    async createOffer(): Promise<RTCSessionDescriptionInit> {
      return { type: "offer", sdp: directSdp };
    }
    async createAnswer(): Promise<RTCSessionDescriptionInit> {
      return { type: "answer", sdp: directSdp };
    }
    async setLocalDescription(
      description: RTCSessionDescriptionInit,
    ): Promise<void> {
      this.localDescription = description;
    }
    async setRemoteDescription(): Promise<void> {}
    close(): void {
      this.closed = true;
    }
  }

  let peerConnections: GatheringPeerConnection[] = [];
  let originalRtc: PropertyDescriptor | undefined;
  let originalWindow: PropertyDescriptor | undefined;
  let originalFetch: typeof globalThis.fetch;

  const sessionUrlFor = async (): Promise<string> => {
    const derived = await deriveReconnectSessionSecrets(
      peer.reconnectSecret,
      Math.floor(Date.now() / 60_000),
    );
    return `${apiOrigin}/rendezvous/v1/sessions/${derived.sessionId}`;
  };

  const encryptedOffer = async (): Promise<{
    messageId: string;
    encryptedPayload: string;
    sequence: number;
    createdAt: string;
  }> => {
    const slot = Math.floor(Date.now() / 60_000);
    const derived = await deriveReconnectSessionSecrets(
      peer.reconnectSecret,
      slot,
    );
    const messageId = crypto.randomUUID();
    return {
      messageId,
      encryptedPayload: await encryptRendezvousMessage({
        sessionId: derived.sessionId,
        encryptionKey: derived.encryptionKey,
        message: {
          version: 1,
          messageId,
          kind: "OFFER",
          payload: { type: "offer", sdp: directSdp },
          sentAt: new Date().toISOString(),
        },
      }),
      sequence: 1,
      createdAt: new Date().toISOString(),
    };
  };

  const jsonResponse = (body: unknown): Response =>
    ({
      ok: true,
      status: 200,
      json: async () => body,
    }) as unknown as Response;

  beforeEach(() => {
    peerConnections = [];
    originalRtc = Object.getOwnPropertyDescriptor(
      globalThis,
      "RTCPeerConnection",
    );
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "RTCPeerConnection", {
      configurable: true,
      writable: true,
      value: function RTCPeerConnectionMock(this: unknown) {
        const created = new GatheringPeerConnection();
        peerConnections.push(created);
        return created;
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: globalThis,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "RTCPeerConnection");
    Reflect.deleteProperty(globalThis, "window");
    if (originalRtc) {
      Object.defineProperty(globalThis, "RTCPeerConnection", originalRtc);
    }
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    }
  });

  it("discards the rendezvous session when an attempt fails after reading a description", async () => {
    const sessionUrl = await sessionUrlFor();
    const offer = await encryptedOffer();
    const calls: Array<{ method: string; url: string }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url });
      if (method === "POST" && url.endsWith("/join")) return jsonResponse({});
      if (method === "GET" && url.startsWith(`${sessionUrl}/signals`)) {
        return jsonResponse({ signals: [offer] });
      }
      if (method === "POST" && url === `${sessionUrl}/signals`) {
        throw new Error("answer could not be published");
      }
      if (method === "DELETE" && url === sessionUrl) return jsonResponse({});
      throw new Error(`unexpected request ${method} ${url}`);
    }) as unknown as typeof globalThis.fetch;

    await expect(
      reconnectTrustedPeer(localDeviceId, peer, { timeoutMs: 8_000 }),
    ).rejects.toThrow("answer could not be published");

    expect(calls).toContainEqual({ method: "DELETE", url: sessionUrl });
    expect(peerConnections.at(0)?.closed).toBe(true);
  });

  it("keeps an untouched rendezvous session so a late peer can still join", async () => {
    const sessionUrl = await sessionUrlFor();
    const calls: Array<{ method: string; url: string }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url });
      if (method === "POST" && url.endsWith("/join")) return jsonResponse({});
      if (method === "GET" && url.startsWith(`${sessionUrl}/signals`)) {
        throw new Error("signal poll failed");
      }
      throw new Error(`unexpected request ${method} ${url}`);
    }) as unknown as typeof globalThis.fetch;

    await expect(
      reconnectTrustedPeer(localDeviceId, peer, { timeoutMs: 8_000 }),
    ).rejects.toThrow("signal poll failed");

    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(peerConnections.at(0)?.closed).toBe(true);
  });

  it("publishes the answer instead of spending the whole attempt gathering ICE", async () => {
    const sessionUrl = await sessionUrlFor();
    const offer = await encryptedOffer();
    const startedAt = Date.now();
    let answeredAfterMs: number | null = null;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url.endsWith("/join")) return jsonResponse({});
      if (method === "GET" && url.startsWith(`${sessionUrl}/signals`)) {
        return jsonResponse({ signals: [offer] });
      }
      if (method === "POST" && url === `${sessionUrl}/signals`) {
        answeredAfterMs = Date.now() - startedAt;
        throw new Error("stop after answer");
      }
      if (method === "DELETE" && url === sessionUrl) return jsonResponse({});
      throw new Error(`unexpected request ${method} ${url}`);
    }) as unknown as typeof globalThis.fetch;

    await expect(
      // The reserve for the description exchange already consumes this budget,
      // so gathering must not delay the answer at all.
      reconnectTrustedPeer(localDeviceId, peer, { timeoutMs: 8_000 }),
    ).rejects.toThrow("stop after answer");

    expect(answeredAfterMs).not.toBeNull();
    expect(answeredAfterMs!).toBeLessThan(2_000);
    expect(peerConnections.at(0)?.iceGatheringState).toBe("gathering");
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
