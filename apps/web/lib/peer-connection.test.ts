import { afterEach, describe, expect, it, vi } from "vitest";

import {
  directConnectionRtcConfiguration,
  establishPairingPeerConnection,
  isRelayIceCandidate,
  sdpSha256Fingerprint,
  type PairingConnectionStatus,
  waitForIceGatheringComplete,
} from "./peer-connection";

const offer = {
  type: "offer" as const,
  sdp: "v=0\r\na=fingerprint:sha-256 AA:BB:0C\r\na=setup:actpass\r\n",
};

class FakeDataChannel extends EventTarget {
  binaryType: BinaryType = "blob";
  bufferedAmountLowThreshold = 0;
  readyState: RTCDataChannelState = "connecting";

  open() {
    this.readyState = "open";
    this.dispatchEvent(new Event("open"));
  }
}

class FakePeerConnection extends EventTarget {
  connectionState: RTCPeerConnectionState = "new";
  iceGatheringState: RTCIceGatheringState = "complete";
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  readonly channel = new FakeDataChannel();
  closeCalls = 0;

  createDataChannel() {
    return this.channel as unknown as RTCDataChannel;
  }

  async createOffer() {
    return offer;
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description as RTCSessionDescription;
  }

  close() {
    this.closeCalls += 1;
    this.connectionState = "closed";
    this.dispatchEvent(new Event("connectionstatechange"));
  }

  completeIceGathering() {
    this.iceGatheringState = "complete";
    this.dispatchEvent(new Event("icegatheringstatechange"));
  }
}

const session = {
  id: "00000000-0000-4000-8000-000000000001",
  initiatorDeviceId: "00000000-0000-4000-8000-000000000002",
  joiningDeviceId: "00000000-0000-4000-8000-000000000003",
  state: "CONFIRMED" as const,
  mode: "MANUAL" as const,
  initiatorEphemeralPublicKey: "a".repeat(64),
  initiatorFingerprintProof: "b".repeat(64),
  joiningEphemeralPublicKey: "c".repeat(64),
  joiningFingerprintProof: "d".repeat(64),
  initiatorConfirmed: true,
  joiningConfirmed: true,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  createdAt: new Date().toISOString(),
  consumedAt: null,
};

const sentSignal = {
  id: "00000000-0000-4000-8000-000000000004",
  sessionId: session.id,
  senderDeviceId: session.initiatorDeviceId,
  recipientDeviceId: session.joiningDeviceId,
  sequence: 1,
  type: "OFFER" as const,
  payload: "{}",
  createdAt: new Date().toISOString(),
};

afterEach(() => vi.unstubAllGlobals());

describe("peer connection signaling", () => {
  it("uses same-origin STUN without configuring a relay", () => {
    expect(directConnectionRtcConfiguration("flash-n-flip.com")).toEqual({
      iceServers: [{ urls: "stun:flash-n-flip.com:3478" }],
      iceTransportPolicy: "all",
      iceCandidatePoolSize: 1,
    });
    expect(directConnectionRtcConfiguration("localhost").iceServers).toEqual(
      [],
    );
  });

  it("recognizes and rejects TURN relay candidates", () => {
    expect(
      isRelayIceCandidate(
        "candidate:1 1 udp 1 203.0.113.1 50000 typ relay raddr 0.0.0.0 rport 0",
      ),
    ).toBe(true);
    expect(
      isRelayIceCandidate(
        "candidate:2 1 udp 1 192.168.1.20 50000 typ host generation 0",
      ),
    ).toBe(false);
    expect(() =>
      sdpSha256Fingerprint(
        `${offer.sdp}a=candidate:1 1 udp 1 203.0.113.1 50000 typ relay\r\n`,
      ),
    ).toThrow(/relay candidates are not allowed/i);
  });

  it("waits for a complete ICE description before signaling", async () => {
    vi.stubGlobal("window", globalThis);
    const connection = new FakePeerConnection();
    connection.iceGatheringState = "gathering";
    let completed = false;
    const waiting = waitForIceGatheringComplete(
      connection as unknown as RTCPeerConnection,
      1_000,
    ).then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(completed).toBe(false);
    connection.completeIceGathering();
    await waiting;
    expect(completed).toBe(true);
  });

  it("extracts and normalizes the SHA-256 DTLS fingerprint", () => {
    expect(
      sdpSha256Fingerprint(
        "v=0\r\na=fingerprint:sha-256 aa:bb:0c\r\na=setup:actpass\r\n",
      ),
    ).toBe("AA:BB:0C");
  });

  it("rejects descriptions without a SHA-256 fingerprint", () => {
    expect(() => sdpSha256Fingerprint("v=0\r\na=setup:actpass\r\n")).toThrow(
      /fingerprint is missing/i,
    );
  });

  it("stops terminal signaling failures instead of polling forever", async () => {
    vi.stubGlobal("window", globalThis);
    const connection = new FakePeerConnection();
    const statuses: PairingConnectionStatus[] = [];
    let pollCalls = 0;

    await establishPairingPeerConnection({
      session,
      localDeviceId: session.initiatorDeviceId,
      secret: "s".repeat(43),
      role: "INITIATOR",
      createPeerConnection: () => connection as unknown as RTCPeerConnection,
      signalClient: {
        async sendPairingSignal() {
          return sentSignal;
        },
        async listPairingSignals() {
          pollCalls += 1;
          throw Object.assign(new Error("expired"), { status: 410 });
        },
      },
      onStatus: (status) => statuses.push(status),
      onDataChannel() {},
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(statuses).toEqual(["CONNECTING", "FAILED"]);
    expect(pollCalls).toBe(1);
    expect(connection.closeCalls).toBe(1);
  });

  it("ignores a late polling error after the data channel is direct", async () => {
    vi.stubGlobal("window", globalThis);
    const connection = new FakePeerConnection();
    const statuses: PairingConnectionStatus[] = [];
    let rejectPoll: ((cause: unknown) => void) | undefined;
    const pendingPoll = new Promise<never>((_resolve, reject) => {
      rejectPoll = reject;
    });

    const peer = await establishPairingPeerConnection({
      session,
      localDeviceId: session.initiatorDeviceId,
      secret: "s".repeat(43),
      role: "INITIATOR",
      createPeerConnection: () => connection as unknown as RTCPeerConnection,
      signalClient: {
        async sendPairingSignal() {
          return sentSignal;
        },
        listPairingSignals() {
          return pendingPoll;
        },
      },
      onStatus: (status) => statuses.push(status),
      onDataChannel() {},
    });
    connection.channel.open();
    rejectPoll?.(Object.assign(new Error("rate limited"), { status: 429 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(statuses).toEqual(["CONNECTING", "DIRECT"]);
    expect(connection.closeCalls).toBe(0);
    peer.close();
  });
});
