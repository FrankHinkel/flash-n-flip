import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SignedWebstackRelease } from "@flashcards/domain/signed-webstack";

vi.mock("@flashcards/sync/webstack-release", () => ({
  verifyWebstackRelease: vi.fn(async ({ release }) => release),
}));

import {
  currentWebstackActivation,
  installVerifiedWebstack,
  markCurrentWebstackHealthy,
  rollbackWebstack,
} from "./webstack-install";

const encoder = new TextEncoder();

const release = (
  buildId: string,
  appVersion: string,
): SignedWebstackRelease => ({
  manifest: {
    format: "flash-n-flip-signed-webstack",
    version: 1,
    buildId,
    appVersion,
    createdAt: "2026-08-10T10:00:00.000Z",
    entrypoint: "index.html",
    minimumBootstrapVersion: "0.5.119",
    protocolGenerations: { rendezvous: 1, localSync: 1, webstack: 1 },
    signingKeyId: "test-key",
    totalBytes: 2,
    assets: [
      {
        path: "index.html",
        mediaType: "text/html",
        byteSize: 1,
        sha256: "0".repeat(64),
      },
      {
        path: "app.js",
        mediaType: "text/javascript",
        byteSize: 1,
        sha256: "1".repeat(64),
      },
    ],
  },
  signatureBase64: "A".repeat(86) + "==",
});

const assets = new Map([
  ["index.html", encoder.encode("i")],
  ["app.js", encoder.encode("a")],
]);

type StoredCache = Map<string, Response>;
let storedCaches: Map<string, StoredCache>;
let failOnAppScript: boolean;

beforeEach(() => {
  Object.defineProperty(globalThis, "Request", {
    configurable: true,
    value: class TestRequest {
      readonly url: string;

      constructor(input: string) {
        this.url = new URL(input, "https://flash-n-flip.test").href;
      }
    },
  });
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: new IDBFactory(),
  });
  storedCaches = new Map();
  failOnAppScript = false;
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      delete: async (name: string) => storedCaches.delete(name),
      keys: async () => [...storedCaches.keys()],
      open: async (name: string) => {
        const cache = storedCaches.get(name) ?? new Map<string, Response>();
        storedCaches.set(name, cache);
        return {
          put: async (request: Request, response: Response) => {
            if (failOnAppScript && new URL(request.url).pathname === "/app.js")
              throw new Error("simulated cache write failure");
            cache.set(new URL(request.url).pathname, response);
          },
        };
      },
    },
  });
});

describe("atomic peer webstack activation", () => {
  it("retains the previous verified build and rolls back by one version", async () => {
    await installVerifiedWebstack({
      release: release("build-one", "0.5.119"),
      assets,
      trustedKeys: {},
      bootstrapVersion: "0.5.119",
    });
    await markCurrentWebstackHealthy();
    await installVerifiedWebstack({
      release: release("build-two", "0.5.120"),
      assets,
      trustedKeys: {},
      bootstrapVersion: "0.5.119",
    });

    expect(await currentWebstackActivation()).toMatchObject({
      buildId: "build-two",
      previousBuildId: "build-one",
      healthy: false,
    });
    expect([...storedCaches.keys()].sort()).toEqual([
      "flash-n-flip-peer-webstack-build-one",
      "flash-n-flip-peer-webstack-build-two",
    ]);
    await expect(rollbackWebstack()).resolves.toBe(true);
    expect(await currentWebstackActivation()).toMatchObject({
      buildId: "build-one",
      previousBuildId: "build-two",
      healthy: true,
    });
  });

  it("never activates a build whose cache staging fails", async () => {
    failOnAppScript = true;
    await expect(
      installVerifiedWebstack({
        release: release("broken-build", "0.5.119"),
        assets,
        trustedKeys: {},
        bootstrapVersion: "0.5.119",
      }),
    ).rejects.toThrow("simulated cache write failure");

    await expect(currentWebstackActivation()).resolves.toBeNull();
    expect(storedCaches.size).toBe(0);
  });
});
