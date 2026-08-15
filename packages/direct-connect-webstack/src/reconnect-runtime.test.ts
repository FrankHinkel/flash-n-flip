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
  acknowledgePeerWatermarks: vi.fn(),
  sendOutbox: vi.fn(),
  listOutbox: vi.fn(),
  countOutbox: vi.fn(),
  installedAppVersion: null as string | null,
  syncErrorHandler: undefined as
    | ((cause: unknown, connection: DirectConnection) => Promise<void>)
    | undefined,
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
      listOutbox: mocks.listOutbox,
      countOutbox: mocks.countOutbox,
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
      mocks.syncErrorHandler = parameters[5] as typeof mocks.syncErrorHandler;
    }
    listen = vi.fn();
    resumeLocalMessages = vi.fn();
    whenIdle = vi.fn().mockResolvedValue(undefined);
    announce = vi
      .fn()
      .mockResolvedValue("00000000-0000-4000-8000-000000000406");
    waitForPeerHandshake = mocks.waitForPeerHandshake;
    acknowledgePeerWatermarks = mocks.acknowledgePeerWatermarks;
    sendMediaInventory = vi.fn().mockResolvedValue(undefined);
    sendOutbox = mocks.sendOutbox;
    discardDeferredMessages = vi.fn();
  },
}));

vi.mock("./webstack-peer", () => ({
  SignedWebstackPeer: class {
    start = vi.fn().mockResolvedValue(undefined);
    waitForOptionalHandoff = vi.fn().mockResolvedValue(false);
    fail = vi.fn();
    takeInstalledAppVersion = vi.fn(() => {
      const appVersion = mocks.installedAppVersion;
      mocks.installedAppVersion = null;
      return appVersion;
    });
  },
}));

vi.mock("./connection-state", () => ({
  publishDirectConnectionState: vi.fn(),
  publishDirectPeerDeviceId: vi.fn(),
  trustedIphoneWebstackReadyEvent:
    "flash-n-flip:trusted-iphone-webstack-ready",
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
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.peerIdentityHandler = undefined;
  mocks.syncErrorHandler = undefined;
  mocks.getOrCreateDeviceIdentity.mockResolvedValue({
    id: localDeviceId,
    publicKey: "local-public-key-value-that-is-long-enough",
    storage: "INDEXED_DB",
  });
  mocks.listTrustedPeers.mockResolvedValue([]);
  mocks.saveTrustedPeer.mockResolvedValue(undefined);
  mocks.waitForPeerHandshake.mockResolvedValue(undefined);
  mocks.acknowledgePeerWatermarks.mockResolvedValue(undefined);
  mocks.sendOutbox.mockResolvedValue([]);
  mocks.listOutbox.mockResolvedValue([]);
  mocks.countOutbox.mockResolvedValue(0);
  mocks.installedAppVersion = null;

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
  it("reads only the cheap outbox count while disconnected", async () => {
    mocks.countOutbox.mockResolvedValue(75_461);
    const runtime = new DirectSyncRuntime();

    await runtime.initialize();

    expect(runtime.snapshot().pendingCount).toBe(75_461);
    expect(mocks.countOutbox).toHaveBeenCalledOnce();
    expect(mocks.listOutbox).not.toHaveBeenCalled();
  });

  it("aborts an automatic reconnect immediately in manual mode", async () => {
    mocks.listTrustedPeers.mockResolvedValue([oldPeer]);
    let reconnectSignal: AbortSignal | undefined;
    mocks.reconnectTrustedPeer.mockImplementation(
      async (_localDeviceId, _peer, options: { signal: AbortSignal }) => {
        reconnectSignal = options.signal;
        await new Promise<never>((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(options.signal.reason),
            { once: true },
          );
        });
        throw new Error("unreachable");
      },
    );
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const reconnect = (
      runtime as unknown as {
        attemptReconnect(manual: boolean): Promise<void>;
      }
    ).attemptReconnect(false);
    await vi.waitFor(() => expect(reconnectSignal).toBeDefined());

    runtime.setMode("manual");
    await reconnect;

    expect(reconnectSignal?.aborted).toBe(true);
    expect(runtime.snapshot()).toMatchObject({
      mode: "manual",
      reconnecting: false,
    });
  });

  it("announces an installed iPhone version only after durable sync completes", async () => {
    const handshake = deferred<void>();
    mocks.waitForPeerHandshake.mockReturnValueOnce(handshake.promise);
    mocks.installedAppVersion = "0.5.140";
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const directConnection = connection();
    const updateReady = vi.fn();
    window.addEventListener(
      "flash-n-flip:trusted-iphone-webstack-ready",
      updateReady,
    );

    const adoption = runtime.adoptConnection(directConnection, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, directConnection);
      },
    });
    await vi.waitFor(() =>
      expect(mocks.waitForPeerHandshake).toHaveBeenCalledOnce(),
    );
    expect(updateReady).not.toHaveBeenCalled();

    handshake.resolve();
    await adoption;

    expect(updateReady).toHaveBeenCalledOnce();
    expect((updateReady.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      appVersion: "0.5.140",
    });
  });

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
    expect(mocks.acknowledgePeerWatermarks).not.toHaveBeenCalled();

    handshake.resolve();
    await adoption;

    expect(mocks.saveTrustedPeer).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: newPeer.deviceId }),
    );
    expect(mocks.acknowledgePeerWatermarks).toHaveBeenCalledWith(
      directConnection,
    );
    expect(mocks.saveTrustedPeer.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.acknowledgePeerWatermarks.mock.invocationCallOrder[0]!,
    );
  });

  it("rotates the reconnect secret after a confirmed QR re-pairing", async () => {
    mocks.listTrustedPeers.mockResolvedValue([oldPeer]);
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const directConnection = connection();

    await runtime.adoptConnection(directConnection, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(
          { deviceId: oldPeer.deviceId, publicKey: oldPeer.publicKey },
          directConnection,
        );
      },
    });

    expect(mocks.saveTrustedPeer).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: oldPeer.deviceId,
        reconnectSecret: "B".repeat(43),
        createdAt: oldPeer.createdAt,
      }),
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

  it("retires a failed active channel so automatic reconnect can start", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    Object.assign(window, {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      documentElement: { dataset: {} },
    });
    mocks.listTrustedPeers.mockResolvedValue([oldPeer]);
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    vi.clearAllTimers();

    const active = connection();
    await runtime.adoptConnection(active, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(
          { deviceId: oldPeer.deviceId, publicKey: oldPeer.publicKey },
          active,
        );
      },
    });
    active.channel.dispatchEvent(new Event("error"));

    expect(active.close).toHaveBeenCalledOnce();
    expect(runtime.snapshot().state).toBe("disconnected");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.reconnectTrustedPeer).toHaveBeenCalledWith(
      localDeviceId,
      expect.objectContaining({
        deviceId: oldPeer.deviceId,
        reconnectSecret: "B".repeat(43),
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        timeoutMs: 12_000,
      }),
    );
    vi.useRealTimers();
  });

  it("abandons a stale reconnect and retries immediately on foreground resume", async () => {
    const documentEvents = new EventTarget() as EventTarget & {
      visibilityState: DocumentVisibilityState;
      documentElement: { dataset: Record<string, string> };
    };
    documentEvents.visibilityState = "visible";
    documentEvents.documentElement = { dataset: {} };
    vi.stubGlobal("document", documentEvents);
    mocks.listTrustedPeers.mockResolvedValue([oldPeer]);
    let firstSignal: AbortSignal | undefined;
    mocks.reconnectTrustedPeer
      .mockImplementationOnce(
        (
          _localDeviceId: string,
          _peer: TrustedPeer,
          options: { signal: AbortSignal },
        ) => {
          firstSignal = options.signal;
          return new Promise<DirectConnection>((_, reject) =>
            options.signal.addEventListener(
              "abort",
              () => reject(options.signal.reason),
              { once: true },
            ),
          );
        },
      )
      .mockRejectedValueOnce(new Error("peer still offline"));
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();

    await vi.waitFor(() =>
      expect(mocks.reconnectTrustedPeer).toHaveBeenCalledTimes(1),
    );
    window.dispatchEvent(new Event("pageshow"));

    await vi.waitFor(() => expect(firstSignal?.aborted).toBe(true));
    await vi.waitFor(() =>
      expect(mocks.reconnectTrustedPeer).toHaveBeenCalledTimes(2),
    );
  });

  it("pauses an in-flight reconnect when the app moves to the background", async () => {
    const documentEvents = new EventTarget() as EventTarget & {
      visibilityState: DocumentVisibilityState;
      documentElement: { dataset: Record<string, string> };
    };
    documentEvents.visibilityState = "visible";
    documentEvents.documentElement = { dataset: {} };
    vi.stubGlobal("document", documentEvents);
    mocks.listTrustedPeers.mockResolvedValue([oldPeer]);
    let reconnectSignal: AbortSignal | undefined;
    mocks.reconnectTrustedPeer.mockImplementationOnce(
      (
        _localDeviceId: string,
        _peer: TrustedPeer,
        options: { signal: AbortSignal },
      ) => {
        reconnectSignal = options.signal;
        return new Promise<DirectConnection>((_, reject) =>
          options.signal.addEventListener(
            "abort",
            () => reject(options.signal.reason),
            { once: true },
          ),
        );
      },
    );
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    await vi.waitFor(() => expect(reconnectSignal).toBeDefined());

    documentEvents.visibilityState = "hidden";
    documentEvents.dispatchEvent(new Event("visibilitychange"));

    await vi.waitFor(() => expect(reconnectSignal?.aborted).toBe(true));
    await vi.waitFor(() => expect(runtime.snapshot().reconnecting).toBe(false));
    expect(mocks.reconnectTrustedPeer).toHaveBeenCalledOnce();
  });

  it("retires the active connection after a synchronizer failure", async () => {
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const active = connection();
    await runtime.adoptConnection(active, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, active);
      },
    });

    await mocks.syncErrorHandler?.(new Error("media send failed"), active);

    expect(active.close).toHaveBeenCalledOnce();
    expect(runtime.snapshot().state).toBe("error");
  });

  it("retires the active connection after an outbox send failure", async () => {
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const active = connection();
    await runtime.adoptConnection(active, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, active);
      },
    });
    mocks.sendOutbox.mockRejectedValueOnce(new Error("channel send failed"));

    await runtime.flushConnectedChanges();

    expect(active.close).toHaveBeenCalledOnce();
    expect(runtime.snapshot().state).toBe("error");
  });

  it("flushes a durable local change without polling an idle connection", async () => {
    vi.useFakeTimers();
    Object.assign(window, {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const active = connection();
    await runtime.adoptConnection(active, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, active);
      },
    });
    vi.clearAllTimers();
    mocks.sendOutbox.mockClear();

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(mocks.sendOutbox).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("flash-n-flip:decks-changed"));
    await vi.waitFor(() => expect(mocks.sendOutbox).toHaveBeenCalledOnce());
  });

  it("does not let newer outbox entries starve the acknowledged batch", async () => {
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const active = connection();
    await runtime.adoptConnection(active, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, active);
      },
    });
    mocks.sendOutbox.mockClear();

    const firstId = "00000000-0000-4000-8000-000000000501";
    const laterId = "00000000-0000-4000-8000-000000000502";
    let outbox = [{ mutationId: firstId }];
    mocks.listOutbox.mockImplementation(async () => outbox);
    mocks.sendOutbox.mockImplementation(async () => {
      if (mocks.sendOutbox.mock.calls.length === 1) return [firstId];
      outbox = [];
      return [laterId];
    });

    const flush = runtime.flushConnectedChanges();
    await vi.waitFor(() => expect(mocks.sendOutbox).toHaveBeenCalledOnce());
    outbox = [{ mutationId: laterId }];
    await flush;

    await vi.waitFor(() => expect(mocks.sendOutbox).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(runtime.snapshot().state).toBe("synced"));
  });

  it("retries a stalled batch and reconnects when acknowledgements stay absent", async () => {
    vi.useFakeTimers();
    Object.assign(window, {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      documentElement: { dataset: {} },
    });
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const active = connection();
    await runtime.adoptConnection(active, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, active);
      },
    });
    vi.clearAllTimers();
    mocks.sendOutbox.mockClear();

    const mutationId = "00000000-0000-4000-8000-000000000503";
    mocks.listOutbox.mockResolvedValue([{ mutationId }]);
    mocks.sendOutbox.mockResolvedValue([mutationId]);

    const flush = runtime.flushConnectedChanges();
    await vi.advanceTimersByTimeAsync(15_150);
    expect(mocks.sendOutbox).toHaveBeenCalledTimes(2);
    expect(active.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_150);
    await flush;
    expect(active.close).toHaveBeenCalledOnce();
    expect(runtime.snapshot().state).toBe("error");
  });

  it("keeps a batch alive while acknowledgements continue to advance", async () => {
    vi.useFakeTimers();
    Object.assign(window, {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      documentElement: { dataset: {} },
    });
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const active = connection();
    await runtime.adoptConnection(active, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, active);
      },
    });
    vi.clearAllTimers();
    mocks.sendOutbox.mockClear();

    const firstId = "00000000-0000-4000-8000-000000000504";
    const secondId = "00000000-0000-4000-8000-000000000505";
    let outbox = [{ mutationId: firstId }, { mutationId: secondId }];
    mocks.listOutbox.mockImplementation(async () => outbox);
    mocks.sendOutbox.mockResolvedValue([firstId, secondId]);

    const flush = runtime.flushConnectedChanges();
    await vi.advanceTimersByTimeAsync(10_000);
    outbox = [{ mutationId: secondId }];
    await vi.advanceTimersByTimeAsync(150);
    await vi.advanceTimersByTimeAsync(14_000);
    expect(mocks.sendOutbox).toHaveBeenCalledOnce();
    expect(active.close).not.toHaveBeenCalled();

    outbox = [];
    await vi.advanceTimersByTimeAsync(150);
    await flush;
    expect(runtime.snapshot().state).toBe("synced");
  });

  it("pauses the outbox watchdog while the app is in the background", async () => {
    vi.useFakeTimers();
    Object.assign(window, {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
    const documentState = {
      visibilityState: "hidden" as DocumentVisibilityState,
      addEventListener: vi.fn(),
      documentElement: { dataset: {} },
    };
    vi.stubGlobal("document", documentState);
    const runtime = new DirectSyncRuntime();
    await runtime.initialize();
    const active = connection();
    await runtime.adoptConnection(active, {
      beforeSync: async () => {
        await mocks.peerIdentityHandler?.(newPeer, active);
      },
    });
    vi.clearAllTimers();
    mocks.sendOutbox.mockClear();

    const mutationId = "00000000-0000-4000-8000-000000000506";
    mocks.listOutbox.mockResolvedValue([{ mutationId }]);
    mocks.sendOutbox.mockResolvedValue([mutationId]);

    const flush = runtime.flushConnectedChanges();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.sendOutbox).toHaveBeenCalledOnce();
    expect(active.close).not.toHaveBeenCalled();

    documentState.visibilityState = "visible";
    await vi.advanceTimersByTimeAsync(15_150);
    expect(mocks.sendOutbox).toHaveBeenCalledTimes(2);

    mocks.listOutbox.mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(150);
    await flush;
  });
});
