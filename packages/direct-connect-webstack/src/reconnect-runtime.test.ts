import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrustedPeer } from "./identity";
import type { DirectConnection } from "./peer";

const mocks = vi.hoisted(() => ({
  getOrCreateDeviceIdentity: vi.fn(),
  listTrustedPeers: vi.fn(),
  saveTrustedPeer: vi.fn(),
  reconnectTrustedPeer: vi.fn(),
  peerIdentityHandler: undefined as
    | ((
        peer: { deviceId: string; publicKey?: string },
        connection: DirectConnection,
      ) => void | Promise<void>)
    | undefined,
  waitForPeerHandshake: vi.fn(),
}));

vi.mock("./identity", () => ({
  getOrCreateDeviceIdentity: mocks.getOrCreateDeviceIdentity,
  listTrustedPeers: mocks.listTrustedPeers,
  saveTrustedPeer: mocks.saveTrustedPeer,
}));

vi.mock("./peer", () => ({
  reconnectTrustedPeer: mocks.reconnectTrustedPeer,
}));

vi.mock("./local-app", () => ({
  LocalAppRepository: class {
    authority = {
      listOutbox: vi.fn().mockResolvedValue([]),
    };
    cleanupActivatedAudioOriginals = vi.fn().mockResolvedValue(undefined);
    listDecks = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("./peer-sync", () => ({
  LocalPeerSynchronizer: class {
    constructor(...parameters: unknown[]) {
      mocks.peerIdentityHandler =
        parameters[7] as typeof mocks.peerIdentityHandler;
    }
    listen = vi.fn();
    resumeLocalMessages = vi.fn();
    whenIdle = vi.fn().mockResolvedValue(undefined);
    announce = vi
      .fn()
      .mockResolvedValue("00000000-0000-4000-8000-000000000406");
    waitForPeerHandshake = mocks.waitForPeerHandshake;
    sendMediaInventory = vi.fn().mockResolvedValue(undefined);
    sendOutbox = vi.fn().mockResolvedValue(0);
    discardDeferredMessages = vi.fn();
  },
}));

vi.mock("./webstack-peer", () => ({
  SignedWebstackPeer: class {
    start = vi.fn().mockResolvedValue(undefined);
    waitForOptionalHandoff = vi.fn().mockResolvedValue(false);
    fail = vi.fn();
  },
}));

vi.mock("./connection-state", () => ({
  publishDirectConnectionState: vi.fn(),
  publishDirectPeerDeviceId: vi.fn(),
}));

import { DirectSyncRuntime } from "./reconnect-runtime";

const localDeviceId = "00000000-0000-4000-8000-000000000401";
const oldPeer: TrustedPeer = {
  deviceId: "00000000-0000-4000-8000-000000000402",
  publicKey: "old-peer-public-key-value-that-is-long-enough",
  reconnectSecret: "A".repeat(43),
  apiOrigin: "https://flash-n-flip.com/api",
  createdAt: "2026-08-12T10:00:00.000Z",
  updatedAt: "2026-08-12T10:00:00.000Z",
};
const newPeer = {
  deviceId: "00000000-0000-4000-8000-000000000403",
  publicKey: "new-peer-public-key-value-that-is-long-enough",
};

const connection = (): DirectConnection => {
  const channel = new EventTarget() as RTCDataChannel;
  Object.defineProperties(channel, {
    readyState: { value: "open", writable: true },
    bufferedAmount: { value: 0, writable: true },
  });
  const directConnection: DirectConnection = {
    channel,
    reconnectSecret: "B".repeat(43),
    apiOrigin: "https://flash-n-flip.com/api",
    close: vi.fn(async () => {
      Object.defineProperty(channel, "readyState", {
        value: "closed",
        writable: true,
      });
      channel.dispatchEvent(new Event("close"));
    }),
  };
  return directConnection;
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.peerIdentityHandler = undefined;
  mocks.getOrCreateDeviceIdentity.mockResolvedValue({
    id: localDeviceId,
    publicKey: "local-public-key-value-that-is-long-enough",
    storage: "INDEXED_DB",
  });
  mocks.listTrustedPeers.mockResolvedValue([]);
  mocks.saveTrustedPeer.mockResolvedValue(undefined);
  mocks.waitForPeerHandshake.mockResolvedValue(undefined);

  const events = new EventTarget();
  const storage = new Map<string, string>();
  vi.stubGlobal(
    "window",
    Object.assign(events, {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      location: { assign: vi.fn() },
    }),
  );
  vi.stubGlobal("document", {
    visibilityState: "hidden",
    addEventListener: vi.fn(),
    documentElement: { dataset: {} },
  });
  vi.stubGlobal("navigator", { onLine: true });
});

describe("direct sync reconnect ownership", () => {
  it("persists peer trust only after the hello acknowledgement completed", async () => {
    const handshake = deferred<void>();
    mocks.waitForPeerHandshake.mockReturnValueOnce(handshake.promise);
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const directConnection = connection();

    const adoption = runtime.adoptConnection(directConnection, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, directConnection);
      },
    });
    await vi.waitFor(() =>
      expect(mocks.waitForPeerHandshake).toHaveBeenCalledOnce(),
    );
    expect(mocks.saveTrustedPeer).not.toHaveBeenCalled();

    handshake.resolve();
    await adoption;

    expect(mocks.saveTrustedPeer).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: newPeer.deviceId }),
    );
  });

  it("lets a new QR connection supersede an older reconnect attempt", async () => {
    mocks.listTrustedPeers.mockResolvedValue([oldPeer]);
    const reconnect = deferred<DirectConnection>();
    mocks.reconnectTrustedPeer.mockReturnValueOnce(reconnect.promise);
    const runtime = new DirectSyncRuntime();
    const onError = vi.fn();
    runtime.configure({ onError });
    await runtime.initialize();

    const reconnectAttempt = (
      runtime as unknown as {
        attemptReconnect(manual: boolean): Promise<void>;
      }
    ).attemptReconnect(false);
    await vi.waitFor(() =>
      expect(mocks.reconnectTrustedPeer).toHaveBeenCalledOnce(),
    );

    const qrConnection = connection();
    await runtime.adoptConnection(qrConnection, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, qrConnection);
      },
    });

    const staleConnection = connection();
    reconnect.resolve(staleConnection);
    await reconnectAttempt;

    expect(staleConnection.close).toHaveBeenCalledOnce();
    expect(qrConnection.close).not.toHaveBeenCalled();
    expect(mocks.saveTrustedPeer).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: newPeer.deviceId }),
    );
    expect(onError).not.toHaveBeenCalled();
    expect(runtime.snapshot().state).toBe("synced");
  });
});
