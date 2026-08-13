import { Capacitor } from "@capacitor/core";

import {
  signedWebstackReleaseSchema,
  webstackPeerMessageSchema,
  type SignedWebstackRelease,
  type WebstackPeerMessage,
} from "@flashcards/domain/signed-webstack";

import type { DirectConnection } from "./peer";
import {
  currentWebstackActivation,
  installVerifiedWebstack,
} from "./webstack-install";

// Safari data channels can negotiate message limits well below Chromium's.
// Base64 and the JSON envelope keep a 24 KiB chunk safely below 64 KiB.
const chunkBytes = 24 * 1024;
const bootstrapVersion = process.env.NEXT_PUBLIC_FNF_APP_VERSION || "0.0.0";
const offerTimeoutMs = 10_000;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const waitForBackpressure = async (channel: RTCDataChannel): Promise<void> => {
  if (channel.bufferedAmount < 1024 * 1024) return;
  channel.bufferedAmountLowThreshold = 256 * 1024;
  await new Promise<void>((resolve) =>
    channel.addEventListener("bufferedamountlow", () => resolve(), {
      once: true,
    }),
  );
};

const send = async (
  connection: DirectConnection,
  message: WebstackPeerMessage,
): Promise<void> => {
  await waitForBackpressure(connection.channel);
  connection.channel.send(JSON.stringify(message));
};

type PendingAsset = {
  chunks: Array<Uint8Array | undefined>;
  chunkCount: number;
};

export class SignedWebstackPeer {
  private release: SignedWebstackRelease | null = null;
  private readonly pending = new Map<string, PendingAsset>();
  private receivedBytes = 0;
  private reportedPercent = -1;
  private installing: Promise<void> | null = null;
  private readonly sentPaths = new Set<string>();
  private senderOpened = false;
  private startedChannel: RTCDataChannel | null = null;
  private handoffSettled = false;
  private appReadyToOpen = false;
  private appOpened = false;
  private installedAppVersion: string | null = null;
  private resolveOffer!: () => void;
  private offer!: Promise<void>;
  private resolveHandoff!: () => void;
  private rejectHandoff!: (cause: Error) => void;
  private handoff!: Promise<void>;

  constructor(
    private readonly onStatus: (message: string, error?: boolean) => void,
    private readonly openInstalledApp: () => Promise<void> = async () => {
      if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
      window.location.assign("/app");
    },
    private readonly openCurrentApp = true,
  ) {
    this.resetHandoff();
  }

  private resetHandoff(): void {
    this.handoffSettled = false;
    this.appReadyToOpen = false;
    this.appOpened = false;
    this.installedAppVersion = null;
    this.offer = new Promise<void>((resolve) => {
      this.resolveOffer = resolve;
    });
    this.handoff = new Promise<void>((resolve, reject) => {
      this.resolveHandoff = resolve;
      this.rejectHandoff = reject;
    });
    void this.handoff.catch(() => undefined);
  }

  private useConnection(connection: DirectConnection): void {
    if (this.startedChannel && this.startedChannel !== connection.channel) {
      this.resetHandoff();
    }
    this.startedChannel = connection.channel;
  }

  isReceiving(): boolean {
    return this.release !== null && this.pending.size > 0;
  }

  takeInstalledAppVersion(): string | null {
    const appVersion = this.installedAppVersion;
    this.installedAppVersion = null;
    return appVersion;
  }

  async waitForHandoff(): Promise<void> {
    if (Capacitor.isNativePlatform()) return this.handoff;
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    await Promise.race([
      this.offer,
      new Promise<never>((_, reject) => {
        timeout = globalThis.setTimeout(
          () =>
            reject(
              new Error(
                "Das verbundene iPhone hat keine App-Version angeboten. Bitte die iPhone-App aktualisieren und erneut koppeln.",
              ),
            ),
          offerTimeoutMs,
        );
      }),
    ]).finally(() => globalThis.clearTimeout(timeout));
    return this.handoff;
  }

  async waitForOptionalHandoff(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      await this.handoff;
      return true;
    }
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    const offered = await Promise.race([
      this.offer.then(() => true),
      new Promise<false>((resolve) => {
        timeout = globalThis.setTimeout(() => resolve(false), 2_000);
      }),
    ]).finally(() => globalThis.clearTimeout(timeout));
    if (!offered) return false;
    await this.handoff;
    return true;
  }

  fail(cause: unknown): void {
    if (this.handoffSettled) return;
    this.handoffSettled = true;
    this.rejectHandoff(
      cause instanceof Error
        ? cause
        : new Error("App-Übertragung fehlgeschlagen."),
    );
  }

  private completeHandoff(): void {
    if (this.handoffSettled) return;
    this.handoffSettled = true;
    this.resolveHandoff();
  }

  private completeHandoffWithAppReady(): void {
    this.appReadyToOpen ||= this.openCurrentApp;
    this.completeHandoff();
  }

  async openAppAfterHandoff(): Promise<void> {
    await this.handoff;
    if (!this.appReadyToOpen || this.appOpened) return;
    this.appOpened = true;
    try {
      await this.openInstalledApp();
    } catch (cause) {
      this.appOpened = false;
      throw cause;
    }
  }

  async start(connection: DirectConnection): Promise<void> {
    // The native peer can offer immediately after the data channel opens.
    // On the browser that message may be processed before start() runs; do not
    // erase an already received (and possibly already completed) offer. Only a
    // genuinely newer connection starts a fresh handoff generation.
    this.useConnection(connection);
    if (!Capacitor.isNativePlatform()) return;
    const response = await fetch("../webstack-release.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        "Die gebündelte App-Version fehlt. Bitte die iPhone-App neu installieren.",
      );
    }
    const release = signedWebstackReleaseSchema.parse(await response.json());
    this.release = release;
    this.sentPaths.clear();
    this.senderOpened = false;
    await send(connection, { kind: "WEBSTACK_OFFER", version: 1, release });
  }

  async receive(
    connection: DirectConnection,
    candidate: unknown,
  ): Promise<boolean> {
    const parsed = webstackPeerMessageSchema.safeParse(candidate);
    if (!parsed.success) return false;
    this.useConnection(connection);
    const message = parsed.data;
    if (message.kind === "WEBSTACK_OFFER") {
      if (Capacitor.isNativePlatform()) return true;
      this.resolveOffer();
      const current = await currentWebstackActivation();
      if (current?.buildId === message.release.manifest.buildId) {
        this.onStatus(
          `App-Version ${message.release.manifest.appVersion} ist bereits aktuell.`,
        );
        await send(connection, {
          kind: "WEBSTACK_CURRENT",
          version: 1,
          buildId: message.release.manifest.buildId,
        });
        this.completeHandoffWithAppReady();
        return true;
      }
      this.release = message.release;
      this.pending.clear();
      this.receivedBytes = 0;
      this.reportedPercent = -1;
      this.installing = null;
      for (const asset of message.release.manifest.assets) {
        this.pending.set(asset.path, { chunks: [], chunkCount: 0 });
      }
      this.onStatus(
        `App-Version ${message.release.manifest.appVersion} wird direkt vom iPhone geladen …`,
      );
      for (
        let index = 0;
        index < message.release.manifest.assets.length;
        index += 64
      ) {
        await send(connection, {
          kind: "WEBSTACK_REQUEST",
          version: 1,
          buildId: message.release.manifest.buildId,
          paths: message.release.manifest.assets
            .slice(index, index + 64)
            .map((asset) => asset.path),
        });
      }
      return true;
    }
    if (message.kind === "WEBSTACK_CURRENT") {
      if (this.release?.manifest.buildId === message.buildId) {
        this.onStatus(
          "Das verbundene Gerät verwendet bereits diese App-Version.",
        );
        this.completeHandoffWithAppReady();
      }
      return true;
    }
    if (message.kind === "WEBSTACK_REQUEST") {
      await this.sendRequestedAssets(connection, message);
      return true;
    }
    if (message.kind === "WEBSTACK_CHUNK") {
      if (!this.release || message.buildId !== this.release.manifest.buildId)
        return true;
      const asset = this.pending.get(message.path);
      if (!asset) return true;
      if (asset.chunkCount !== 0 && asset.chunkCount !== message.chunkCount) {
        throw new Error("Widersprüchliche Webstack-Chunkanzahl");
      }
      asset.chunkCount = message.chunkCount;
      if (!asset.chunks[message.index]) {
        const bytes = base64ToBytes(message.dataBase64);
        asset.chunks[message.index] = bytes;
        this.receivedBytes += bytes.byteLength;
        const percent = Math.min(
          100,
          Math.floor(
            (this.receivedBytes / this.release.manifest.totalBytes) * 100,
          ),
        );
        if (percent !== this.reportedPercent) {
          this.reportedPercent = percent;
          this.onStatus(
            `App-Version ${this.release.manifest.appVersion} wird direkt vom iPhone geladen: ${percent} %`,
          );
        }
      }
      return true;
    }
    if (message.kind === "WEBSTACK_COMPLETE") {
      if (!this.release || message.buildId !== this.release.manifest.buildId)
        return true;
      await this.finishInstallOnceComplete();
      return true;
    }
    if (message.kind === "WEBSTACK_REJECT") {
      this.pending.clear();
      const cause = new Error(`App-Übertragung abgelehnt: ${message.reason}`);
      this.onStatus(cause.message, true);
      this.fail(cause);
      return true;
    }
    return true;
  }

  private async sendRequestedAssets(
    connection: DirectConnection,
    request: Extract<WebstackPeerMessage, { kind: "WEBSTACK_REQUEST" }>,
  ): Promise<void> {
    if (
      !Capacitor.isNativePlatform() ||
      !this.release ||
      request.buildId !== this.release.manifest.buildId
    ) {
      await send(connection, {
        kind: "WEBSTACK_REJECT",
        version: 1,
        buildId: request.buildId,
        reason: "Die angeforderte signierte App-Version ist nicht verfügbar.",
      });
      return;
    }
    for (const path of request.paths) {
      if (!this.release.manifest.assets.some((asset) => asset.path === path))
        continue;
      const response = await fetch(`../${path}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Gebündelte App-Datei fehlt: ${path}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const chunkCount = Math.ceil(bytes.byteLength / chunkBytes);
      for (let index = 0; index < chunkCount; index += 1) {
        await send(connection, {
          kind: "WEBSTACK_CHUNK",
          version: 1,
          buildId: request.buildId,
          path,
          index,
          chunkCount,
          dataBase64: bytesToBase64(
            bytes.subarray(index * chunkBytes, (index + 1) * chunkBytes),
          ),
        });
      }
      this.sentPaths.add(path);
    }
    await send(connection, {
      kind: "WEBSTACK_COMPLETE",
      version: 1,
      buildId: request.buildId,
    });
    if (
      !this.senderOpened &&
      this.release.manifest.assets.every((asset) =>
        this.sentPaths.has(asset.path),
      )
    ) {
      this.senderOpened = true;
      this.onStatus(
        "App vollständig übertragen. Flash-n-Flip wird automatisch geöffnet …",
      );
      this.completeHandoffWithAppReady();
    }
  }

  private async finishInstallOnceComplete(): Promise<void> {
    if (this.installing) return this.installing;
    const release = this.release!;
    const assets = new Map<string, Uint8Array>();
    for (const [path, pending] of this.pending) {
      if (
        pending.chunkCount === 0 ||
        pending.chunks.length !== pending.chunkCount ||
        pending.chunks.some((chunk) => !chunk)
      )
        return;
      const byteLength = pending.chunks.reduce(
        (sum, chunk) => sum + chunk!.byteLength,
        0,
      );
      const joined = new Uint8Array(byteLength);
      let offset = 0;
      for (const chunk of pending.chunks) {
        joined.set(chunk!, offset);
        offset += chunk!.byteLength;
      }
      assets.set(path, joined);
    }
    this.installing = this.install(release, assets).catch((cause) => {
      this.installing = null;
      throw cause;
    });
    return this.installing;
  }

  private async install(
    release: SignedWebstackRelease,
    assets: ReadonlyMap<string, Uint8Array>,
  ): Promise<void> {
    const keyResponse = await fetch("../trusted-webstack-keys.json", {
      cache: "no-store",
    });
    if (!keyResponse.ok)
      throw new Error("Vertrauensanker für App-Releases fehlen.");
    const trustedKeys = (await keyResponse.json()) as Record<string, string>;
    const current = await currentWebstackActivation();
    if (current?.buildId === release.manifest.buildId) {
      this.pending.clear();
      this.onStatus(
        `App-Version ${release.manifest.appVersion} ist bereits aktiv und wird geöffnet …`,
      );
      this.completeHandoffWithAppReady();
      return;
    }
    await installVerifiedWebstack({
      release,
      assets,
      trustedKeys,
      bootstrapVersion,
    });
    this.installedAppVersion = release.manifest.appVersion;
    this.pending.clear();
    this.onStatus(
      `App-Version ${release.manifest.appVersion} wurde geprüft und wird geöffnet …`,
    );
    this.completeHandoffWithAppReady();
  }
}
