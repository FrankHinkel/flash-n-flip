import type { DeviceIdentity, TrustedPeer } from "./identity";
import {
  getOrCreateDeviceIdentity,
  listTrustedPeers,
  saveTrustedPeer,
} from "./identity";
import { LocalAppRepository } from "./local-app";
import type { DirectConnection } from "./peer";
import { reconnectTrustedPeer } from "./peer";
import { LocalPeerSynchronizer } from "./peer-sync";
import { SignedWebstackPeer } from "./webstack-peer";
import {
  publishDirectConnectionState,
  publishDirectPeerDeviceId,
  type DirectConnectionState,
} from "./connection-state";

export type DirectSyncMode = "automatic" | "manual";

export type DirectSyncSnapshot = {
  mode: DirectSyncMode;
  state: DirectConnectionState;
  reconnecting: boolean;
  trustedPeerCount: number;
  pendingCount: number;
  lastSyncedAt: string | null;
  message: string;
};

export type AdoptConnectionOptions = {
  beforeSync?: (connection: DirectConnection) => Promise<void>;
};

export const directSyncRuntimeChangedEvent =
  "flash-n-flip:direct-sync-runtime-changed";

const modeKey = "flash-n-flip:direct-sync-mode:v1";
const lastSyncKey = "flash-n-flip:direct-sync-last-success:v1";
const retryDelays = [2_000, 5_000, 10_000, 30_000, 60_000] as const;
const reconciliationIntervalMs = 15_000;

const deviceStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const localMode = (): DirectSyncMode =>
  deviceStorage()?.getItem(modeKey) === "manual" ? "manual" : "automatic";

const nowIso = (): string => new Date().toISOString();

export class DirectSyncRuntime {
  private initialization: Promise<void> | null = null;
  private identity: DeviceIdentity | null = null;
  private repository: LocalAppRepository | null = null;
  private synchronizer: LocalPeerSynchronizer | null = null;
  private connection: DirectConnection | null = null;
  private expectedPeer: TrustedPeer | null = null;
  private trustedPeers: TrustedPeer[] = [];
  private mode = localMode();
  private state: DirectConnectionState = "disconnected";
  private reconnecting = false;
  private pendingCount = 0;
  private lastSyncedAt = deviceStorage()?.getItem(lastSyncKey) ?? null;
  private message = "Kein Gerät verbunden.";
  private reconnectTimer = 0;
  private continuousSyncTimer = 0;
  private retryIndex = 0;
  private reconnectAttempt: Promise<void> | null = null;
  private flushRunning = false;
  private bootstrappingConnection: DirectConnection | null = null;
  private suppressNextReconnect = false;
  private lastActivityAt = 0;
  private lastReconciliationAt = 0;
  private unknownHandler?: (value: unknown) => void | Promise<void>;
  private changedHandler?: () => void | Promise<void>;
  private errorHandler?: (cause: unknown) => void | Promise<void>;
  private readonly reconnectWebstackPeer = new SignedWebstackPeer(
    () => undefined,
    async () => window.location.assign("/app"),
    false,
  );
  private reconnectWebstackActive = false;

  configure(input: {
    onUnknown?: (value: unknown) => void | Promise<void>;
    onChanged?: () => void | Promise<void>;
    onError?: (cause: unknown) => void | Promise<void>;
  }): void {
    if (input.onUnknown) this.unknownHandler = input.onUnknown;
    if (input.onChanged) this.changedHandler = input.onChanged;
    if (input.onError) this.errorHandler = input.onError;
  }

  snapshot = (): DirectSyncSnapshot => ({
    mode: this.mode,
    state: this.state,
    reconnecting: this.reconnecting,
    trustedPeerCount: this.trustedPeers.length,
    pendingCount: this.pendingCount,
    lastSyncedAt: this.lastSyncedAt,
    message: this.message,
  });

  private publish(
    state: DirectConnectionState = this.state,
    message = this.message,
  ): void {
    this.state = state;
    this.message = message;
    publishDirectConnectionState(state);
    window.dispatchEvent(new Event(directSyncRuntimeChangedEvent));
  }

  async initialize(): Promise<void> {
    this.initialization ??= this.initializeOnce();
    return this.initialization;
  }

  private async initializeOnce(): Promise<void> {
    this.identity = await getOrCreateDeviceIdentity();
    this.repository = new LocalAppRepository(this.identity.id);
    this.trustedPeers = (await listTrustedPeers()).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
    this.synchronizer = new LocalPeerSynchronizer(
      this.repository.authority,
      this.identity.id,
      async () => {
        await this.repository!.cleanupActivatedAudioOriginals();
        await this.refreshPendingCount();
        await this.changedHandler?.();
        window.dispatchEvent(
          new CustomEvent("flash-n-flip:decks-changed", {
            detail: { source: "direct-sync" },
          }),
        );
      },
      async (value) => {
        if (
          this.reconnectWebstackActive &&
          this.connection &&
          (await this.reconnectWebstackPeer.receive(this.connection, value))
        ) {
          return;
        }
        await this.unknownHandler?.(value);
      },
      this.repository,
      async (cause) => {
        this.publish("error", "Direktabgleich fehlgeschlagen.");
        await this.errorHandler?.(cause);
      },
      this.identity.publicKey,
      async (peer) => this.acceptPeerIdentity(peer),
      () => {
        this.lastActivityAt = Date.now();
      },
      async () => (await this.repository!.listDecks()).length === 0,
      async () => {
        await this.refreshPendingCount();
      },
    );
    await this.refreshPendingCount();
    this.installLifecycleListeners();
    this.publish(
      "disconnected",
      this.trustedPeers.length
        ? this.mode === "automatic"
          ? "Warte auf ein vertrautes Gerät."
          : "Manueller Abgleich ist bereit."
        : "Noch kein vertrauenswürdiges Gerät gekoppelt.",
    );
    if (this.mode === "automatic" && this.trustedPeers.length)
      this.scheduleReconnect(0);
  }

  localRepository(): LocalAppRepository {
    if (!this.repository)
      throw new Error(
        "Der lokale Direktabgleich ist noch nicht initialisiert.",
      );
    return this.repository;
  }

  deviceIdentity(): DeviceIdentity {
    if (!this.identity)
      throw new Error("Die Geräteidentität ist noch nicht initialisiert.");
    return this.identity;
  }

  private async refreshPendingCount(): Promise<void> {
    this.pendingCount = this.repository
      ? (await this.repository.authority.listOutbox()).length
      : 0;
    window.dispatchEvent(new Event(directSyncRuntimeChangedEvent));
  }

  private async acceptPeerIdentity(peer: {
    deviceId: string;
    publicKey?: string;
  }): Promise<void> {
    if (
      !this.connection ||
      !this.identity ||
      peer.deviceId === this.identity.id
    )
      return;
    if (this.expectedPeer && this.expectedPeer.deviceId !== peer.deviceId) {
      throw new Error(
        "Das wiederverbundene Gerät hat eine unerwartete Identität.",
      );
    }
    if (
      this.expectedPeer?.publicKey &&
      peer.publicKey &&
      this.expectedPeer.publicKey !== peer.publicKey
    ) {
      throw new Error(
        "Der Geräteschlüssel des wiederverbundenen Geräts stimmt nicht überein.",
      );
    }
    const existing = this.trustedPeers.find(
      (candidate) => candidate.deviceId === peer.deviceId,
    );
    if (
      existing?.publicKey &&
      peer.publicKey &&
      existing.publicKey !== peer.publicKey
    ) {
      throw new Error(
        "Der gespeicherte Geräteschlüssel stimmt nicht mit dem verbundenen Gerät überein.",
      );
    }
    publishDirectPeerDeviceId(peer.deviceId);
    if (
      !peer.publicKey ||
      !this.connection.reconnectSecret ||
      !this.connection.apiOrigin
    ) {
      return;
    }
    const timestamp = nowIso();
    const trusted: TrustedPeer = {
      deviceId: peer.deviceId,
      publicKey: peer.publicKey,
      reconnectSecret:
        existing?.reconnectSecret ?? this.connection.reconnectSecret,
      apiOrigin: this.connection.apiOrigin,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await saveTrustedPeer(trusted);
    this.trustedPeers = [
      trusted,
      ...this.trustedPeers.filter(
        (candidate) => candidate.deviceId !== trusted.deviceId,
      ),
    ];
    window.dispatchEvent(new Event(directSyncRuntimeChangedEvent));
  }

  async adoptConnection(
    connection: DirectConnection,
    options: AdoptConnectionOptions = {},
  ): Promise<void> {
    await this.initialize();
    if (this.connection && this.connection !== connection) {
      this.suppressNextReconnect = true;
      await this.connection.close();
    }
    this.connection = connection;
    this.bootstrappingConnection = connection;
    this.lastReconciliationAt = Date.now();
    this.lastActivityAt = Date.now();
    this.publish("transport-connected", "Direkt verbunden.");
    this.synchronizer!.listen(connection, {
      deferLocalMessages: Boolean(options.beforeSync),
    });
    connection.channel.addEventListener(
      "close",
      () => this.handleConnectionClosed(connection),
      { once: true },
    );
    try {
      this.reconnectWebstackActive = !options.beforeSync;
      if (options.beforeSync) await options.beforeSync(connection);
      else {
        await this.reconnectWebstackPeer.start(connection);
        await this.reconnectWebstackPeer.waitForOptionalHandoff();
      }
      this.publish("syncing", "Lokaler Abgleich läuft …");
      this.synchronizer!.resumeLocalMessages();
      await this.synchronizer!.whenIdle();
      const handshakeId = await this.synchronizer!.announce(connection);
      await this.synchronizer!.waitForPeerHandshake(connection, handshakeId);
      await this.synchronizer!.whenIdle();
      await this.synchronizer!.sendMediaInventory(connection);
      await this.waitForOutboxDrain();
      this.markSynced();
      this.startContinuousSync();
    } catch (cause) {
      this.reconnectWebstackPeer.fail(cause);
      this.synchronizer!.discardDeferredMessages(connection);
      if (this.connection === connection) {
        this.connection = null;
        publishDirectPeerDeviceId(null);
        window.clearInterval(this.continuousSyncTimer);
      }
      await connection.close().catch(() => undefined);
      this.publish("error", "Direktabgleich fehlgeschlagen.");
      await this.errorHandler?.(cause);
      this.scheduleReconnect();
      throw cause;
    } finally {
      if (this.bootstrappingConnection === connection) {
        this.bootstrappingConnection = null;
      }
    }
  }

  private markSynced(): void {
    this.retryIndex = 0;
    this.lastSyncedAt = nowIso();
    deviceStorage()?.setItem(lastSyncKey, this.lastSyncedAt);
    this.publish("synced", "Alle bestätigten Änderungen sind abgeglichen.");
    void this.refreshPendingCount();
  }

  private async waitForOutboxDrain(timeoutMs = 10 * 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await this.synchronizer!.whenIdle();
      if ((await this.repository!.authority.listOutbox()).length === 0) return;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    }
    throw new Error("Der Direktabgleich wurde nicht bestätigt.");
  }

  private async waitForQuietConnection(timeoutMs = 10 * 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await this.synchronizer!.whenIdle();
      const quietFor = Date.now() - this.lastActivityAt;
      if (
        quietFor >= 1_500 &&
        this.connection?.channel.bufferedAmount === 0 &&
        (await this.repository!.authority.listOutbox()).length === 0
      ) {
        return;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
    }
    throw new Error(
      "Der manuelle Abgleich ist noch nicht vollständig abgeschlossen.",
    );
  }

  private startContinuousSync(): void {
    window.clearInterval(this.continuousSyncTimer);
    this.continuousSyncTimer = window.setInterval(
      () => void this.flushConnectedChanges(),
      1_500,
    );
  }

  async flushConnectedChanges(): Promise<void> {
    const active = this.connection;
    if (
      !active ||
      active.channel.readyState !== "open" ||
      this.flushRunning ||
      this.bootstrappingConnection === active
    )
      return;
    this.flushRunning = true;
    try {
      const sent = await this.synchronizer!.sendOutbox(active);
      const reconcile =
        Date.now() - this.lastReconciliationAt >= reconciliationIntervalMs;
      if (sent > 0) this.publish("syncing", "Lokaler Abgleich läuft …");
      if (reconcile) {
        await this.synchronizer!.announce(active);
        this.lastReconciliationAt = Date.now();
      }
      if (sent > 0 || reconcile) {
        await this.synchronizer!.sendMediaInventory(active);
      }
      if (sent > 0) await this.waitForOutboxDrain();
      if (sent > 0 || this.state !== "synced") this.markSynced();
    } catch (cause) {
      this.publish("error", "Direktabgleich fehlgeschlagen.");
      await this.errorHandler?.(cause);
    } finally {
      this.flushRunning = false;
    }
  }

  setMode(mode: DirectSyncMode): void {
    this.mode = mode;
    deviceStorage()?.setItem(modeKey, mode);
    this.retryIndex = 0;
    window.clearTimeout(this.reconnectTimer);
    if (mode === "automatic") {
      this.publish(this.state, "Automatischer Abgleich ist aktiv.");
      if (!this.connection) this.scheduleReconnect(0);
    } else {
      this.publish(this.state, "Abgleich erfolgt nur auf Knopfdruck.");
      if (this.connection) {
        this.suppressNextReconnect = true;
        void this.connection.close();
      }
    }
  }

  async syncNow(): Promise<void> {
    await this.initialize();
    if (this.connection?.channel.readyState === "open") {
      await this.flushConnectedChanges();
      if (this.mode === "manual") {
        await this.waitForQuietConnection();
        this.suppressNextReconnect = true;
        await this.connection.close();
      }
      return;
    }
    if (!this.trustedPeers.length)
      throw new Error("Bitte zuerst ein Gerät per QR-Code koppeln.");
    await this.attemptReconnect(true);
    if (!this.connection)
      throw new Error("Kein vertrautes Gerät ist derzeit erreichbar.");
    await this.waitForQuietConnection();
    if (this.mode === "manual") {
      this.suppressNextReconnect = true;
      await this.connection.close();
    }
  }

  private scheduleReconnect(delay?: number): void {
    if (
      this.mode !== "automatic" ||
      this.connection ||
      this.reconnectAttempt ||
      document.visibilityState === "hidden" ||
      ("onLine" in navigator && !navigator.onLine)
    ) {
      return;
    }
    window.clearTimeout(this.reconnectTimer);
    const base =
      delay ?? retryDelays[Math.min(this.retryIndex, retryDelays.length - 1)]!;
    const jitter =
      base === 0 ? 0 : Math.floor(base * (Math.random() * 0.3 - 0.15));
    this.reconnectTimer = window.setTimeout(
      () => void this.attemptReconnect(false),
      Math.max(0, base + jitter),
    );
  }

  private async attemptReconnect(manual: boolean): Promise<void> {
    if (this.reconnectAttempt) return this.reconnectAttempt;
    this.reconnectAttempt = (async () => {
      this.reconnecting = true;
      this.publish("disconnected", "Vertrautes Gerät wird gesucht …");
      let lastCause: unknown;
      for (const peer of this.trustedPeers) {
        try {
          this.expectedPeer = peer;
          const connection = await reconnectTrustedPeer(
            this.identity!.id,
            peer,
          );
          if (!manual && this.mode !== "automatic") {
            await connection.close();
            return;
          }
          connection.reconnectSecret = peer.reconnectSecret;
          connection.apiOrigin = peer.apiOrigin;
          await this.adoptConnection(connection);
          return;
        } catch (cause) {
          lastCause = cause;
        } finally {
          this.expectedPeer = null;
        }
      }
      if (manual) throw lastCause;
      this.retryIndex = Math.min(this.retryIndex + 1, retryDelays.length - 1);
      this.publish(
        "disconnected",
        "Vertrautes Gerät ist noch nicht erreichbar.",
      );
    })().finally(() => {
      this.reconnecting = false;
      this.reconnectAttempt = null;
      window.dispatchEvent(new Event(directSyncRuntimeChangedEvent));
      if (!manual && !this.connection) this.scheduleReconnect();
    });
    return this.reconnectAttempt;
  }

  private handleConnectionClosed(closed: DirectConnection): void {
    if (this.connection !== closed) return;
    this.connection = null;
    this.reconnectWebstackActive = false;
    window.clearInterval(this.continuousSyncTimer);
    publishDirectPeerDeviceId(null);
    const suppressed = this.suppressNextReconnect;
    this.suppressNextReconnect = false;
    this.publish(
      "disconnected",
      this.mode === "manual"
        ? "Manueller Abgleich abgeschlossen."
        : "Verbindung beendet; Wiederverbindung läuft im Hintergrund.",
    );
    if (!suppressed) this.scheduleReconnect();
  }

  private installLifecycleListeners(): void {
    const resume = () => {
      if (document.visibilityState !== "hidden") this.scheduleReconnect(0);
    };
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("flash-n-flip:decks-changed", () => {
      void this.refreshPendingCount();
      if (this.connection) void this.flushConnectedChanges();
      else this.scheduleReconnect(0);
    });
  }
}

const runtimeSymbol = Symbol.for("flash-n-flip.direct-sync-runtime.v1");

export const getDirectSyncRuntime = (): DirectSyncRuntime => {
  const scope = globalThis as typeof globalThis &
    Record<symbol, DirectSyncRuntime | undefined>;
  scope[runtimeSymbol] ??= new DirectSyncRuntime();
  return scope[runtimeSymbol];
};
