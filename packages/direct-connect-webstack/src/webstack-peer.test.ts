import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SignedWebstackRelease } from "@flashcards/domain/signed-webstack";

import type { DirectConnection } from "./peer";

const mocks = vi.hoisted(() => ({
  currentWebstackActivation: vi.fn(),
  installVerifiedWebstack: vi.fn(),
  isNativePlatform: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));
vi.mock("./webstack-install", () => ({
  currentWebstackActivation: mocks.currentWebstackActivation,
  installVerifiedWebstack: mocks.installVerifiedWebstack,
}));

import { SignedWebstackPeer } from "./webstack-peer";

type WebstackAsset = SignedWebstackRelease["manifest"]["assets"][number];

class RecordingChannel extends EventTarget {
  readonly sent: string[] = [];
  readyState = "open";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;

  send(value: string): void {
    this.sent.push(value);
  }
}

const connection = (channel: RecordingChannel): DirectConnection =>
  ({ channel }) as unknown as DirectConnection;

const asset = (
  path: string,
  byteSize: number,
  hashCharacter: string,
): WebstackAsset => ({
  path,
  mediaType: path.endsWith(".html")
    ? "text/html; charset=utf-8"
    : "text/javascript; charset=utf-8",
  byteSize,
  sha256: hashCharacter.repeat(64),
});

const release = (assets: WebstackAsset[]): SignedWebstackRelease => ({
  manifest: {
    format: "flash-n-flip-signed-webstack",
    version: 1,
    buildId: "0.5.120-peer-build",
    appVersion: "0.5.120",
    createdAt: "2026-08-10T10:00:00.000Z",
    entrypoint: "index.html",
    minimumBootstrapVersion: "0.5.119",
    protocolGenerations: { rendezvous: 1, localSync: 1, webstack: 1 },
    signingKeyId: "release-key",
    totalBytes: assets.reduce((sum, entry) => sum + entry.byteSize, 0),
    assets,
  },
  signatureBase64: "A".repeat(80),
});

const base64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64");

describe("signed peer webstack transfer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.currentWebstackActivation.mockReset().mockResolvedValue(null);
    mocks.installVerifiedWebstack.mockReset().mockResolvedValue(undefined);
    mocks.isNativePlatform.mockReset();
  });

  it("keeps every iPhone asset message below Safari's conservative 64 KiB limit", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const bundledBytes = new Uint8Array(100_000).fill(7);
    const bundledRelease = release([
      asset("index.html", 1, "a"),
      asset("app.js", bundledBytes.byteLength, "b"),
    ]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify(bundledRelease), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(bundledBytes, { status: 200 })),
    );
    const channel = new RecordingChannel();
    const peer = new SignedWebstackPeer(vi.fn());

    await peer.start(connection(channel));
    await peer.receive(connection(channel), {
      kind: "WEBSTACK_REQUEST",
      version: 1,
      buildId: bundledRelease.manifest.buildId,
      paths: ["app.js"],
    });

    const chunks = channel.sent
      .map((message) => JSON.parse(message) as { kind: string })
      .filter((message) => message.kind === "WEBSTACK_CHUNK");
    expect(chunks.length).toBeGreaterThan(1);
    expect(
      Math.max(
        ...channel.sent.map(
          (message) => new TextEncoder().encode(message).byteLength,
        ),
      ),
    ).toBeLessThan(64 * 1024);
  });

  it("returns the iPhone to the app after every requested asset was sent", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const bundledRelease = release([
      asset("index.html", 1, "a"),
      asset("app.js", 1, "b"),
    ]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify(bundledRelease), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(new Uint8Array([1])))
        .mockResolvedValueOnce(new Response(new Uint8Array([2]))),
    );
    const channel = new RecordingChannel();
    const statuses: string[] = [];
    const openInstalledApp = vi.fn().mockResolvedValue(undefined);
    const peer = new SignedWebstackPeer(
      (message) => statuses.push(message),
      openInstalledApp,
    );

    await peer.start(connection(channel));
    await peer.receive(connection(channel), {
      kind: "WEBSTACK_REQUEST",
      version: 1,
      buildId: bundledRelease.manifest.buildId,
      paths: ["index.html", "app.js"],
    });

    expect(openInstalledApp).toHaveBeenCalledOnce();
    expect(statuses).toContain(
      "App vollständig übertragen. Flash-n-Flip wird automatisch geöffnet …",
    );
  });

  it("reports progress, installs once, and opens the received PWA", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const assets = [asset("index.html", 2, "a"), asset("app.js", 3, "b")];
    const offeredRelease = release(assets);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ "release-key": "trusted" }), {
          status: 200,
        }),
      ),
    );
    const channel = new RecordingChannel();
    const statuses: string[] = [];
    const openInstalledApp = vi.fn().mockResolvedValue(undefined);
    const peer = new SignedWebstackPeer(
      (message) => statuses.push(message),
      openInstalledApp,
    );

    await peer.receive(connection(channel), {
      kind: "WEBSTACK_OFFER",
      version: 1,
      release: offeredRelease,
    });
    await peer.receive(connection(channel), {
      kind: "WEBSTACK_CHUNK",
      version: 1,
      buildId: offeredRelease.manifest.buildId,
      path: "index.html",
      index: 0,
      chunkCount: 1,
      dataBase64: base64(new Uint8Array([1, 2])),
    });
    await peer.receive(connection(channel), {
      kind: "WEBSTACK_CHUNK",
      version: 1,
      buildId: offeredRelease.manifest.buildId,
      path: "app.js",
      index: 0,
      chunkCount: 1,
      dataBase64: base64(new Uint8Array([3, 4, 5])),
    });
    const complete = {
      kind: "WEBSTACK_COMPLETE" as const,
      version: 1 as const,
      buildId: offeredRelease.manifest.buildId,
    };
    await peer.receive(connection(channel), complete);
    await peer.receive(connection(channel), complete);

    expect(statuses).toContain(
      "App-Version 0.5.120 wird direkt vom iPhone geladen: 100 %",
    );
    expect(mocks.installVerifiedWebstack).toHaveBeenCalledOnce();
    expect(openInstalledApp).toHaveBeenCalledOnce();
    expect(peer.isReceiving()).toBe(false);
  });

  it("opens an already active PWA instead of leaving the browser on Connect", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const assets = [asset("index.html", 1, "a"), asset("app.js", 1, "b")];
    const offeredRelease = release(assets);
    mocks.currentWebstackActivation.mockResolvedValue({
      buildId: offeredRelease.manifest.buildId,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ "release-key": "trusted" }), {
          status: 200,
        }),
      ),
    );
    const channel = new RecordingChannel();
    const openInstalledApp = vi.fn().mockResolvedValue(undefined);
    const peer = new SignedWebstackPeer(vi.fn(), openInstalledApp);

    await peer.receive(connection(channel), {
      kind: "WEBSTACK_OFFER",
      version: 1,
      release: offeredRelease,
    });
    for (const [path, value] of [
      ["index.html", 1],
      ["app.js", 2],
    ] as const) {
      await peer.receive(connection(channel), {
        kind: "WEBSTACK_CHUNK",
        version: 1,
        buildId: offeredRelease.manifest.buildId,
        path,
        index: 0,
        chunkCount: 1,
        dataBase64: base64(new Uint8Array([value])),
      });
    }
    await peer.receive(connection(channel), {
      kind: "WEBSTACK_COMPLETE",
      version: 1,
      buildId: offeredRelease.manifest.buildId,
    });

    expect(mocks.installVerifiedWebstack).not.toHaveBeenCalled();
    expect(openInstalledApp).toHaveBeenCalledOnce();
  });
});
