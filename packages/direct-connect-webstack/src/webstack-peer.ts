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

const chunkBytes = 128 * 1024;
const bootstrapVersion = process.env.NEXT_PUBLIC_FNF_APP_VERSION || "0.0.0";

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

  constructor(
    private readonly onStatus: (message: string, error?: boolean) => void,
  ) {}

  async start(connection: DirectConnection): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const response = await fetch("../webstack-release.json", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const release = signedWebstackReleaseSchema.parse(await response.json());
    this.release = release;
    await send(connection, { kind: "WEBSTACK_OFFER", version: 1, release });
  }

  async receive(
    connection: DirectConnection,
    candidate: unknown,
  ): Promise<boolean> {
    const parsed = webstackPeerMessageSchema.safeParse(candidate);
    if (!parsed.success) return false;
    const message = parsed.data;
    if (message.kind === "WEBSTACK_OFFER") {
      if (Capacitor.isNativePlatform()) return true;
      this.release = message.release;
      this.pending.clear();
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
      asset.chunks[message.index] = base64ToBytes(message.dataBase64);
      return true;
    }
    if (message.kind === "WEBSTACK_COMPLETE") {
      if (!this.release || message.buildId !== this.release.manifest.buildId)
        return true;
      await this.finishInstall();
      return true;
    }
    if (message.kind === "WEBSTACK_REJECT") {
      this.onStatus(`App-Übertragung abgelehnt: ${message.reason}`, true);
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
    }
    await send(connection, {
      kind: "WEBSTACK_COMPLETE",
      version: 1,
      buildId: request.buildId,
    });
  }

  private async finishInstall(): Promise<void> {
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
    const keyResponse = await fetch("../trusted-webstack-keys.json", {
      cache: "no-store",
    });
    if (!keyResponse.ok)
      throw new Error("Vertrauensanker für App-Releases fehlen.");
    const trustedKeys = (await keyResponse.json()) as Record<string, string>;
    const current = await currentWebstackActivation();
    if (current?.buildId === release.manifest.buildId) {
      this.onStatus(
        `App-Version ${release.manifest.appVersion} ist bereits aktiv.`,
      );
      return;
    }
    await installVerifiedWebstack({
      release,
      assets,
      trustedKeys,
      bootstrapVersion,
    });
    this.onStatus(
      `App-Version ${release.manifest.appVersion} wurde geprüft und atomar aktiviert.`,
    );
    window.location.assign("/app");
  }
}
