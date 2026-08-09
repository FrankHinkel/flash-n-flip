import { describe, expect, it } from "vitest";

import type {
  SignedWebstackRelease,
  WebstackManifest,
} from "@flashcards/domain/signed-webstack";

import {
  verifyWebstackRelease,
  webstackManifestBytes,
} from "./webstack-release";

const encoder = new TextEncoder();
const cryptoBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(bytes);
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const sha256 = async (bytes: Uint8Array): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", cryptoBytes(bytes)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

async function signedFixture(appVersion = "0.5.119") {
  const assets = new Map([
    ["index.html", encoder.encode("<!doctype html><main>Flash-n-Flip</main>")],
    ["app.js", encoder.encode("console.log('reviewed bundle')")],
  ]);
  const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const manifest: WebstackManifest = {
    format: "flash-n-flip-signed-webstack",
    version: 1,
    buildId: `release-${appVersion}`,
    appVersion,
    createdAt: "2026-08-10T10:00:00.000Z",
    entrypoint: "index.html",
    minimumBootstrapVersion: "0.5.119",
    protocolGenerations: { rendezvous: 1, localSync: 1, webstack: 1 },
    signingKeyId: "test-release-key",
    totalBytes: [...assets.values()].reduce(
      (sum, value) => sum + value.byteLength,
      0,
    ),
    assets: await Promise.all(
      [...assets].map(async ([path, bytes]) => ({
        path,
        mediaType: path.endsWith(".html") ? "text/html" : "text/javascript",
        byteSize: bytes.byteLength,
        sha256: await sha256(bytes),
      })),
    ),
  };
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "Ed25519",
      keyPair.privateKey,
      cryptoBytes(webstackManifestBytes(manifest)),
    ),
  );
  const release: SignedWebstackRelease = {
    manifest,
    signatureBase64: bytesToBase64(signature),
  };
  const publicKey = bytesToBase64(
    new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey)),
  );
  return { assets, release, trustedKeys: { "test-release-key": publicKey } };
}

describe("signed peer webstack", () => {
  it("accepts only a complete release signed by an embedded release key", async () => {
    const fixture = await signedFixture();
    await expect(
      verifyWebstackRelease({
        ...fixture,
        bootstrapVersion: "0.5.119",
        currentAppVersion: "0.5.118",
      }),
    ).resolves.toEqual(fixture.release);
  });

  it("rejects tampering, incomplete transfers, unknown keys, and downgrades", async () => {
    const fixture = await signedFixture("0.5.118");
    const tampered = new Map(fixture.assets);
    tampered.set("app.js", encoder.encode("alert('tampered')"));
    await expect(
      verifyWebstackRelease({
        ...fixture,
        assets: tampered,
        bootstrapVersion: "0.5.119",
      }),
    ).rejects.toThrow(/size mismatch|hash mismatch/i);
    await expect(
      verifyWebstackRelease({
        ...fixture,
        assets: new Map([["index.html", fixture.assets.get("index.html")!]]),
        bootstrapVersion: "0.5.119",
      }),
    ).rejects.toThrow(/incomplete/i);
    await expect(
      verifyWebstackRelease({
        ...fixture,
        trustedKeys: {},
        bootstrapVersion: "0.5.119",
      }),
    ).rejects.toThrow(/not trusted/i);
    await expect(
      verifyWebstackRelease({
        ...fixture,
        bootstrapVersion: "0.5.119",
        currentAppVersion: "0.5.119",
      }),
    ).rejects.toThrow(/downgrade/i);
  });
});
