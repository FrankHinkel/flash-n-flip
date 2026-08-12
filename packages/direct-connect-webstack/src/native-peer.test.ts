import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const plugin = {
    addListener: vi.fn(
      async (
        event: string,
        listener: (value: Record<string, unknown>) => void,
      ) => {
        listeners.set(event, listener);
        return { remove: vi.fn() };
      },
    ),
    isAvailable: vi.fn(async () => ({ available: true })),
    createPeerConnection: vi.fn(
      async (_input: { connectionId: string; iceServers: string[] }) =>
        undefined,
    ),
    createDataChannel: vi.fn(async () => ({
      channelId: "native-channel",
      state: "connecting",
      bufferedAmount: 0,
    })),
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "offer-sdp" })),
    createAnswer: vi.fn(async () => ({ type: "answer", sdp: "answer-sdp" })),
    setLocalDescription: vi.fn(async () => undefined),
    setRemoteDescription: vi.fn(async () => undefined),
    getLocalDescription: vi.fn(async () => ({
      type: "offer",
      sdp: "offer-with-candidates",
    })),
    sendData: vi.fn(async () => ({ bufferedAmount: 0 })),
    closeDataChannel: vi.fn(async () => undefined),
    closePeerConnection: vi.fn(async () => undefined),
  };
  return { listeners, plugin };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => true) },
  registerPlugin: vi.fn(() => mocks.plugin),
}));

import {
  createNativePeerConnection,
  nativeDirectWebRtcAvailable,
  refreshNativeLocalDescription,
} from "./native-peer";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("native Apple WebRTC adapter", () => {
  it("creates an ordered DataChannel before the offer and relays events", async () => {
    expect(nativeDirectWebRtcAvailable()).toBe(true);
    const connection = createNativePeerConnection({
      iceServers: [{ urls: "stun:flash-n-flip.com:3478" }],
    });
    const channel = connection.createDataChannel("flash-n-flip-direct-v1", {
      ordered: true,
    });
    const opened = vi.fn();
    const received = vi.fn();
    channel.addEventListener("open", opened);
    channel.addEventListener("message", received);

    await expect(connection.createOffer()).resolves.toEqual({
      type: "offer",
      sdp: "offer-sdp",
    });
    expect(mocks.plugin.createDataChannel).toHaveBeenCalledBefore(
      mocks.plugin.createOffer,
    );
    expect(mocks.plugin.createPeerConnection).toHaveBeenCalledWith({
      connectionId: expect.any(String),
      iceServers: ["stun:flash-n-flip.com:3478"],
    });

    const connectionId =
      mocks.plugin.createPeerConnection.mock.calls[0]![0].connectionId;
    mocks.listeners.get("dataChannelState")?.({
      connectionId,
      channelId: "native-channel",
      state: "open",
    });
    expect(opened).toHaveBeenCalledOnce();

    channel.binaryType = "arraybuffer";
    mocks.listeners.get("dataMessage")?.({
      connectionId,
      channelId: "native-channel",
      dataBase64: btoa("sync"),
      isBinary: false,
    });
    expect(received.mock.calls[0]?.[0].data).toBe("sync");

    channel.send("tombstone");
    await vi.waitFor(() =>
      expect(mocks.plugin.sendData).toHaveBeenCalledOnce(),
    );
  });

  it("refreshes the gathered local description before signaling", async () => {
    const connection = createNativePeerConnection({ iceServers: [] });
    await connection.setLocalDescription({ type: "offer", sdp: "initial" });
    await refreshNativeLocalDescription(connection);
    expect(connection.localDescription?.sdp).toBe("offer-with-candidates");
  });

  it("closes channels when the native peer connection fails", async () => {
    const connection = createNativePeerConnection({ iceServers: [] });
    const channel = connection.createDataChannel("flash-n-flip-direct-v1", {
      ordered: true,
    });
    const closed = vi.fn();
    channel.addEventListener("close", closed);
    await connection.createOffer();

    const connectionId =
      mocks.plugin.createPeerConnection.mock.calls.at(-1)![0].connectionId;
    mocks.listeners.get("dataChannelState")?.({
      connectionId,
      channelId: "native-channel",
      state: "open",
    });
    mocks.listeners.get("peerConnectionState")?.({
      connectionId,
      state: "failed",
    });

    expect(channel.readyState).toBe("closed");
    expect(closed).toHaveBeenCalledOnce();
  });
});
