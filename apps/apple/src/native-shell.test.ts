import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sceneDelegate = readFileSync(
  new URL("../ios/App/App/SceneDelegate.swift", import.meta.url),
  "utf8",
);
const identityPlugin = readFileSync(
  new URL("../ios/App/App/FlashNFlipIdentityPlugin.swift", import.meta.url),
  "utf8",
);
const appDelegate = readFileSync(
  new URL("../ios/App/App/AppDelegate.swift", import.meta.url),
  "utf8",
);
const entitlements = readFileSync(
  new URL("../ios/App/App/App.CloudKit.entitlements", import.meta.url),
  "utf8",
);
const project = readFileSync(
  new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url),
  "utf8",
);
const infoPlist = readFileSync(
  new URL("../ios/App/App/Info.plist", import.meta.url),
  "utf8",
);
const audioClient = readFileSync(
  new URL("../../web/lib/audio-optimization.ts", import.meta.url),
  "utf8",
);
const applePackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: { build: string } };

describe("native iPhone WebView shell", () => {
  it("keeps the WebView surface neutral without native edge bounce", () => {
    expect(sceneDelegate).toContain(
      "window?.rootViewController = FlashNFlipBridgeViewController()",
    );
    expect(sceneDelegate).toContain("webView?.scrollView.bounces = false");
    expect(sceneDelegate).toContain(
      "webView?.scrollView.alwaysBounceVertical = false",
    );
    expect(sceneDelegate).toContain(
      "webView?.scrollView.backgroundColor = webSurfaceColor",
    );
    expect(sceneDelegate).toContain(
      "webView?.scrollView.showsHorizontalScrollIndicator = false",
    );
    expect(sceneDelegate).toContain(
      "webView?.scrollView.showsVerticalScrollIndicator = false",
    );
  });

  it("registers a device-bound Keychain identity plugin", () => {
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(FlashNFlipIdentityPlugin())",
    );
    expect(identityPlugin).toContain(
      "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly",
    );
    expect(identityPlugin).toContain("P256.Signing.PrivateKey");
    expect(identityPlugin).toContain(
      'public let jsName = "FlashNFlipIdentity"',
    );
  });

  it("registers the chunked and verified native AAC audio optimizer", () => {
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(FlashNFlipAudioPlugin())",
    );
    expect(identityPlugin).toContain('public let jsName = "FlashNFlipAudio"');
    expect(identityPlugin).toContain("AVAssetReader");
    expect(identityPlugin).toContain("AVEncoderBitRateKey: 40_000");
    expect(identityPlugin).toContain('CAPPluginMethod(name: "appendInput"');
    expect(identityPlugin).toContain("let verified = outputSize > 0");
    expect(identityPlugin).toContain("isLowPowerModeEnabled");
    for (const method of [
      "begin",
      "appendInput",
      "optimizeFile",
      "readOutput",
      "cleanup",
    ]) {
      expect(audioClient).toContain(`${method}(`);
      expect(identityPlugin).toContain(`CAPPluginMethod(name: "${method}"`);
    }
    expect(applePackage.scripts.build).toMatch(
      /direct-connect-webstack build.*capacitor sync ios/,
    );
  });

  it("keeps CloudKit dormant until a paid Developer Team is available", () => {
    expect(sceneDelegate).not.toContain(
      "bridge?.registerPluginInstance(FlashNFlipAppleCloudPlugin())",
    );
    expect(identityPlugin).toContain(
      'public let jsName = "FlashNFlipAppleCloud"',
    );
    expect(identityPlugin).toContain("kSecAttrSynchronizable as String: true");
    expect(identityPlugin).toContain("fetchUserRecordID");
    expect(identityPlugin).toContain("flash-n-flip-encrypted-cloud-backup");
    expect(identityPlugin).toContain("CKShare(rootRecord: root)");
    expect(identityPlugin).not.toContain(
      'json.contains("flash-n-flip-local-backup") else {\n            call.resolve',
    );
    expect(appDelegate).not.toContain("userDidAcceptCloudKitShareWith");
    expect(appDelegate).not.toContain("import CloudKit");
    expect(entitlements).toContain("iCloud.com.flash-n-flip");
    expect(project).not.toContain("CODE_SIGN_ENTITLEMENTS");
    expect(infoPlist).not.toContain("CKSharingSupported");
  });
});
